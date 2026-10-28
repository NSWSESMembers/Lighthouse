import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listExercises, SimulationFeedError } from '../../../shared/cadenceSimulation.js';
import { SimulatedExerciseVM } from './SimulatedExerciseVM.js';

vi.mock('../../../shared/cadenceSimulation.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, listExercises: vi.fn() };
});

const TRAIN_HOST = 'https://apitrainbeacon.ses.nsw.gov.au';
const PROD_HOST = 'https://apibeacon.ses.nsw.gov.au';
const STORAGE_KEY = 'lh-simulatedExercise-train';

function makeStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    raw: store,
  };
}

// Every value invented.
const individual = {
  exerciseId: 'ex-ind',
  name: 'Demo storm night',
  mode: 'individual',
  createdAt: '2026-10-15T09:00:00.000Z',
  copies: [{ copyId: 'individual', participantHqId: '101', participantHqName: 'Demo City' }],
};
const group = {
  exerciseId: 'ex-grp',
  name: 'Demo <b>flood</b> exercise',
  mode: 'group',
  createdAt: '2026-10-15T10:00:00.000Z',
  copies: [
    { copyId: '101', participantHqId: '101', participantHqName: 'Demo City' },
    { copyId: '102', participantHqId: '102', participantHqName: 'Demo Vale' },
  ],
};

function makeVM(overrides = {}) {
  const deps = {
    host: TRAIN_HOST,
    hqId: undefined,
    getToken: vi.fn(async () => 'tok'),
    storage: makeStorage(),
    onSelectionChange: vi.fn(),
    openPicker: vi.fn(),
    ...overrides,
  };
  return { vm: new SimulatedExerciseVM(deps), deps };
}

beforeEach(() => {
  vi.mocked(listExercises).mockReset();
});

describe('availability', () => {
  it('is offered on Train Beacon', () => {
    const { vm } = makeVM();
    expect(vm.available).toBe(true);
    expect(vm.environmentLabel).toBe('Train Beacon');
  });

  it('is not offered on production, and never calls the backend there', async () => {
    const storage = makeStorage({
      [STORAGE_KEY]: JSON.stringify({ exerciseId: 'ex-ind', copyId: 'individual', participantHqId: '101' }),
    });
    const { vm, deps } = makeVM({ host: PROD_HOST, storage });

    expect(vm.available).toBe(false);
    expect(vm.active()).toBe(false);
    expect(vm.feedSelection()).toBeNull();
    expect(vm.alertRules()).toEqual([]);
    await expect(vm.refresh()).resolves.toBeNull();
    expect(listExercises).not.toHaveBeenCalled();
    expect(deps.getToken).not.toHaveBeenCalled();
  });
});

