import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Beacon's token renewal goes through jQuery; each test answers it.
const ajax = vi.fn();
vi.mock('jquery', () => ({ default: { ajax: (...args) => ajax(...args) } }));

const HOST = 'https://apitrainbeacon.ses.nsw.gov.au';
const SOURCE = 'https://trainbeacon.ses.nsw.gov.au';
const KEY = `beaconAPIToken-${HOST}`;
const NOW = new Date('2026-10-30T09:43:00Z').getTime();
const MINUTE = 60 * 1000;
const at = (ms) => new Date(ms).toISOString();

// chrome.storage.local as Lighthouse uses it: the token is a JSON string, and
// callbacks run later, like the real (asynchronous) API.
let store;
function stored() {
  return store[KEY] ? JSON.parse(store[KEY]) : null;
}
function storeToken(token, expdate) {
  store[KEY] = JSON.stringify({ token, expdate });
}

// The module keeps one timer and the latest token per page, so each test loads its own copy.
async function load() {
  vi.resetModules();
  return import('./shared_token_code.js');
}

// Answer a renewal request (Beacon's /Authorization/RefreshToken).
function renewWith(status, body) {
  ajax.mockImplementation((options) => {
    setTimeout(() => options.complete({ status, responseJSON: body }, status === 200 ? 'success' : 'error'), 0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  store = {};
  ajax.mockReset();
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
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete globalThis.chrome;
});

describe('fetchBeaconTokenAndKeepReturningValidTokens', () => {
  it('hands over the stored token', async () => {
    const { fetchBeaconTokenAndKeepReturningValidTokens } = await load();
    const cb = vi.fn();
    storeToken('fake-token-1', at(NOW + 60 * MINUTE));
    fetchBeaconTokenAndKeepReturningValidTokens(HOST, SOURCE, cb);
    await vi.advanceTimersByTimeAsync(500);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ token: 'fake-token-1', tokenexp: at(NOW + 60 * MINUTE) });
  });

  it('hands over a token renewed elsewhere (a Beacon tab or another page) on the next check', async () => {
    const { fetchBeaconTokenAndKeepReturningValidTokens } = await load();
    storeToken('fake-token-1', at(NOW + 60 * MINUTE));
    const cb = vi.fn();
    fetchBeaconTokenAndKeepReturningValidTokens(HOST, SOURCE, cb);
    await vi.advanceTimersByTimeAsync(500);
    expect(cb).toHaveBeenCalledTimes(1);

    // 40 minutes in, another Lighthouse page renews and stores the new token.
    await vi.advanceTimersByTimeAsync(40 * MINUTE);
    storeToken('fake-token-2', at(NOW + 100 * MINUTE));
    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith({ token: 'fake-token-2', tokenexp: at(NOW + 100 * MINUTE) });
    // ...without renewing it again itself.
    expect(ajax).not.toHaveBeenCalled();
    // And only once: the same token isn't handed over every minute.
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("doesn't go back to a stored token that expires sooner than the one it has", async () => {
    const { fetchBeaconTokenAndKeepReturningValidTokens } = await load();
    storeToken('fake-token-2', at(NOW + 100 * MINUTE));
    const cb = vi.fn();
    fetchBeaconTokenAndKeepReturningValidTokens(HOST, SOURCE, cb);
    await vi.advanceTimersByTimeAsync(500);
    storeToken('fake-token-1', at(NOW + 60 * MINUTE));
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('renews 5 minutes before expiry, stores the new token and hands it over', async () => {
    const { fetchBeaconTokenAndKeepReturningValidTokens } = await load();
    storeToken('fake-token-1', at(NOW + 10 * MINUTE));
    renewWith(200, { access_token: 'fake-token-2', expires_at: at(NOW + 70 * MINUTE) });
    const cb = vi.fn();
    fetchBeaconTokenAndKeepReturningValidTokens(HOST, SOURCE, cb);
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(6 * MINUTE);
    expect(ajax).toHaveBeenCalledTimes(1);
    expect(ajax.mock.calls[0][0].url).toBe(`${SOURCE}/Authorization/RefreshToken`);
    expect(stored()).toEqual({ token: 'fake-token-2', expdate: at(NOW + 70 * MINUTE) });
    expect(cb).toHaveBeenLastCalledWith({ token: 'fake-token-2', tokenexp: at(NOW + 70 * MINUTE) });
  });

  it('after a failed renewal, stops renewing but still picks up a token stored elsewhere', async () => {
    const { fetchBeaconTokenAndKeepReturningValidTokens } = await load();
    storeToken('fake-token-1', at(NOW + 10 * MINUTE));
    renewWith(500, null);
    const cb = vi.fn();
    fetchBeaconTokenAndKeepReturningValidTokens(HOST, SOURCE, cb);
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(ajax).toHaveBeenCalledTimes(1);

    storeToken('fake-token-2', at(NOW + 80 * MINUTE)); // the user clicked a Lighthouse menu item in Beacon
    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(cb).toHaveBeenLastCalledWith({ token: 'fake-token-2', tokenexp: at(NOW + 80 * MINUTE) });
  });
});

describe('freshBeaconToken', () => {
  async function started(token, expdate) {
    const mod = await load();
    storeToken(token, expdate);
    const cb = vi.fn();
    mod.fetchBeaconTokenAndKeepReturningValidTokens(HOST, SOURCE, cb);
    await vi.advanceTimersByTimeAsync(500);
    return { ...mod, cb };
  }

  it('reads the stored token again, and hands a newer one to the page', async () => {
    const { freshBeaconToken, cb } = await started('fake-token-1', at(NOW + 60 * MINUTE));
    storeToken('fake-token-2', at(NOW + 100 * MINUTE));
    const fresh = freshBeaconToken(HOST, SOURCE);
    await vi.advanceTimersByTimeAsync(10);
    await expect(fresh).resolves.toBe('fake-token-2');
    expect(cb).toHaveBeenLastCalledWith({ token: 'fake-token-2', tokenexp: at(NOW + 100 * MINUTE) });
    expect(ajax).not.toHaveBeenCalled();
  });

  it('gives back the same token when nothing newer is stored, without renewing a valid one', async () => {
    const { freshBeaconToken, cb } = await started('fake-token-1', at(NOW + 60 * MINUTE));
    const fresh = freshBeaconToken(HOST, SOURCE);
    await vi.advanceTimersByTimeAsync(10);
    await expect(fresh).resolves.toBe('fake-token-1');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(ajax).not.toHaveBeenCalled();
  });

  it('renews a token that has expired, then gives back the new one', async () => {
    const { freshBeaconToken, cb } = await started('fake-token-1', at(NOW + 60 * MINUTE));
    vi.setSystemTime(NOW + 61 * MINUTE); // the laptop slept through the renewal
    renewWith(200, { access_token: 'fake-token-2', expires_at: at(NOW + 121 * MINUTE) });
    const fresh = freshBeaconToken(HOST, SOURCE);
    await vi.advanceTimersByTimeAsync(10);
    await expect(fresh).resolves.toBe('fake-token-2');
    expect(stored().token).toBe('fake-token-2');
    expect(cb).toHaveBeenLastCalledWith({ token: 'fake-token-2', tokenexp: at(NOW + 121 * MINUTE) });
  });

  it('sends one renewal when several refused calls ask at once', async () => {
    const { freshBeaconToken } = await started('fake-token-1', at(NOW + 2 * MINUTE));
    renewWith(200, { access_token: 'fake-token-2', expires_at: at(NOW + 62 * MINUTE) });
    const both = Promise.all([freshBeaconToken(HOST, SOURCE), freshBeaconToken(HOST, SOURCE)]);
    await vi.advanceTimersByTimeAsync(10);
    await expect(both).resolves.toEqual(['fake-token-2', 'fake-token-2']);
    expect(ajax).toHaveBeenCalledTimes(1);
  });

  it('gives back the token it has when renewal fails, so the caller knows that one was refused', async () => {
    const { freshBeaconToken } = await started('fake-token-1', at(NOW + 2 * MINUTE));
    renewWith(401, null);
    const fresh = freshBeaconToken(HOST, SOURCE);
    await vi.advanceTimersByTimeAsync(10);
    await expect(fresh).resolves.toBe('fake-token-1');
  });

  it('resolves null when there is no token at all', async () => {
    const { freshBeaconToken } = await load();
    const fresh = freshBeaconToken(HOST, SOURCE);
    await vi.advanceTimersByTimeAsync(10);
    await expect(fresh).resolves.toBeNull();
  });
});
