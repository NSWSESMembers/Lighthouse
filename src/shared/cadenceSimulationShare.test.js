import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sharedSelectionFrom,
  createTabPublisher,
  watchSharedSelection,
  installSharedSelection,
  copyList,
  SHARE_ACCESS_MESSAGE,
} from './cadenceSimulationShare.js';

const KEY = (tabId) => `lh-simulatedExercise-tab-${tabId}`;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// Enough of chrome.storage.session / chrome.tabs / chrome.runtime for these
// tests. `denied` mimics a content script before the background has opened
// session storage to it.
function makeChrome({ tabId = 7, denied = false } = {}) {
  const store = {};
  const listeners = new Set();
  const removedListeners = [];
  const state = { denied };
  const fire = (changes) => listeners.forEach((listener) => listener(changes, 'session'));
  const session = {
    get: vi.fn(async () => {
      if (state.denied) throw new Error('Access to storage is not allowed from this context.');
      return structuredClone(store);
    }),
    set: vi.fn(async (items) => {
      const changes = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: store[key], newValue: value };
        store[key] = structuredClone(value);
      }
      fire(changes);
    }),
    remove: vi.fn(async (keys) => {
      const changes = {};
      [].concat(keys).forEach((key) => {
        if (key in store) {
          changes[key] = { oldValue: store[key] };
          delete store[key];
        }
      });
      if (Object.keys(changes).length) fire(changes);
    }),
    setAccessLevel: vi.fn(async () => {
      state.denied = false;
    }),
  };
  const chromeApi = {
    storage: {
      session,
      onChanged: { addListener: (l) => listeners.add(l), removeListener: (l) => listeners.delete(l) },
    },
    tabs: {
      getCurrent: vi.fn(async () => (tabId == null ? undefined : { id: tabId })),
      onRemoved: { addListener: (l) => removedListeners.push(l) },
    },
    runtime: {
      sendMessage: vi.fn(async () => {
        state.denied = false;
        return { ok: true };
      }),
    },
  };
  return {
    store,
    session,
    chromeApi,
    closeTab: (id) => removedListeners.forEach((listener) => listener(id, {})),
    listenerCount: () => listeners.size,
  };
}

// Every value invented.
const stormNight = {
  exerciseId: 'ex-ind',
  copyId: 'individual',
  exerciseName: 'Demo storm night',
  copyName: 'Demo City',
  mode: 'individual',
  participantHqId: '101',
  copies: [{ copyId: 'individual', participantHqId: '101', participantHqName: 'Demo City' }],
  selectedAt: 1000,
};
const floodGroup = {
  exerciseId: 'ex-grp',
  copyId: '102',
  exerciseName: 'Demo flood exercise',
  copyName: 'Demo Vale',
  mode: 'group',
  participantHqId: '102',
  copies: [
    { copyId: '101', participantHqId: '101', participantHqName: 'Demo City' },
    { copyId: '102', participantHqId: '102', participantHqName: 'Demo Vale' },
  ],
  selectedAt: 2000,
};

describe('copyList', () => {
  it('keeps well-formed copies, as strings', () => {
    expect(copyList(floodGroup.copies)).toEqual(floodGroup.copies);
    expect(copyList([{ copyId: 101, participantHqId: 101 }])).toEqual([
      { copyId: '101', participantHqId: '101', participantHqName: '' },
    ]);
  });

  it('drops junk', () => {
    expect(copyList(undefined)).toEqual([]);
    expect(copyList('101')).toEqual([]);
    expect(
      copyList([null, { copyId: '', participantHqId: '101' }, { copyId: '101' }, { copyId: {}, participantHqId: '1' }]),
    ).toEqual([]);
  });
});