describe('picking an exercise', () => {
  it('lists exercises newest first and preselects the only individual copy', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([individual]);
    const { vm, deps } = makeVM();

    await vm.refresh();

    expect(listExercises).toHaveBeenCalledWith({ host: TRAIN_HOST, token: 'tok' });
    expect(deps.getToken).toHaveBeenCalled();
    expect(vm.exercises()[0].label).toMatch(/^Demo storm night \(individual, started .+\)$/);
    expect(vm.chosenExerciseId()).toBe('ex-ind');
    expect(vm.chosenCopyId()).toBe('individual');
    expect(vm.needsCopyChoice()).toBe(false);
    expect(vm.canShow()).toBe(true);
    expect(vm.message()).toBe('');
  });

  it('names the HQ of an individual exercise, with nothing to choose', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([individual, group]);
    const { vm } = makeVM();
    await vm.refresh();
    expect(vm.showCopyChoice()).toBe(false); // no exercise chosen yet

    vm.chosenExerciseId('ex-ind');

    expect(vm.showCopyChoice()).toBe(true);
    expect(vm.needsCopyChoice()).toBe(false);
    expect(vm.copyCaption()).toBeUndefined();
    expect(vm.chosenCopies().map((c) => c.participantHqName)).toEqual(['Demo City']);
    expect(vm.copyHelp()).toBe('Simulated positions only go to teams assigned to this headquarters.');
  });

  it('orders several exercises newest first and lets the user choose', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([individual, group]);
    const { vm } = makeVM();

    await vm.refresh();

    expect(vm.exercises().map((e) => e.exerciseId)).toEqual(['ex-grp', 'ex-ind']);
    expect(vm.chosenExerciseId()).toBeUndefined();
    expect(vm.canShow()).toBe(false);
  });

  it('says so when nothing is running', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([]);
    const { vm } = makeVM();

    await vm.refresh();

    expect(vm.noExercises()).toBe(true);
    expect(vm.exerciseCaption()).toBe('No exercises running');
    expect(vm.message()).toBe('No exercises are running on Train Beacon right now.');
    expect(vm.messageIsError()).toBe(false);
  });

  it("preselects the user's own HQ copy of a group exercise", async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([group]);
    const { vm } = makeVM({ hqId: 102 });

    await vm.refresh();

    expect(vm.needsCopyChoice()).toBe(true);
    expect(vm.showCopyChoice()).toBe(true);
    expect(vm.copyCaption()).toBe('Choose a headquarters…');
    expect(vm.copyHelp()).toMatch(/^A group exercise gives each headquarters its own copy of the teams/);
    expect(vm.copyHelp()).toMatch(/Simulated positions only go to teams assigned to it\.$/);
    expect(vm.chosenCopyId()).toBe('102');
    expect(vm.canShow()).toBe(true);
  });

  it('leaves the copy for the user to pick when none is theirs', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([group]);
    const { vm } = makeVM({ hqId: '999' });

    await vm.refresh();

    expect(vm.chosenCopyId()).toBeUndefined();
    expect(vm.canShow()).toBe(false);
    vm.chosenCopyId('101');
    expect(vm.canShow()).toBe(true);
  });

  it('resets the copy when the exercise changes', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([individual, group]);
    const { vm } = makeVM();
    await vm.refresh();

    vm.chosenExerciseId('ex-ind');
    expect(vm.chosenCopyId()).toBe('individual');
    vm.chosenExerciseId('ex-grp');
    expect(vm.chosenCopyId()).toBeUndefined();
  });
});

describe('showing and stopping', () => {
  it('stores the selection for this tab and refetches', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([group]);
    const { vm, deps } = makeVM({ hqId: '101' });
    await vm.refresh();
    const generation = vm.generation();

    vm.show();

    expect(vm.active()).toBe(true);
    expect(vm.feedSelection()).toEqual({ exerciseId: 'ex-grp', copyId: '101', participantHqId: '101' });
    expect(vm.activeLabel()).toBe('Demo <b>flood</b> exercise · Demo City');
    expect(vm.generation()).toBe(generation + 1);
    expect(deps.onSelectionChange).toHaveBeenCalledTimes(1);
    expect(JSON.parse(deps.storage.getItem(STORAGE_KEY))).toEqual({
      exerciseId: 'ex-grp',
      copyId: '101',
      exerciseName: 'Demo <b>flood</b> exercise',
      copyName: 'Demo City',
      mode: 'group',
      participantHqId: '101',
      copies: group.copies,
      selectedAt: expect.any(Number),
    });
    // Already showing that copy: nothing to switch to until another is picked.
    expect(vm.canShow()).toBe(false);
    expect(vm.showButtonText()).toBe('Switch to this exercise');
    vm.chosenCopyId('102');
    expect(vm.canShow()).toBe(true);
  });

  it('does nothing when the choice is incomplete', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([group]);
    const { vm, deps } = makeVM();
    await vm.refresh();
    vm.chosenExerciseId('ex-grp');

    vm.show();

    expect(vm.active()).toBe(false);
    expect(deps.onSelectionChange).not.toHaveBeenCalled();
  });

  it('stops quietly when the user asks, even from a Knockout click binding', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([individual]);
    const { vm, deps } = makeVM();
    await vm.refresh();
    vm.show();

    vm.stopFromPicker({ some: 'root view model' }, { type: 'click' });

    expect(vm.active()).toBe(false);
    expect(vm.feedSelection()).toBeNull();
    expect(deps.storage.getItem(STORAGE_KEY)).toBeNull();
    expect(deps.onSelectionChange).toHaveBeenCalledTimes(2);
    expect(vm.notice()).toBeNull();
    expect(vm.noticeVisible()).toBe(false);
  });

  it('restores the selection after a reload of the tab', async () => {
    const storage = makeStorage({
      [STORAGE_KEY]: JSON.stringify({
        exerciseId: 'ex-ind',
        copyId: 'individual',
        exerciseName: 'Demo storm night',
        participantHqId: '101',
      }),
    });
    const { vm } = makeVM({ storage });

    expect(vm.active()).toBe(true);
    expect(vm.feedSelection()).toEqual({ exerciseId: 'ex-ind', copyId: 'individual', participantHqId: '101' });

    vi.mocked(listExercises).mockResolvedValueOnce([individual, group]);
    await vm.refresh();
    expect(vm.active()).toBe(true);
    expect(vm.chosenExerciseId()).toBe('ex-ind');
    expect(vm.chosenCopyId()).toBe('individual');
  });

  it('ignores junk in storage', () => {
    [
      'not json',
      '{"exerciseId":5,"copyId":"x","participantHqId":"101"}',
      '{"exerciseId":"","copyId":"x","participantHqId":"101"}',
      'null',
      // Without its HQ the copy's positions couldn't be kept to that HQ's teams.
      '{"exerciseId":"ex-ind","copyId":"individual"}',
      '{"exerciseId":"ex-ind","copyId":"individual","participantHqId":""}',
    ].forEach((raw) => {
      const { vm } = makeVM({ storage: makeStorage({ [STORAGE_KEY]: raw }) });
      expect(vm.active()).toBe(false);
    });
  });

  it('still works without storage', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([individual]);
    const { vm } = makeVM({ storage: null });
    await vm.refresh();
    vm.show();
    expect(vm.active()).toBe(true);
  });
});

