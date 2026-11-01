/*
  Lighthouse holding on to the CADence exercise across Beacon token renewals.

  On 30 Oct a group exercise dropped back to live positions after about an
  hour: "The CADence exercise service stopped accepting your Train Beacon
  sign-in". Each Lighthouse page kept the token it was first handed until it
  renewed the token itself; when a Beacon tab or another Lighthouse page
  renewed the stored token first, the page went on sending its own copy, the
  CADence backend refused it once it expired, and the first refusal ended the
  exercise everywhere.

  These tests wire the real pieces the way the pages do (shared_token_code.js,
  cadenceSimulation.js, BeaconClient/asset.js and the view models), with fake
  timers, a fake chrome.storage.local and a CADence backend that only accepts
  the tokens it's told are current. Every value is invented.
*/
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ajax = vi.fn();
vi.mock('jquery', () => ({ default: { ajax: (...args) => ajax(...args) } }));
vi.mock('../../shared/BeaconClient/core/request.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, request: vi.fn() };
});

const HOST = 'https://apitrainbeacon.ses.nsw.gov.au';
const SOURCE = 'https://trainbeacon.ses.nsw.gov.au';
const FEED = 'https://api.dev.cadence-extension.com/v1';
const KEY = `beaconAPIToken-${HOST}`;
const NOW = new Date('2026-10-30T09:43:00Z').getTime();
const MINUTE = 60 * 1000;
const at = (ms) => new Date(ms).toISOString();

const exercise = {
  exerciseId: 'ex-grp',
  name: 'Demo storm night',
  mode: 'group',
  createdAt: at(NOW),
  copies: [
    { copyId: '101', participantHqId: '101', participantHqName: 'Demo City' },
    { copyId: '102', participantHqId: '102', participantHqName: 'Demo Vale' },
  ],
};
const choice = {
  exerciseId: 'ex-grp',
  copyId: '101',
  exerciseName: exercise.name,
  copyName: 'Demo City',
  mode: 'group',
  participantHqId: '101',
  copies: exercise.copies,
  selectedAt: NOW,
};
const position = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [151.1, -33.9] },
  properties: { id: 'cadence-ex-grp-101-DEM01', name: 'DEM01', entity: 'Demo City', lastSeen: at(NOW) },
};

let store;
let request; // the mocked BeaconClient request(), loaded fresh for each test
let accepted; // tokens the CADence backend accepts right now
const storeToken = (token, expdate) => {
  store[KEY] = JSON.stringify({ token, expdate });
};
// The token on each call to the CADence backend, in order.
const feedTokens = () =>
  vi
    .mocked(request)
    .mock.calls.filter(([url]) => url.startsWith(FEED))
    .map(([, opts]) => opts.token);

// The shared choice (chrome.storage.session): one store for every page.
function makeShare() {
  let state = { selection: choice, ended: null };
  const listeners = [];
  const set = (next) => {
    state = next;
    listeners.forEach((l) => l(state));
  };
  return {
    watch: vi.fn((onChange) => {
      listeners.push(onChange);
      setTimeout(() => onChange(state), 0);
    }),
    choose: vi.fn(async (selection) => set({ selection, ended: null })),
    stop: vi.fn(async () => set({ selection: null, ended: null })),
    end: vi.fn(async (selection, reason) => {
      if (!state.selection) return false;
      set({ selection: null, ended: { selection: state.selection, reason, endedAt: Date.now() } });
      return true;
    }),
    state: () => state,
  };
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.resetModules(); // shared_token_code.js keeps one timer and token per page
  store = {};
  accepted = new Set(['fake-token-1']);
  ajax.mockReset();
  const core = await import('../../shared/BeaconClient/core/request.js');
  request = core.request;
  const { BeaconApiError } = core;
  vi.mocked(request).mockReset();
  vi.mocked(request).mockImplementation(async (url, { token }) => {
    if (!url.startsWith(FEED)) return { features: [] }; // Beacon's telematics
    if (!accepted.has(token)) throw new BeaconApiError(403, 'Forbidden', url, '');
    return url.endsWith('/resource-locations') ? [position] : { exercises: [exercise] };
  });
  globalThis.chrome = {
    storage: {
      local: {
        get: (key, cb) => setTimeout(() => cb({ [key]: store[key] }), 0),
        set: (items, cb) => {
          Object.assign(store, items);
          if (cb) setTimeout(cb, 0);
        },
      },
    },
  };
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete globalThis.chrome;
  delete globalThis.localStorage;
});

