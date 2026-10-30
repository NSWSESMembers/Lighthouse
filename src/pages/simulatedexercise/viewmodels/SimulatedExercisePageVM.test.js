import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listExercises, SimulationFeedError } from '../../../shared/cadenceSimulation.js';
import { SimulatedExercisePageVM } from './SimulatedExercisePageVM.js';

vi.mock('../../../shared/cadenceSimulation.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, listExercises: vi.fn() };
});

const TRAIN_HOST = 'https://apitrainbeacon.ses.nsw.gov.au';
const PROD_HOST = 'https://apibeacon.ses.nsw.gov.au';
const LIVE = { selection: null, ended: null };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

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
// As the page stores them.
const individualChoice = {
  exerciseId: 'ex-ind',
  copyId: 'individual',
  exerciseName: 'Demo storm night',
  copyName: 'Demo City',
  mode: 'individual',
  participantHqId: '101',
  copies: individual.copies,
  selectedAt: 1000,
};
const groupChoice = (copyId) => {
  const copy = group.copies.find((c) => c.copyId === copyId);
  return {
    exerciseId: 'ex-grp',
    copyId,
    exerciseName: group.name,
    copyName: copy.participantHqName,
    mode: 'group',
    participantHqId: copy.participantHqId,
    copies: group.copies,
    selectedAt: 2000,
  };
};

// The shared choice: a little store with watchers, as sharedChoice() gives it.
function makeShare(initial = LIVE) {
  let state = initial;
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
    stop: vi.fn(async () => set(LIVE)),
    end: vi.fn(async (selection, reason) => {
      if (!state.selection || state.selection.exerciseId !== selection.exerciseId) return false;
      set({ selection: null, ended: { selection: state.selection, reason, endedAt: 5000 } });
      return true;
    }),
    emit: set,
    state: () => state,
  };
}

async function makeVM({ initial = LIVE, token = 'tok', ...overrides } = {}) {
  const share = overrides.share !== undefined ? overrides.share : makeShare(initial);
  const vm = new SimulatedExercisePageVM({ host: TRAIN_HOST, hqId: undefined, ...overrides, share });
  await flush(); // the first report of the shared choice
  return { vm, share, token };
}

// Gives the page its token and waits for the list it loads.
async function signIn(vm, token = 'tok') {
  vm.setToken(token);
  await flush();
  await flush();
}

beforeEach(() => {
  vi.mocked(listExercises).mockReset();
});

describe('availability', () => {
  it('is available on Train Beacon', async () => {
    const { vm } = await makeVM();
    expect(vm.available).toBe(true);
    expect(vm.environmentLabel).toBe('Train Beacon');
    expect(vm.pageTitle).toBe('CADence Simulated Exercise (Train Beacon)');
  });

  it('only explains itself on production, and never calls the backend there', async () => {
    const vm = new SimulatedExercisePageVM({ host: PROD_HOST });
    expect(vm.available).toBe(false);
    expect(vm.pageTitle).toBe('CADence Simulated Exercise');
    vm.setToken('prod-token');
    await expect(vm.refresh()).resolves.toBeNull();
    await vm.show();
    expect(listExercises).not.toHaveBeenCalled();
  });

  it('asks for nothing until it has a Beacon token, then loads the list once', async () => {
    vi.mocked(listExercises).mockResolvedValue([individual]);
    const { vm } = await makeVM();
    expect(vm.exerciseCaption()).toBe('Waiting for your Beacon sign-in…');
    expect(vm.pickerDisabled()).toBe(true);
    await expect(vm.refresh()).resolves.toBeNull();
    expect(listExercises).not.toHaveBeenCalled();

    await signIn(vm, 'tok-1');
    expect(listExercises).toHaveBeenCalledTimes(1);
    expect(listExercises).toHaveBeenCalledWith({ host: TRAIN_HOST, token: 'tok-1' });

    // A renewed token is used next time, without loading the list again now.
    vm.setToken('tok-2');
    await flush();
    expect(listExercises).toHaveBeenCalledTimes(1);
    await vm.refresh();
    expect(listExercises).toHaveBeenLastCalledWith({ host: TRAIN_HOST, token: 'tok-2' });
  });
});