describe('when the exercise goes away', () => {
  async function showing(exercise, overrides = {}) {
    vi.mocked(listExercises).mockResolvedValueOnce([exercise]);
    const made = makeVM(overrides);
    await made.vm.refresh();
    made.vm.show();
    made.deps.onSelectionChange.mockClear();
    return made;
  }

  it('returns to the live feed once the exercise is no longer listed, and says why', async () => {
    const { vm, deps } = await showing(group, { hqId: '101' });
    vi.mocked(listExercises).mockResolvedValueOnce([individual]);

    await vm.refresh();

    expect(vm.active()).toBe(false);
    expect(deps.storage.getItem(STORAGE_KEY)).toBeNull();
    expect(deps.onSelectionChange).toHaveBeenCalledWith(null);
    expect(vm.notice()).toEqual({ reason: 'ended', label: 'Demo <b>flood</b> exercise · Demo City' });
    expect(vm.noticeVisible()).toBe(true);
    expect(vm.noticeIsWarning()).toBe(false);
    // Plain text: the page binds these with `text:`, so the name isn't escaped here.
    expect(vm.noticeName()).toBe('Demo <b>flood</b> exercise · Demo City');
    expect(vm.noticeText()).toBe('has ended. Now showing live asset locations.');
    expect(vm.noticeLinkText()).toBe('Choose another exercise');
    // The picker says so too.
    expect(vm.message()).toBe('Demo <b>flood</b> exercise · Demo City has ended. Now showing live asset locations.');
    expect(vm.messageIsError()).toBe(false);
  });

  it('also ends when its copy is no longer listed', async () => {
    const { vm } = await showing(group, { hqId: '101' });
    vi.mocked(listExercises).mockResolvedValueOnce([{ ...group, copies: [group.copies[1]] }]);

    await vm.refresh();

    expect(vm.active()).toBe(false);
  });

  it('checks the list when the feed comes back empty, and keeps going if it is still running', async () => {
    const { vm } = await showing(individual);
    vi.mocked(listExercises).mockResolvedValueOnce([individual]);

    vm.positionsReceived(0);
    await expect(vm.verifyStillRunning()).resolves.toBe(true);

    expect(listExercises).toHaveBeenCalledTimes(2); // the picker's load plus one check
    expect(vm.active()).toBe(true);
    expect(vm.assetCount()).toBe(0);
  });

  it('does not check the list while positions are arriving', async () => {
    const { vm } = await showing(individual);

    vm.positionsReceived(3);

    expect(vm.assetCount()).toBe(3);
    expect(listExercises).toHaveBeenCalledTimes(1);
  });

  it('ends when an empty feed turns out to be an ended exercise', async () => {
    const { vm } = await showing(individual);
    vi.mocked(listExercises).mockResolvedValueOnce([]);

    vm.positionsReceived(0);
    await expect(vm.verifyStillRunning()).resolves.toBe(false);

    expect(vm.active()).toBe(false);
    expect(vm.notice()).toEqual({ reason: 'ended', label: 'Demo storm night' });
    expect(vm.noticeVisible()).toBe(true);
  });

  it('falls back when the backend refuses the sign-in', async () => {
    const { vm } = await showing(individual);
    vi.mocked(listExercises).mockRejectedValueOnce(
      new SimulationFeedError('CADence feed 403', { status: 403, unavailable: true }),
    );

    await vm.refresh();

    expect(vm.active()).toBe(false);
    expect(vm.messageIsError()).toBe(true);
    expect(vm.exercises()).toEqual([]);
    expect(vm.exerciseCaption()).toBe('Not available');
    expect(vm.notice()).toEqual({ reason: 'unavailable', label: 'Demo storm night' });
    expect(vm.noticeIsWarning()).toBe(true);
    expect(vm.noticeName()).toBe('');
    expect(vm.noticeText()).toBe(
      "The CADence exercise service didn't accept your Train Beacon sign-in. Now showing live asset locations.",
    );
    expect(vm.noticeLinkText()).toBe('Open Simulated Exercise settings');
    // The picker keeps its own explanation rather than the "has ended" one.
    expect(vm.message()).toContain("didn't accept your Train Beacon sign-in");

    // A later successful load clears it.
    vi.mocked(listExercises).mockResolvedValueOnce([]);
    await vm.refresh();
    expect(vm.exerciseCaption()).toBe('No exercises running');
    expect(vm.messageIsError()).toBe(false);
  });

  it('keeps the selection through a network error', async () => {
    const { vm } = await showing(individual);
    vi.mocked(listExercises).mockRejectedValueOnce(new SimulationFeedError('CADence feed request failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(vm.refresh()).resolves.toBeNull();

    consoleError.mockRestore();
    expect(vm.active()).toBe(true);
    expect(vm.messageIsError()).toBe(true);
    expect(vm.notice()).toBeNull();
  });

  it('ignores a slow list response that a newer refresh has overtaken', async () => {
    const { vm } = await showing(individual);
    let resolveSlow;
    vi.mocked(listExercises)
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSlow = resolve)))
      .mockResolvedValueOnce([individual]);

    const slow = vm.refresh();
    await vm.refresh();
    resolveSlow([]); // would end the exercise if it were applied
    await slow;

    expect(vm.active()).toBe(true);
    expect(vm.exercises().map((e) => e.exerciseId)).toEqual(['ex-ind']);
  });
});