// Another Lighthouse page (or a Beacon tab) renews the token and stores it.
function renewedElsewhere(token, expdate) {
  storeToken(token, expdate);
  accepted.add(token);
}
// The first token stops working once it expires.
function firstTokenExpires() {
  accepted.delete('fake-token-1');
}

// ---- The CADence Simulated Exercise page, wired as main.js wires it ----------

async function openSimulatedExercisePage(share) {
  const BeaconToken = await import('../lib/shared_token_code.js');
  const { SimulatedExercisePageVM } = await import('./viewmodels/SimulatedExercisePageVM.js');
  const vm = new SimulatedExercisePageVM({
    host: HOST,
    share,
    refreshToken: () => BeaconToken.freshBeaconToken(HOST, SOURCE),
  });
  BeaconToken.fetchBeaconTokenAndKeepReturningValidTokens(HOST, SOURCE, ({ token }) => vm.setToken(token));
  await vi.advanceTimersByTimeAsync(500);
  return vm;
}

describe('CADence Simulated Exercise page', () => {
  it('uses a token renewed after the page loaded for its next call', async () => {
    storeToken('fake-token-1', at(NOW + 60 * MINUTE));
    const share = makeShare();
    const vm = await openSimulatedExercisePage(share);
    expect(feedTokens()).toEqual(['fake-token-1']);

    await vi.advanceTimersByTimeAsync(50 * MINUTE);
    renewedElsewhere('fake-token-2', at(NOW + 110 * MINUTE));
    await vi.advanceTimersByTimeAsync(MINUTE); // the page's token check
    vi.mocked(request).mockClear();
    await vm.refresh();
    expect(feedTokens()).toEqual(['fake-token-2']);
  });

  it('keeps the exercise when the backend refuses a stale token: reads the stored one and tries again', async () => {
    storeToken('fake-token-1', at(NOW + 60 * MINUTE));
    const share = makeShare();
    const vm = await openSimulatedExercisePage(share);

    renewedElsewhere('fake-token-2', at(NOW + 110 * MINUTE));
    firstTokenExpires(); // before the page's next check has picked the new one up
    vi.mocked(request).mockClear();
    const refreshed = vm.refresh();
    await vi.advanceTimersByTimeAsync(10);
    await refreshed;

    expect(feedTokens()).toEqual(['fake-token-1', 'fake-token-2']);
    expect(share.end).not.toHaveBeenCalled();
    expect(share.state().selection).toEqual(choice);
    expect(vm.refused()).toBe(false);
    expect(vm.endedVisible()).toBe(false);
    // ...and the page holds the new token from then on.
    vi.mocked(request).mockClear();
    await vm.refresh();
    expect(feedTokens()).toEqual(['fake-token-2']);
  });

  it('renews a token that has run out with no other page to renew it, and keeps the exercise', async () => {
    storeToken('fake-token-1', at(NOW + 60 * MINUTE));
    renewalAnswers('fake-token-2', at(NOW + 121 * MINUTE));
    const share = makeShare();
    const vm = await openSimulatedExercisePage(share);
    // The laptop slept through the page's own renewal.
    vi.setSystemTime(NOW + 61 * MINUTE);
    firstTokenExpires();
    const refreshed = vm.refresh();
    await vi.advanceTimersByTimeAsync(10);
    await refreshed;
    expect(ajax).toHaveBeenCalledTimes(1);
    expect(feedTokens().slice(-2)).toEqual(['fake-token-1', 'fake-token-2']);
    expect(share.end).not.toHaveBeenCalled();
  });

  it('still ends the exercise, with the existing message, when the newest token is refused', async () => {
    storeToken('fake-token-1', at(NOW + 60 * MINUTE));
    const share = makeShare();
    const vm = await openSimulatedExercisePage(share);
    accepted.clear();
    const refreshed = vm.refresh();
    await vi.advanceTimersByTimeAsync(10);
    await refreshed;

    expect(share.end).toHaveBeenCalledWith(choice, 'unavailable');
    await vi.advanceTimersByTimeAsync(10);
    expect(vm.endedText()).toBe(
      'The CADence exercise service stopped accepting your Train Beacon sign-in, so Lighthouse went back to ' +
        'live asset locations. Reload Beacon and try again.',
    );
  });
});