describe('sharedSelectionFrom', () => {
  const items = {
    [KEY(1)]: { env: 'train', ...stormNight },
    [KEY(2)]: { env: 'train', ...floodGroup },
    [KEY(3)]: { env: 'test', ...stormNight, selectedAt: 5000 },
    [KEY(4)]: { env: 'train', ...floodGroup, exerciseId: '', selectedAt: 9000 },
    'some-other-key': { env: 'train', ...floodGroup, exerciseId: 'other', selectedAt: 9999 },
  };

  it('follows the latest choice in the environment', () => {
    expect(sharedSelectionFrom(items, 'train')).toEqual(floodGroup);
    expect(sharedSelectionFrom(items, 'test')).toEqual({ ...stormNight, selectedAt: 5000 });
  });

  it('is null when no LAD tab shows an exercise there', () => {
    expect(sharedSelectionFrom(items, 'dev')).toBeNull();
    expect(sharedSelectionFrom({}, 'train')).toBeNull();
    expect(sharedSelectionFrom(undefined, 'train')).toBeNull();
  });

  it('settles a tie the same way every time', () => {
    const tied = {
      [KEY(1)]: { env: 'train', ...stormNight },
      [KEY(2)]: { env: 'train', ...floodGroup, selectedAt: 1000 },
    };
    expect(sharedSelectionFrom(tied, 'train').exerciseId).toBe('ex-grp');
  });

  it('reads an entry without HQ details as having none, and cleans its copy list', () => {
    const { participantHqId, copies, ...bare } = floodGroup;
    expect(participantHqId && copies).toBeTruthy();
    expect(sharedSelectionFrom({ [KEY(1)]: { env: 'train', ...bare } }, 'train')).toEqual({
      ...bare,
      participantHqId: '',
      copies: [],
    });
    const junk = { [KEY(1)]: { env: 'train', ...floodGroup, copies: [null, ...floodGroup.copies, { copyId: 'x' }] } };
    expect(sharedSelectionFrom(junk, 'train').copies).toEqual(floodGroup.copies);
  });
});

describe('createTabPublisher', () => {
  it("writes this tab's selection under the tab's own key, and removes it for null", async () => {
    const { chromeApi, store } = makeChrome({ tabId: 7 });
    const publisher = createTabPublisher({ env: 'train', chromeApi });

    await publisher.publish({ ...floodGroup, label: 'not stored' });
    expect(store).toEqual({ [KEY(7)]: { env: 'train', ...floodGroup } });

    await publisher.publish(null);
    expect(store).toEqual({});
  });

  it('keeps writes in order', async () => {
    const { chromeApi, store } = makeChrome();
    const publisher = createTabPublisher({ env: 'test', chromeApi });

    publisher.publish(stormNight);
    publisher.publish(null);
    await publisher.publish(floodGroup);

    expect(Object.values(store)).toEqual([{ env: 'test', ...floodGroup }]);
  });

  it('stamps a selection with no time on it', async () => {
    const { chromeApi, store } = makeChrome();
    await createTabPublisher({ env: 'train', chromeApi }).publish({ ...stormNight, selectedAt: undefined });
    expect(store[KEY(7)].selectedAt).toBeGreaterThan(0);
  });

  it('does nothing outside an extension tab', async () => {
    const notATab = makeChrome({ tabId: null });
    await createTabPublisher({ env: 'train', chromeApi: notATab.chromeApi }).publish(stormNight);
    expect(notATab.store).toEqual({});

    await expect(
      createTabPublisher({ env: 'train', chromeApi: undefined }).publish(stormNight),
    ).resolves.toBeUndefined();
    const noEnv = makeChrome();
    await createTabPublisher({ env: '', chromeApi: noEnv.chromeApi }).publish(stormNight);
    expect(noEnv.store).toEqual({});
  });
});