describe('ended banner', () => {
  async function ended(overrides = {}) {
    vi.mocked(listExercises).mockResolvedValueOnce([individual, group]);
    const made = makeVM(overrides);
    await made.vm.refresh();
    made.vm.chosenExerciseId('ex-ind');
    made.vm.show();
    vi.mocked(listExercises).mockResolvedValueOnce([group]);
    made.vm.positionsReceived(0);
    await made.vm.verifyStillRunning();
    return made;
  }

  it('stays up until it is closed', async () => {
    const { vm } = await ended();
    expect(vm.noticeVisible()).toBe(true);

    // Later refreshes don't take it down by themselves.
    vi.mocked(listExercises).mockResolvedValueOnce([group]);
    await vm.refresh();
    expect(vm.noticeVisible()).toBe(true);

    vm.dismissNotice({ some: 'root view model' }, { type: 'click' });
    expect(vm.notice()).toBeNull();
    expect(vm.noticeVisible()).toBe(false);
  });

  it('is raised when the picker is what finds the exercise gone', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([individual]);
    const { vm } = makeVM();
    await vm.refresh();
    vm.show();

    vi.mocked(listExercises).mockResolvedValueOnce([]);
    await vm.refresh();

    expect(vm.active()).toBe(false);
    expect(vm.noticeVisible()).toBe(true);
    expect(vm.message()).toBe('Demo storm night has ended. Now showing live asset locations.');
  });

  it('links to the picker and goes away once used', async () => {
    const { vm, deps } = await ended();

    vm.chooseAnotherExercise({ some: 'root view model' }, { type: 'click' });

    expect(deps.openPicker).toHaveBeenCalledTimes(1);
    expect(vm.notice()).toBeNull();
  });

  it('goes away when another exercise is shown', async () => {
    const { vm } = await ended({ hqId: '102' });
    vm.chosenExerciseId('ex-grp');

    vm.show();

    expect(vm.active()).toBe(true);
    expect(vm.notice()).toBeNull();
  });

  it('still works without a picker to open', async () => {
    const { vm } = await ended({ openPicker: undefined });
    expect(() => vm.chooseAnotherExercise()).not.toThrow();
    expect(vm.notice()).toBeNull();
  });
});