function renewalAnswers(token, expiresAt) {
  ajax.mockImplementation((options) => {
    accepted.add(token);
    setTimeout(() => options.complete({ status: 200, responseJSON: { access_token: token, expires_at: expiresAt } }), 0);
  });
}

// ---- LAD's asset refresh, wired as tasking/main.js wires it -----------------
//
// main.js can't be loaded in a test, so this mirrors its fetchAllTrackableAssets
// (the simulated branch): BeaconClient.asset.filter with the page's token and
// refreshCadenceToken, and endHere('unavailable') on a refusal.

async function openLad(share) {
  const BeaconToken = await import('../lib/shared_token_code.js');
  const { filter } = await import('../../shared/BeaconClient/asset.js');
  const { isSimulationUnavailable } = await import('../../shared/cadenceSimulation.js');
  const { SimulatedExerciseVM } = await import('../tasking/viewmodels/SimulatedExerciseVM.js');
  let token = '';
  const refreshCadenceToken = () => BeaconToken.freshBeaconToken(HOST, SOURCE);
  const lad = new SimulatedExerciseVM({
    host: HOST,
    getToken: async () => token,
    refreshToken: refreshCadenceToken,
    share,
  });
  BeaconToken.fetchBeaconTokenAndKeepReturningValidTokens(HOST, SOURCE, ({ token: t }) => {
    token = t;
  });
  await vi.advanceTimersByTimeAsync(500);
  await lad.ready;
  lad.refreshAssets = async () => {
    const simulation = lad.feedSelection();
    try {
      const assets = await filter('', { host: HOST, userId: '12345678', token, simulation, refreshToken: refreshCadenceToken });
      if (simulation) lad.positionsReceived(assets.filter((a) => a.type === 'psn').length);
      return assets;
    } catch (err) {
      if (simulation && isSimulationUnavailable(err)) await lad.endHere('unavailable');
      return null;
    }
  };
  return lad;
}

async function run(promise) {
  await vi.advanceTimersByTimeAsync(10);
  return promise;
}

describe('LAD', () => {
  it('uses a token renewed after the page loaded for its next feed call', async () => {
    storeToken('fake-token-1', at(NOW + 60 * MINUTE));
    const lad = await openLad(makeShare());
    await run(lad.refreshAssets());
    renewedElsewhere('fake-token-2', at(NOW + 110 * MINUTE));
    await vi.advanceTimersByTimeAsync(MINUTE);
    vi.mocked(request).mockClear();
    await run(lad.refreshAssets());
    expect(feedTokens()).toEqual(['fake-token-2']);
  });

  it('keeps the exercise when the feed refuses a stale token', async () => {
    storeToken('fake-token-1', at(NOW + 60 * MINUTE));
    const share = makeShare();
    const lad = await openLad(share);
    renewedElsewhere('fake-token-2', at(NOW + 110 * MINUTE));
    firstTokenExpires();
    vi.mocked(request).mockClear();
    const assets = await run(lad.refreshAssets());
    expect(assets.map((a) => a.name)).toEqual(['DEM01 (PSN)']);
    expect(feedTokens()).toEqual(['fake-token-1', 'fake-token-2']);
    expect(lad.active()).toBe(true);
    expect(share.end).not.toHaveBeenCalled();
    // The next refresh goes straight to the new token.
    vi.mocked(request).mockClear();
    await run(lad.refreshAssets());
    expect(feedTokens()).toEqual(['fake-token-2']);
  });

  it("keeps the exercise when its \"is it still running\" check gets a stale token refused", async () => {
    storeToken('fake-token-1', at(NOW + 60 * MINUTE));
    const share = makeShare();
    const lad = await openLad(share);
    renewedElsewhere('fake-token-2', at(NOW + 110 * MINUTE));
    firstTokenExpires();
    await expect(run(lad.verifyStillRunning())).resolves.toBe(true);
    expect(share.end).not.toHaveBeenCalled();
  });

  it('still ends the exercise everywhere, with the warning, when the newest token is refused', async () => {
    storeToken('fake-token-1', at(NOW + 60 * MINUTE));
    const share = makeShare();
    const lad = await openLad(share);
    accepted.clear();
    await run(lad.refreshAssets());
    expect(lad.active()).toBe(false);
    expect(share.end).toHaveBeenCalledWith(choice, 'unavailable');
    expect(lad.noticeIsWarning()).toBe(true);
  });
});