describe('picking an exercise', () => {
  it('lists exercises and preselects the only individual copy', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([individual]);
    const { vm } = await makeVM();
    await signIn(vm);

    expect(vm.exercises()[0].label).toMatch(/^Demo storm night \(individual, started .+\)$/);
    expect(vm.chosenExerciseId()).toBe('ex-ind');
    expect(vm.chosenCopyId()).toBe('individual');
    expect(vm.needsCopyChoice()).toBe(false);
    expect(vm.canShow()).toBe(true);
    expect(vm.pickerDisabled()).toBe(false);
    expect(vm.message()).toBe('');
  });

  it('names the HQ of an individual exercise, with nothing to choose', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([individual, group]);
    const { vm } = await makeVM();
    await signIn(vm);
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
    const { vm } = await makeVM();
    await signIn(vm);

    expect(vm.exercises().map((e) => e.exerciseId)).toEqual(['ex-grp', 'ex-ind']);
    expect(vm.chosenExerciseId()).toBeUndefined();
    expect(vm.exerciseCaption()).toBe('Choose an exercise…');
    expect(vm.canShow()).toBe(false);
  });

  it('says so when nothing is running', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([]);
    const { vm } = await makeVM();
    await signIn(vm);

    expect(vm.noExercises()).toBe(true);
    expect(vm.pickerDisabled()).toBe(true);
    expect(vm.exerciseCaption()).toBe('No exercises running');
    expect(vm.message()).toBe('No exercises are running on Train Beacon right now.');
    expect(vm.messageIsError()).toBe(false);
  });

  it("preselects the user's own HQ copy of a group exercise", async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([group]);
    const { vm } = await makeVM({ hqId: 102 });
    await signIn(vm);

    expect(vm.needsCopyChoice()).toBe(true);
    expect(vm.copyCaption()).toBe('Choose a headquarters…');
    expect(vm.copyHelp()).toMatch(/^A group exercise gives each headquarters its own copy of the teams/);
    expect(vm.chosenCopyId()).toBe('102');
    expect(vm.canShow()).toBe(true);
  });

  it('leaves the copy for the user to pick when none is theirs', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([group]);
    const { vm } = await makeVM({ hqId: '999' });
    await signIn(vm);

    expect(vm.chosenCopyId()).toBeUndefined();
    expect(vm.canShow()).toBe(false);
    vm.chosenCopyId('101');
    expect(vm.canShow()).toBe(true);
  });

  it('resets the copy when the exercise changes', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([individual, group]);
    const { vm } = await makeVM();
    await signIn(vm);

    vm.chosenExerciseId('ex-ind');
    expect(vm.chosenCopyId()).toBe('individual');
    vm.chosenExerciseId('ex-grp');
    expect(vm.chosenCopyId()).toBeUndefined();
  });

  it('keeps the newest list when refreshes overlap', async () => {
    let first;
    vi.mocked(listExercises)
      .mockReturnValueOnce(new Promise((resolve) => (first = resolve)))
      .mockResolvedValueOnce([group]);
    const { vm } = await makeVM();
    vm.setToken('tok');
    const second = vm.refresh();
    await second;
    first([individual]);
    await flush();

    expect(vm.exercises().map((e) => e.exerciseId)).toEqual(['ex-grp']);
  });
});

