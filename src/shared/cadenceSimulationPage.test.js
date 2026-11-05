import { describe, it, expect, vi } from 'vitest';
import {
  serveSimulationToPage,
  createPageSimulation,
  SIMULATION_REQUEST,
  SIMULATION_STATE,
} from './cadenceSimulationPage.js';

const TRAIN_SITE = 'https://trainbeacon.ses.nsw.gov.au';
const TRAIN_API = 'https://apitrainbeacon.ses.nsw.gov.au';
const PROD_SITE = 'https://beacon.ses.nsw.gov.au';
const PROD_API = 'https://apibeacon.ses.nsw.gov.au';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// One window that the content script and the page script both listen on,
// delivering posted messages asynchronously like the real one.
function makeWindow(origin) {
  const listeners = new Set();
  const win = {
    location: { origin },
    addEventListener: (type, listener) => {
      if (type === 'message') listeners.add(listener);
    },
    postMessage: vi.fn((data) => {
      setTimeout(() => win.deliver(data), 0);
    }),
    deliver: (data, source = win) => listeners.forEach((listener) => listener({ source, data })),
  };
  return win;
}

// A stand-in for watchSharedSelection that the test drives by hand.
function makeWatch() {
  const watch = vi.fn((env, onChange) => {
    watch.report = onChange;
    return () => {};
  });
  return watch;
}

// Every value invented.
const copies = [
  { copyId: '101', participantHqId: '101', participantHqName: 'Demo City' },
  { copyId: '102', participantHqId: '102', participantHqName: 'Demo Vale' },
];
const selection = {
  exerciseId: 'ex-grp',
  copyId: '102',
  exerciseName: 'Demo flood exercise',
  copyName: 'Demo Vale',
  mode: 'group',
  participantHqId: '102',
  copies,
  selectedAt: 2000,
};
// What the page is told: the job page needs the HQ and every copy, to show
// the copy for the job's own HQ.
const pageView = {
  exerciseId: 'ex-grp',
  copyId: '102',
  exerciseName: 'Demo flood exercise',
  copyName: 'Demo Vale',
  mode: 'group',
  participantHqId: '102',
  copies,
};

describe('serveSimulationToPage', () => {
  it('does nothing on production Beacon', () => {
    const win = makeWindow(PROD_SITE);
    const watch = makeWatch();
    serveSimulationToPage({ win, watch });
    expect(watch).not.toHaveBeenCalled();
  });

  it("posts the environment's selection to the page, to its own origin only", () => {
    const win = makeWindow(TRAIN_SITE);
    const watch = makeWatch();
    serveSimulationToPage({ win, watch });
    expect(watch).toHaveBeenCalledWith('train', expect.any(Function));

    watch.report(selection);

    expect(win.postMessage).toHaveBeenCalledWith({ type: SIMULATION_STATE, selection: pageView }, TRAIN_SITE);
  });

  it('answers a request once it knows, and ignores other senders', () => {
    const win = makeWindow(TRAIN_SITE);
    const watch = makeWatch();
    serveSimulationToPage({ win, watch });

    win.deliver({ type: SIMULATION_REQUEST });
    expect(win.postMessage).not.toHaveBeenCalled(); // storage not read yet

    watch.report(null);
    win.postMessage.mockClear();
    win.deliver({ type: SIMULATION_REQUEST });
    expect(win.postMessage).toHaveBeenCalledWith({ type: SIMULATION_STATE, selection: null }, TRAIN_SITE);

    win.postMessage.mockClear();
    win.deliver({ type: SIMULATION_REQUEST }, { other: 'frame' });
    expect(win.postMessage).not.toHaveBeenCalled();
  });
});

describe('createPageSimulation', () => {
  function setUp({ host = TRAIN_API, origin = TRAIN_SITE, timeoutMs } = {}) {
    const win = makeWindow(origin);
    const watch = makeWatch();
    serveSimulationToPage({ win, watch });
    const page = createPageSimulation({ host, win, timeoutMs });
    return { win, watch, page };
  }

  it('asks the content script, and hears the answer', async () => {
    const { watch, page, win } = setUp();
    watch.report(selection);
    await flush();
    win.postMessage.mockClear();

    await expect(page.current()).resolves.toEqual(pageView);
    expect(page.latest()).toEqual(pageView);
    expect(win.postMessage).not.toHaveBeenCalledWith({ type: SIMULATION_REQUEST }, TRAIN_SITE); // already known
  });

  it('waits for a content script that has not read storage yet', async () => {
    const { watch, page } = setUp();
    const answer = page.current();
    await flush();

    watch.report(selection);

    await expect(answer).resolves.toEqual(pageView);
  });

  it('takes the host lazily', async () => {
    let host;
    const win = makeWindow(TRAIN_SITE);
    const page = createPageSimulation({ host: () => host, win });
    await expect(page.current()).resolves.toBeNull(); // urls not set up yet
    host = TRAIN_API;
    const watch = makeWatch();
    serveSimulationToPage({ win, watch });
    watch.report(selection);
    await expect(page.current()).resolves.toEqual(pageView);
  });

  it('gives null straight away on production, without asking', async () => {
    const { page, win } = setUp({ host: PROD_API, origin: PROD_SITE });
    await expect(page.current()).resolves.toBeNull();
    expect(win.postMessage).not.toHaveBeenCalled();
    expect(page.latest()).toBeNull();
  });

  it('gives null if the content script never answers', async () => {
    const win = makeWindow(TRAIN_SITE);
    const page = createPageSimulation({ host: TRAIN_API, win, timeoutMs: 5 });
    await expect(page.current()).resolves.toBeNull();
  });

  it('tells listeners about every report, and rejects malformed ones', async () => {
    const { watch, page, win } = setUp();
    const listener = vi.fn();
    page.onChange(listener);

    watch.report(selection);
    await flush();
    watch.report(null);
    await flush();
    win.deliver({ type: SIMULATION_STATE, selection: { exerciseId: 'ex', copyId: 7 } });

    expect(listener.mock.calls.map((call) => call[0])).toEqual([pageView, null, null]);
    expect(page.latest()).toBeNull();
  });

  it('cleans the copy list it is given', async () => {
    const { page, win } = setUp();
    win.deliver({
      type: SIMULATION_STATE,
      selection: { ...selection, participantHqId: 102, copies: [null, copies[0], { copyId: 'x' }, 'junk'] },
    });
    expect(page.latest()).toEqual({ ...pageView, participantHqId: '102', copies: [copies[0]] });
  });
});