describe('map alert', () => {
  it('shows only while simulated assets are showing', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([group]);
    const { vm, deps } = makeVM({ hqId: '102' });
    await vm.refresh();
    expect(vm.alertRules()).toEqual([]);

    vm.show();
    vm.positionsReceived(4);
    const [rule] = vm.alertRules();

    expect(rule).toMatchObject({ id: 'simulated-exercise', level: 'info', active: true, count: 4 });
    expect(rule.items.map((i) => i.id)).toEqual(['change', 'stop']);
    expect(rule.items[0].label).toBe('Demo &lt;b&gt;flood&lt;/b&gt; exercise · Demo Vale (change)');

    rule.onClick('change');
    expect(deps.openPicker).toHaveBeenCalledTimes(1);
    rule.onClick('stop');
    expect(vm.active()).toBe(false);
    expect(vm.alertRules()).toEqual([]);
  });
});

describe('sharing with Beacon pages', () => {
  function makeShare() {
    return { publish: vi.fn(() => Promise.resolve()) };
  }

  it('publishes what the tab shows, and null once it stops', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([group]);
    const share = makeShare();
    const { vm } = makeVM({ hqId: '101', share });
    await vm.refresh();
    expect(share.publish).not.toHaveBeenCalled();

    vm.show();
    expect(share.publish).toHaveBeenLastCalledWith({
      exerciseId: 'ex-grp',
      copyId: '101',
      exerciseName: 'Demo <b>flood</b> exercise',
      copyName: 'Demo City',
      mode: 'group',
      participantHqId: '101',
      copies: group.copies,
      selectedAt: expect.any(Number),
    });

    vm.stop('user');
    expect(share.publish).toHaveBeenLastCalledWith(null);
  });

  it('publishes a selection restored on reload, keeping when it was chosen', () => {
    const storage = makeStorage({
      [STORAGE_KEY]: JSON.stringify({
        exerciseId: 'ex-ind',
        copyId: 'individual',
        mode: 'individual',
        participantHqId: '101',
        copies: individual.copies,
        selectedAt: 1234,
      }),
    });
    const share = makeShare();
    makeVM({ storage, share });

    expect(share.publish).toHaveBeenCalledTimes(1);
    expect(share.publish.mock.calls[0][0]).toMatchObject({
      exerciseId: 'ex-ind',
      copyId: 'individual',
      participantHqId: '101',
      copies: individual.copies,
      selectedAt: 1234,
    });
  });

  it('withdraws from Beacon pages without losing the tab selection, and can publish it again', () => {
    const storage = makeStorage({
      [STORAGE_KEY]: JSON.stringify({ exerciseId: 'ex-ind', copyId: 'individual', participantHqId: '101' }),
    });
    const share = makeShare();
    const { vm } = makeVM({ storage, share });

    vm.withdrawFromBeacon();
    expect(share.publish).toHaveBeenLastCalledWith(null);
    expect(vm.active()).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();

    vm.publishToBeacon();
    expect(share.publish).toHaveBeenLastCalledWith(expect.objectContaining({ exerciseId: 'ex-ind' }));
  });

  it('shares nothing on production', () => {
    const { vm } = makeVM({ host: PROD_HOST, share: undefined });
    expect(() => vm.publishToBeacon()).not.toThrow();
    expect(() => vm.withdrawFromBeacon()).not.toThrow();
  });
});