describe('showing and stopping', () => {
  it('shows the chosen copy everywhere', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([group]);
    const { vm, share } = await makeVM({ hqId: '101' });
    await signIn(vm);
    expect(vm.showButtonText()).toBe('Show simulated assets');

    await vm.show({}, {}); // as a Knockout click binding calls it

    expect(share.choose).toHaveBeenCalledWith({
      exerciseId: 'ex-grp',
      copyId: '101',
      exerciseName: 'Demo <b>flood</b> exercise',
      copyName: 'Demo City',
      mode: 'group',
      participantHqId: '101',
      copies: group.copies,
      selectedAt: expect.any(Number),
    });
    expect(vm.active()).toBe(true);
    expect(vm.currentLabel()).toBe('Demo <b>flood</b> exercise · Demo City');
    // Already showing that copy: nothing to switch to until another is picked.
    expect(vm.canShow()).toBe(false);
    expect(vm.showButtonText()).toBe('Switch to this exercise');
    vm.chosenCopyId('102');
    expect(vm.canShow()).toBe(true);
  });

  it('does nothing when the choice is incomplete', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([group]);
    const { vm, share } = await makeVM();
    await signIn(vm);
    vm.chosenExerciseId('ex-grp');

    await vm.show();

    expect(share.choose).not.toHaveBeenCalled();
    expect(vm.active()).toBe(false);
  });

  it("says so when the choice can't be saved", async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(listExercises).mockResolvedValueOnce([individual]);
    const { vm, share } = await makeVM();
    await signIn(vm);
    share.choose.mockRejectedValueOnce(new Error('storage gone'));

    await vm.show();

    expect(vm.active()).toBe(false);
    expect(vm.message()).toBe("Couldn't show that exercise. Reload this page and try again.");
    expect(vm.messageIsError()).toBe(true);
    error.mockRestore();
  });

  it('goes back to real radio positions everywhere', async () => {
    const { vm, share } = await makeVM({ initial: { selection: individualChoice, ended: null } });
    expect(vm.active()).toBe(true);

    await vm.stop({}, {});

    expect(share.stop).toHaveBeenCalledTimes(1);
    expect(vm.active()).toBe(false);
    expect(vm.endedVisible()).toBe(false);
    await vm.stop();
    expect(share.stop).toHaveBeenCalledTimes(1);
  });
});

describe('following the choice', () => {
  it('shows what is chosen when it opens, and picks it once the list loads', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([individual, group]);
    const { vm } = await makeVM({ initial: { selection: groupChoice('102'), ended: null } });

    expect(vm.active()).toBe(true);
    expect(vm.currentLabel()).toBe('Demo <b>flood</b> exercise · Demo Vale');
    await signIn(vm);
    expect(vm.chosenExerciseId()).toBe('ex-grp');
    expect(vm.chosenCopyId()).toBe('102');
    expect(vm.canShow()).toBe(false);
  });

  it('keeps up with a change made elsewhere', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([individual, group]);
    const { vm, share } = await makeVM();
    await signIn(vm);

    share.emit({ selection: groupChoice('101'), ended: null }); // another tab of this page
    expect(vm.active()).toBe(true);
    expect(vm.chosenCopyId()).toBe('101');

    share.emit(LIVE); // LAD's map alert stopped it
    expect(vm.active()).toBe(false);
    expect(vm.endedVisible()).toBe(false);
  });

  it('says when the exercise that was showing ended', async () => {
    const { vm, share } = await makeVM({ initial: { selection: groupChoice('101'), ended: null } });

    share.emit({ selection: null, ended: { selection: groupChoice('101'), reason: 'ended', endedAt: 5000 } });

    expect(vm.active()).toBe(false);
    expect(vm.endedVisible()).toBe(true);
    expect(vm.endedIsWarning()).toBe(false);
    expect(vm.endedName()).toBe('Demo <b>flood</b> exercise · Demo City');
    expect(vm.endedText()).toBe('has ended, so Lighthouse went back to live asset locations.');
  });

  it('warns when the sign-in was refused', async () => {
    const { vm, share } = await makeVM();
    share.emit({ selection: null, ended: { selection: individualChoice, reason: 'unavailable', endedAt: 5000 } });

    expect(vm.endedIsWarning()).toBe(true);
    expect(vm.endedName()).toBe('');
    expect(vm.endedText()).toBe(
      'The CADence exercise service stopped accepting your Train Beacon sign-in, so Lighthouse went back to ' +
        'live asset locations. Reload Beacon and try again.',
    );
  });
});