describe('watchSharedSelection', () => {
  it('reports the current selection, then each change', async () => {
    const { chromeApi } = makeChrome();
    const ladA = createTabPublisher({ env: 'train', chromeApi });
    await ladA.publish(stormNight);
    const onChange = vi.fn();

    watchSharedSelection('train', onChange, { chromeApi, removalGraceMs: 0 });
    await flush();
    expect(onChange).toHaveBeenLastCalledWith(stormNight);

    // A second LAD tab picks another exercise later: Beacon pages follow it.
    const ladB = createTabPublisher({
      env: 'train',
      chromeApi: { ...chromeApi, tabs: { getCurrent: async () => ({ id: 8 }) } },
    });
    await ladB.publish(floodGroup);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith(floodGroup);

    // ...and go back to the first when it stops.
    await ladB.publish(null);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith(stormNight);

    await ladA.publish(null);
    await flush();
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('ignores changes that leave the selection the same, or are in another environment', async () => {
    const { chromeApi, session } = makeChrome();
    await createTabPublisher({ env: 'train', chromeApi }).publish(stormNight);
    const onChange = vi.fn();
    watchSharedSelection('train', onChange, { chromeApi });
    await flush();

    await session.set({ 'unrelated-key': 1 });
    await createTabPublisher({
      env: 'test',
      chromeApi: { ...chromeApi, tabs: { getCurrent: async () => ({ id: 9 }) } },
    }).publish(floodGroup);
    await flush();

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('wakes the background and retries when session storage is still closed to it', async () => {
    const { chromeApi, store } = makeChrome({ denied: true });
    store[KEY(3)] = { env: 'test', ...stormNight };
    const onChange = vi.fn();

    watchSharedSelection('test', onChange, { chromeApi });
    await flush();

    expect(chromeApi.runtime.sendMessage).toHaveBeenCalledWith({ type: SHARE_ACCESS_MESSAGE });
    expect(onChange).toHaveBeenCalledWith(stormNight);
  });

  it('reports null when the selection cannot be read at all', async () => {
    const { chromeApi } = makeChrome({ denied: true });
    chromeApi.runtime.sendMessage = vi.fn(async () => ({ ok: true })); // still closed afterwards
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onChange = vi.fn();

    watchSharedSelection('test', onChange, { chromeApi });
    await flush();

    expect(onChange).toHaveBeenCalledWith(null);
    warn.mockRestore();
  });

  it('reports null straight away without extension storage', () => {
    const onChange = vi.fn();
    watchSharedSelection('train', onChange, { chromeApi: undefined });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('stops listening when asked', async () => {
    const { chromeApi, listenerCount } = makeChrome();
    const onChange = vi.fn();
    const stop = watchSharedSelection('train', onChange, { chromeApi });
    await flush();
    stop();
    expect(listenerCount()).toBe(0);
  });

  describe('when a LAD tab takes its selection away', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('waits before going back to live positions', async () => {
      const { chromeApi } = makeChrome();
      const lad = createTabPublisher({ env: 'train', chromeApi });
      await lad.publish(stormNight);
      const onChange = vi.fn();
      watchSharedSelection('train', onChange, { chromeApi, removalGraceMs: 4000 });
      await vi.advanceTimersByTimeAsync(0);
      expect(onChange).toHaveBeenCalledTimes(1);

      await lad.publish(null);
      await vi.advanceTimersByTimeAsync(3900);
      expect(onChange).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(200);
      expect(onChange).toHaveBeenLastCalledWith(null);
    });

    it("doesn't report anything when the tab publishes it again in time (a reload)", async () => {
      const { chromeApi } = makeChrome();
      const lad = createTabPublisher({ env: 'train', chromeApi });
      await lad.publish(stormNight);
      const onChange = vi.fn();
      watchSharedSelection('train', onChange, { chromeApi, removalGraceMs: 4000 });
      await vi.advanceTimersByTimeAsync(0);

      await lad.publish(null);
      await vi.advanceTimersByTimeAsync(1500);
      await lad.publish(stormNight); // same choice, same selectedAt
      await vi.advanceTimersByTimeAsync(10000);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith(stormNight);
    });

    it('reports a new choice straight away', async () => {
      const { chromeApi } = makeChrome();
      const lad = createTabPublisher({ env: 'train', chromeApi });
      await lad.publish(stormNight);
      const onChange = vi.fn();
      watchSharedSelection('train', onChange, { chromeApi, removalGraceMs: 4000 });
      await vi.advanceTimersByTimeAsync(0);

      await lad.publish(floodGroup);
      await vi.advanceTimersByTimeAsync(0);

      expect(onChange).toHaveBeenLastCalledWith(floodGroup);
    });
  });
});

describe('installSharedSelection', () => {
  it('opens session storage to content scripts', async () => {
    const { chromeApi, session } = makeChrome({ denied: true });
    await installSharedSelection({ chromeApi });
    expect(session.setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
  });

  it("forgets a LAD tab's selection when the tab closes", async () => {
    const { chromeApi, store, closeTab } = makeChrome();
    installSharedSelection({ chromeApi });
    store[KEY(7)] = { env: 'train', ...stormNight };
    store[KEY(8)] = { env: 'train', ...floodGroup };

    closeTab(7);
    await flush();

    expect(Object.keys(store)).toEqual([KEY(8)]);
  });
});
