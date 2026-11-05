import { describe, it, expect, vi } from 'vitest';
import {
  sharedKey,
  copyList,
  selectionFrom,
  sharedStateFrom,
  readSharedState,
  chooseSharedSelection,
  stopSharedSelection,
  endSharedSelection,
  watchSharedState,
  watchSharedSelection,
  sharedChoice,
  installSharedSelection,
  SHARE_ACCESS_MESSAGE,
} from './cadenceSimulationShare.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const LIVE = { selection: null, ended: null };

// Enough of chrome.storage.session / chrome.runtime for these tests.
// `denied` mimics a content script before the background has opened session
// storage to it. `holdReads` keeps get() pending until releaseReads().
function makeChrome({ denied = false, holdReads = false } = {}) {
  const store = {};
  const listeners = new Set();
  const state = { denied, held: [] };
  const fire = (changes) => listeners.forEach((listener) => listener(changes, 'session'));
  const guard = () => {
    if (state.denied) throw new Error('Access to storage is not allowed from this context.');
  };
  const pick = (keys) => {
    if (keys == null) return structuredClone(store);
    const out = {};
    [].concat(keys).forEach((key) => {
      if (key in store) out[key] = structuredClone(store[key]);
    });
    return out;
  };
  const session = {
    get: vi.fn(async (keys) => {
      guard();
      if (!holdReads) return pick(keys);
      return new Promise((resolve) => state.held.push(() => resolve(pick(keys))));
    }),
    set: vi.fn(async (items) => {
      guard();
      const changes = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: store[key], newValue: structuredClone(value) };
        store[key] = structuredClone(value);
      }
      fire(changes);
    }),
    remove: vi.fn(async (keys) => {
      guard();
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
    fireOther: (changes, area = 'local') => listeners.forEach((listener) => listener(changes, area)),
    releaseReads: () => state.held.splice(0).forEach((release) => release()),
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
const active = (selection) => ({ state: 'active', selection });

describe('sharedKey', () => {
  it('keeps one key per Beacon environment', () => {
    expect(sharedKey('train')).toBe('lh-simulatedExercise-train');
    expect(sharedKey('test')).toBe('lh-simulatedExercise-test');
  });
});

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

describe('selectionFrom', () => {
  it('cleans a stored selection', () => {
    expect(selectionFrom(floodGroup)).toEqual(floodGroup);
    expect(
      selectionFrom({ exerciseId: 7, copyId: 102, participantHqId: 102, mode: 'odd', copies: [null], extra: 1 }),
    ).toEqual({
      exerciseId: '7',
      copyId: '102',
      exerciseName: '',
      copyName: '',
      mode: 'individual',
      participantHqId: '102',
      copies: [],
      selectedAt: 0,
    });
  });

  it("is null without an exercise, a copy or the copy's HQ", () => {
    expect(selectionFrom(null)).toBeNull();
    expect(selectionFrom('ex-ind')).toBeNull();
    expect(selectionFrom({ ...stormNight, exerciseId: '' })).toBeNull();
    expect(selectionFrom({ ...stormNight, copyId: undefined })).toBeNull();
    expect(selectionFrom({ ...stormNight, participantHqId: '' })).toBeNull();
    expect(selectionFrom({ ...stormNight, exerciseId: { id: 1 } })).toBeNull();
  });
});

describe('sharedStateFrom', () => {
  it('reads an active choice', () => {
    expect(sharedStateFrom(active(floodGroup))).toEqual({ selection: floodGroup, ended: null });
  });

  it('reads an ended one as live positions, saying why', () => {
    expect(sharedStateFrom({ state: 'ended', reason: 'unavailable', selection: stormNight, endedAt: 5 })).toEqual({
      selection: null,
      ended: { selection: stormNight, reason: 'unavailable', endedAt: 5 },
    });
    expect(sharedStateFrom({ state: 'ended', reason: 'other', selection: stormNight }).ended.reason).toBe('ended');
  });

  it('reads anything else as live positions', () => {
    expect(sharedStateFrom(undefined)).toEqual(LIVE);
    expect(sharedStateFrom({ state: 'active' })).toEqual(LIVE);
    expect(sharedStateFrom({ state: 'active', selection: { ...stormNight, participantHqId: '' } })).toEqual(LIVE);
    expect(sharedStateFrom({ state: 'paused', selection: stormNight })).toEqual(LIVE);
    // The format before the page: one key per LAD tab, the selection at the top level.
    expect(sharedStateFrom({ env: 'train', ...stormNight })).toEqual(LIVE);
  });
});

describe('choosing, stopping and ending', () => {
  it('stores the choice under its environment, stamping when it was made', async () => {
    const { chromeApi, store } = makeChrome();
    await chooseSharedSelection(
      'train',
      { ...stormNight, selectedAt: undefined, label: 'not stored' },
      {
        chromeApi,
        now: () => 4242,
      },
    );
    expect(store).toEqual({ [sharedKey('train')]: active({ ...stormNight, selectedAt: 4242 }) });

    await chooseSharedSelection('test', floodGroup, { chromeApi });
    expect(store[sharedKey('test')]).toEqual(active(floodGroup));
    expect(store[sharedKey('train')].selection.exerciseId).toBe('ex-ind');
  });

  it('refuses an incomplete choice, or one with nowhere to keep it', async () => {
    const { chromeApi, store } = makeChrome();
    await expect(chooseSharedSelection('train', { exerciseId: 'ex-ind' }, { chromeApi })).rejects.toThrow();
    await expect(chooseSharedSelection('', stormNight, { chromeApi })).rejects.toThrow();
    await expect(chooseSharedSelection('train', stormNight, { chromeApi: undefined })).rejects.toThrow();
    expect(store).toEqual({});
  });

  it('stops by removing the choice', async () => {
    const { chromeApi, store } = makeChrome();
    store[sharedKey('train')] = active(stormNight);
    store[sharedKey('test')] = active(floodGroup);
    await stopSharedSelection('train', { chromeApi });
    expect(Object.keys(store)).toEqual([sharedKey('test')]);
    await expect(stopSharedSelection('train', { chromeApi: undefined })).resolves.toBeUndefined();
  });

  it('records that the chosen exercise ended', async () => {
    const { chromeApi, store } = makeChrome();
    store[sharedKey('train')] = active(floodGroup);

    const ended = await endSharedSelection('train', { exerciseId: 'ex-grp', copyId: '102' }, 'ended', {
      chromeApi,
      now: () => 9000,
    });

    expect(ended).toBe(true);
    expect(store[sharedKey('train')]).toEqual({
      state: 'ended',
      reason: 'ended',
      selection: floodGroup,
      endedAt: 9000,
    });
    await expect(readSharedState('train', { chromeApi })).resolves.toEqual({
      selection: null,
      ended: { selection: floodGroup, reason: 'ended', endedAt: 9000 },
    });
  });

  it('records a refused sign-in the same way', async () => {
    const { chromeApi, store } = makeChrome();
    store[sharedKey('test')] = active(stormNight);
    await endSharedSelection('test', stormNight, 'unavailable', { chromeApi });
    expect(store[sharedKey('test')].reason).toBe('unavailable');
  });

  it("doesn't undo a newer choice, or end one that isn't there", async () => {
    const { chromeApi, store } = makeChrome();
    store[sharedKey('train')] = active(floodGroup);

    // The Demo City copy was found to have ended after the user switched to Demo Vale's.
    expect(await endSharedSelection('train', { exerciseId: 'ex-grp', copyId: '101' }, 'ended', { chromeApi })).toBe(
      false,
    );
    expect(await endSharedSelection('train', stormNight, 'ended', { chromeApi })).toBe(false);
    expect(store[sharedKey('train')]).toEqual(active(floodGroup));

    expect(await endSharedSelection('test', stormNight, 'ended', { chromeApi })).toBe(false);
    expect(store[sharedKey('test')]).toBeUndefined();
    expect(await endSharedSelection('train', null, 'ended', { chromeApi })).toBe(false);
  });

  it('wakes the background when session storage is still closed to a content script', async () => {
    const { chromeApi, store } = makeChrome({ denied: true });
    await chooseSharedSelection('train', stormNight, { chromeApi });
    expect(chromeApi.runtime.sendMessage).toHaveBeenCalledWith({ type: SHARE_ACCESS_MESSAGE });
    expect(store[sharedKey('train')]).toEqual(active(stormNight));
  });
});

describe('readSharedState', () => {
  it('reads one environment', async () => {
    const { chromeApi, store } = makeChrome();
    store[sharedKey('train')] = active(stormNight);
    await expect(readSharedState('train', { chromeApi })).resolves.toEqual({ selection: stormNight, ended: null });
    await expect(readSharedState('test', { chromeApi })).resolves.toEqual(LIVE);
  });

  it('is live positions without extension storage', async () => {
    await expect(readSharedState('train', { chromeApi: undefined })).resolves.toEqual(LIVE);
    await expect(readSharedState('', { chromeApi: makeChrome().chromeApi })).resolves.toEqual(LIVE);
  });

  it('passes an error on when storage stays closed', async () => {
    const { chromeApi } = makeChrome({ denied: true });
    chromeApi.runtime.sendMessage = vi.fn(async () => ({ ok: true })); // still closed afterwards
    await expect(readSharedState('train', { chromeApi })).rejects.toThrow(/not allowed/);
  });
});

describe('watchSharedState', () => {
  it('reports the current state, then each change', async () => {
    const { chromeApi, store } = makeChrome();
    store[sharedKey('train')] = active(stormNight);
    const onChange = vi.fn();

    watchSharedState('train', onChange, { chromeApi });
    await flush();
    expect(onChange).toHaveBeenLastCalledWith({ selection: stormNight, ended: null });

    await chooseSharedSelection('train', floodGroup, { chromeApi });
    expect(onChange).toHaveBeenLastCalledWith({ selection: floodGroup, ended: null });

    await endSharedSelection('train', floodGroup, 'ended', { chromeApi, now: () => 7 });
    expect(onChange).toHaveBeenLastCalledWith({
      selection: null,
      ended: { selection: floodGroup, reason: 'ended', endedAt: 7 },
    });

    await stopSharedSelection('train', { chromeApi });
    expect(onChange).toHaveBeenLastCalledWith(LIVE);
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('ignores other environments, other keys, other storage areas and repeats', async () => {
    const { chromeApi, session, fireOther } = makeChrome();
    const onChange = vi.fn();
    watchSharedState('train', onChange, { chromeApi });
    await flush();
    expect(onChange).toHaveBeenCalledTimes(1);

    await chooseSharedSelection('test', floodGroup, { chromeApi });
    await session.set({ 'unrelated-key': 1 });
    fireOther({ [sharedKey('train')]: { newValue: active(stormNight) } }, 'local');
    await stopSharedSelection('train', { chromeApi }); // nothing to remove: no event
    await chooseSharedSelection('train', stormNight, { chromeApi });
    await chooseSharedSelection('train', stormNight, { chromeApi }); // the same again

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith({ selection: stormNight, ended: null });
  });

  it("doesn't report a first read that a change has overtaken", async () => {
    const { chromeApi, store, releaseReads } = makeChrome({ holdReads: true });
    store[sharedKey('train')] = active(stormNight);
    const onChange = vi.fn();

    watchSharedState('train', onChange, { chromeApi });
    // The page chooses again before the first read has come back.
    await chromeApi.storage.session.set({ [sharedKey('train')]: active(floodGroup) });
    releaseReads();
    await flush();

    expect(onChange.mock.calls).toEqual([[{ selection: floodGroup, ended: null }]]);
  });

  it('wakes the background and retries when session storage is still closed to it', async () => {
    const { chromeApi, store } = makeChrome({ denied: true });
    store[sharedKey('test')] = active(stormNight);
    const onChange = vi.fn();

    watchSharedState('test', onChange, { chromeApi });
    await flush();

    expect(chromeApi.runtime.sendMessage).toHaveBeenCalledWith({ type: SHARE_ACCESS_MESSAGE });
    expect(onChange).toHaveBeenCalledWith({ selection: stormNight, ended: null });
  });

  it('reports live positions when the state cannot be read at all', async () => {
    const { chromeApi } = makeChrome({ denied: true });
    chromeApi.runtime.sendMessage = vi.fn(async () => ({ ok: true })); // still closed afterwards
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onChange = vi.fn();

    watchSharedState('test', onChange, { chromeApi });
    await flush();

    expect(onChange).toHaveBeenCalledWith(LIVE);
    warn.mockRestore();
  });

  it('reports live positions straight away without extension storage', () => {
    const onChange = vi.fn();
    watchSharedState('train', onChange, { chromeApi: undefined });
    expect(onChange).toHaveBeenCalledWith(LIVE);
  });

  it('stops listening when asked', async () => {
    const { chromeApi, listenerCount } = makeChrome();
    const onChange = vi.fn();
    const stop = watchSharedState('train', onChange, { chromeApi });
    await flush();
    stop();
    expect(listenerCount()).toBe(0);
    await chooseSharedSelection('train', stormNight, { chromeApi });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('watchSharedSelection', () => {
  it('reports only the exercise copy to show', async () => {
    const { chromeApi } = makeChrome();
    const onChange = vi.fn();
    watchSharedSelection('train', onChange, { chromeApi });
    await flush();
    expect(onChange).toHaveBeenLastCalledWith(null);

    await chooseSharedSelection('train', stormNight, { chromeApi });
    expect(onChange).toHaveBeenLastCalledWith(stormNight);

    // Ending and then clearing both mean live positions: reported once.
    await endSharedSelection('train', stormNight, 'ended', { chromeApi });
    await stopSharedSelection('train', { chromeApi });
    expect(onChange.mock.calls).toEqual([[null], [stormNight], [null]]);
  });
});

describe('sharedChoice', () => {
  it('ties the calls to one environment', async () => {
    const { chromeApi, store } = makeChrome();
    const train = sharedChoice('train', { chromeApi });
    const onChange = vi.fn();
    train.watch(onChange);
    await flush();

    await train.choose(floodGroup);
    expect(store[sharedKey('train')]).toEqual(active(floodGroup));
    await expect(train.read()).resolves.toEqual({ selection: floodGroup, ended: null });

    await expect(train.end(floodGroup, 'unavailable')).resolves.toBe(true);
    expect(onChange).toHaveBeenLastCalledWith({
      selection: null,
      ended: expect.objectContaining({ selection: floodGroup, reason: 'unavailable' }),
    });

    await train.choose(stormNight);
    await train.stop();
    expect(store).toEqual({});
  });
});

describe('installSharedSelection', () => {
  it('opens session storage to content scripts', async () => {
    const { chromeApi, session } = makeChrome({ denied: true });
    await installSharedSelection({ chromeApi });
    expect(session.setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
  });

  it('does nothing without session storage, and survives a failure', async () => {
    await expect(installSharedSelection({ chromeApi: undefined })).resolves.toBeUndefined();
    const { chromeApi, session } = makeChrome();
    session.setAccessLevel.mockRejectedValueOnce(new Error('nope'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(installSharedSelection({ chromeApi })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