describe('noticing the exercise has ended', () => {
  it('ends it everywhere once the exercise showing is no longer listed', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([individual]);
    const { vm, share } = await makeVM({ initial: { selection: groupChoice('101'), ended: null } });

    await signIn(vm);

    expect(share.end).toHaveBeenCalledWith(groupChoice('101'), 'ended');
    expect(vm.active()).toBe(false);
    expect(vm.endedVisible()).toBe(true);
    expect(vm.chosenExerciseId()).toBe('ex-ind'); // the only one left
  });

  it('keeps it while it is still listed', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([individual, group]);
    const { vm, share } = await makeVM({ initial: { selection: individualChoice, ended: null } });
    await signIn(vm);
    expect(share.end).not.toHaveBeenCalled();
    expect(vm.active()).toBe(true);
  });

  it('loads the list again when LAD or the situational awareness map records the end', async () => {
    vi.mocked(listExercises).mockResolvedValueOnce([individual, group]).mockResolvedValueOnce([group]);
    const { vm, share } = await makeVM({ initial: { selection: individualChoice, ended: null } });
    await signIn(vm);
    expect(vm.chosenExerciseId()).toBe('ex-ind');

    share.emit({ selection: null, ended: { selection: individualChoice, reason: 'ended', endedAt: 5000 } });
    await flush();

    expect(listExercises).toHaveBeenCalledTimes(2);
    expect(vm.exercises().map((e) => e.exerciseId)).toEqual(['ex-grp']);
    expect(vm.chosenExerciseId()).toBe('ex-grp'); // the only one left
    expect(vm.canShow()).toBe(false); // Demo Vale or Demo City still to pick

    // The same record reported again isn't a new end.
    share.emit({ selection: null, ended: { selection: individualChoice, reason: 'ended', endedAt: 5000 } });
    await flush();
    expect(listExercises).toHaveBeenCalledTimes(2);
  });

  it("doesn't load the list a second time for an end it recorded itself", async () => {
    vi.mocked(listExercises).mockResolvedValue([individual]);
    const { vm } = await makeVM({ initial: { selection: groupChoice('101'), ended: null } });
    await signIn(vm);
    await flush();
    expect(vm.endedVisible()).toBe(true);
    expect(listExercises).toHaveBeenCalledTimes(1);
  });

  it('waits for the sign-in before loading the list for an end recorded earlier', async () => {
    vi.mocked(listExercises).mockResolvedValue([group]);
    const { vm } = await makeVM({
      initial: { selection: null, ended: { selection: individualChoice, reason: 'ended', endedAt: 5000 } },
    });
    expect(vm.endedVisible()).toBe(true);
    expect(listExercises).not.toHaveBeenCalled();
    await signIn(vm);
    expect(listExercises).toHaveBeenCalledTimes(1);
  });

  it('checks again when the tab is shown, unless a check is running', async () => {
    vi.mocked(listExercises).mockResolvedValue([individual]);
    const { vm } = await makeVM();
    vm.pageShown();
    expect(listExercises).not.toHaveBeenCalled(); // no token yet
    await signIn(vm);

    vm.pageShown();
    vm.pageShown();
    await flush();
    expect(listExercises).toHaveBeenCalledTimes(2);
  });

  it('ends it everywhere when the backend refuses the sign-in', async () => {
    vi.mocked(listExercises).mockRejectedValueOnce(
      new SimulationFeedError('refused', { status: 403, unavailable: true }),
    );
    const { vm, share } = await makeVM({ initial: { selection: individualChoice, ended: null } });

    await signIn(vm);

    expect(vm.refused()).toBe(true);
    expect(vm.exerciseCaption()).toBe('Not available');
    expect(vm.message()).toBe(
      "The CADence exercise service didn't accept your Train Beacon sign-in, so simulated assets aren't available. " +
        'Reload Beacon and try again.',
    );
    expect(vm.messageIsError()).toBe(true);
    expect(share.end).toHaveBeenCalledWith(individualChoice, 'unavailable');
  });

  it("keeps it, and says so, when the list can't be loaded", async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(listExercises).mockRejectedValueOnce(new SimulationFeedError('CADence feed 502', { status: 502 }));
    const { vm, share } = await makeVM({ initial: { selection: individualChoice, ended: null } });

    await signIn(vm);

    expect(vm.message()).toBe("Couldn't load the exercise list. Check your connection and try again.");
    expect(vm.refused()).toBe(false);
    expect(share.end).not.toHaveBeenCalled();
    expect(vm.active()).toBe(true);
    error.mockRestore();
  });
});
