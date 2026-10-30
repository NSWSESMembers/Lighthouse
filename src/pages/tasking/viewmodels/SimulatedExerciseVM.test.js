import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectionStatus } from '../../../shared/cadenceSimulation.js';
import { SimulatedExerciseVM } from './SimulatedExerciseVM.js';

vi.mock('../../../shared/cadenceSimulation.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, selectionStatus: vi.fn() };
});

const TRAIN_HOST = 'https://apitrainbeacon.ses.nsw.gov.au';
const PROD_HOST = 'https://apibeacon.ses.nsw.gov.au';
const LIVE = { selection: null, ended: null };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

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
const floodVale = {
  exerciseId: 'ex-grp',
  copyId: '102',
  exerciseName: 'Demo <b>flood</b> exercise',
  copyName: 'Demo Vale',
  mode: 'group',
  participantHqId: '102',
  copies: [
    { copyId: '101', participantHqId: '101', participantHqName: 'Demo City' },
    { copyId: '102', participantHqId: '102', participantHqName: 'Demo Vale' },
  ],
  selectedAt: 2000,
};
const ended = (selection, reason = 'ended') => ({ selection: null, ended: { selection, reason, endedAt: 5000 } });

// The shared choice, as sharedChoice() gives it: reports asynchronously, as
// chrome.storage does. `emit` is a change made anywhere else.
function makeShare(initial = LIVE) {
  let listener = null;
  const share = {
    watch: vi.fn((onChange) => {
      listener = onChange;
      setTimeout(() => onChange(initial), 0);
    }),
    stop: vi.fn(async () => {}),
    end: vi.fn(async () => true),
    emit: (state) => listener(state),
  };
  return share;
}

async function makeVM({ initial = LIVE, ...overrides } = {}) {
  const share = overrides.share !== undefined ? overrides.share : makeShare(initial);
  const deps = {
    host: TRAIN_HOST,
    getToken: vi.fn(async () => 'tok'),
    onSelectionChange: vi.fn(),
    openPage: vi.fn(),
    ...overrides,
    share,
  };
  const vm = new SimulatedExerciseVM(deps);
  await vm.ready;
  return { vm, deps, share };
}

beforeEach(() => {
  vi.mocked(selectionStatus).mockReset();
});

describe('availability', () => {
  it('is available on Train Beacon', async () => {
    const { vm } = await makeVM();
    expect(vm.available).toBe(true);
    expect(vm.environmentLabel).toBe('Train Beacon');
  });

  it('follows nothing on production, and never calls the backend there', async () => {
    const vm = new SimulatedExerciseVM({ host: PROD_HOST, getToken: vi.fn(), onSelectionChange: vi.fn() });
    await vm.ready;

    expect(vm.available).toBe(false);
    expect(vm.active()).toBe(false);
    expect(vm.feedSelection()).toBeNull();
    expect(vm.alertRules()).toEqual([]);
    await expect(vm.verifyStillRunning()).resolves.toBe(false);
    expect(selectionStatus).not.toHaveBeenCalled();
  });

  it('is ready even when the shared choice cannot be followed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const share = {
      watch: () => {
        throw new Error('no storage');
      },
    };
    const { vm } = await makeVM({ share });
    expect(vm.active()).toBe(false);
    warn.mockRestore();
  });
});

describe('following the choice', () => {
  it('starts with the exercise already chosen, leaving the first fetch to LAD', async () => {
    const { vm, deps } = await makeVM({ initial: { selection: floodVale, ended: null } });

    expect(vm.active()).toBe(true);
    expect(vm.activeLabel()).toBe('Demo <b>flood</b> exercise · Demo Vale');
    expect(vm.feedSelection()).toEqual({ exerciseId: 'ex-grp', copyId: '102', participantHqId: '102' });
    expect(deps.onSelectionChange).not.toHaveBeenCalled();
    expect(vm.noticeVisible()).toBe(false);
  });

  it('switches when another exercise is chosen, and refetches', async () => {
    const { vm, deps, share } = await makeVM({ initial: { selection: stormNight, ended: null } });
    const generation = vm.generation();
    vm.assetCount(4);

    share.emit({ selection: floodVale, ended: null });

    expect(vm.feedSelection().copyId).toBe('102');
    expect(vm.generation()).toBe(generation + 1);
    expect(vm.assetCount()).toBe(0);
    expect(deps.onSelectionChange).toHaveBeenCalledWith(floodVale);
  });

  it("doesn't refetch when the same copy is reported again", async () => {
    const { vm, deps, share } = await makeVM({ initial: { selection: stormNight, ended: null } });
    const generation = vm.generation();

    share.emit({
      selection: { ...stormNight, exerciseName: 'Demo storm night (renamed)', selectedAt: 3000 },
      ended: null,
    });

    expect(vm.generation()).toBe(generation);
    expect(deps.onSelectionChange).not.toHaveBeenCalled();
    expect(vm.activeLabel()).toBe('Demo storm night (renamed)');
  });

  it('starts showing an exercise chosen after LAD opened', async () => {
    const { vm, deps, share } = await makeVM();
    share.emit({ selection: stormNight, ended: null });
    expect(vm.active()).toBe(true);
    expect(deps.onSelectionChange).toHaveBeenCalledWith(stormNight);
  });

  it('goes back to live positions without a banner when the user stops elsewhere', async () => {
    const { vm, deps, share } = await makeVM({ initial: { selection: stormNight, ended: null } });

    share.emit(LIVE);

    expect(vm.active()).toBe(false);
    expect(deps.onSelectionChange).toHaveBeenCalledWith(null);
    expect(vm.noticeVisible()).toBe(false);
  });

  it('puts up the banner when the exercise it shows ended, wherever that was noticed', async () => {
    const { vm, deps, share } = await makeVM({ initial: { selection: floodVale, ended: null } });

    share.emit(ended(floodVale));

    expect(vm.active()).toBe(false);
    expect(deps.onSelectionChange).toHaveBeenCalledWith(null);
    expect(vm.noticeVisible()).toBe(true);
    expect(vm.noticeIsWarning()).toBe(false);
    expect(vm.noticeName()).toBe('Demo <b>flood</b> exercise · Demo Vale');
    expect(vm.noticeText()).toBe('has ended. Now showing live asset locations.');
    expect(vm.noticeLinkText()).toBe('Choose another exercise');
  });

  it('warns when the sign-in was refused', async () => {
    const { vm, share } = await makeVM({ initial: { selection: stormNight, ended: null } });

    share.emit(ended(stormNight, 'unavailable'));

    expect(vm.noticeIsWarning()).toBe(true);
    expect(vm.noticeName()).toBe('');
    expect(vm.noticeText()).toBe(
      "The CADence exercise service didn't accept your Train Beacon sign-in. Now showing live asset locations.",
    );
    expect(vm.noticeLinkText()).toBe('Open Simulated Exercise');
  });

  it('puts up no banner for an exercise it never showed', async () => {
    const opened = await makeVM({ initial: ended(stormNight) });
    expect(opened.vm.active()).toBe(false);
    expect(opened.vm.noticeVisible()).toBe(false);

    // Showing Demo Vale's copy, then told an older choice ended.
    const { vm, share } = await makeVM({ initial: { selection: floodVale, ended: null } });
    share.emit(ended({ ...floodVale, copyId: '101' }));
    expect(vm.active()).toBe(false);
    expect(vm.noticeVisible()).toBe(false);
  });

  it('clears the banner when another exercise is chosen', async () => {
    const { vm, share } = await makeVM({ initial: { selection: stormNight, ended: null } });
    share.emit(ended(stormNight));
    expect(vm.noticeVisible()).toBe(true);

    share.emit({ selection: floodVale, ended: null });
    expect(vm.noticeVisible()).toBe(false);
  });
});

describe('the banner', () => {
  it('opens the Simulated Exercise page from its link, and closes', async () => {
    const { vm, deps, share } = await makeVM({ initial: { selection: stormNight, ended: null } });
    share.emit(ended(stormNight));

    vm.chooseAnotherExercise({}, {}); // as a Knockout click binding calls it
    expect(deps.openPage).toHaveBeenCalledTimes(1);
    expect(vm.noticeVisible()).toBe(false);

    share.emit({ selection: stormNight, ended: null });
    share.emit(ended(stormNight));
    vm.dismissNotice({}, {});
    expect(vm.noticeVisible()).toBe(false);
    expect(deps.openPage).toHaveBeenCalledTimes(1);
  });
});

describe('stopping from LAD', () => {
  it('goes back to live positions everywhere, without a banner', async () => {
    const { vm, deps, share } = await makeVM({ initial: { selection: stormNight, ended: null } });

    vm.stop();
    await flush();

    expect(vm.active()).toBe(false);
    expect(share.stop).toHaveBeenCalledTimes(1);
    expect(deps.onSelectionChange).toHaveBeenCalledWith(null);
    expect(vm.noticeVisible()).toBe(false);
  });

  it('does nothing when nothing is showing, and survives storage failing', async () => {
    const { vm, share } = await makeVM();
    vm.stop();
    expect(share.stop).not.toHaveBeenCalled();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    share.emit({ selection: stormNight, ended: null });
    share.stop.mockRejectedValueOnce(new Error('storage gone'));
    vm.stop();
    await flush();
    expect(vm.active()).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('noticing the exercise has ended', () => {
  it('checks the exercise when the feed comes back empty, and keeps it while it runs', async () => {
    const { vm, share } = await makeVM({ initial: { selection: stormNight, ended: null } });
    vi.mocked(selectionStatus).mockResolvedValueOnce('running');

    vm.positionsReceived(0);
    await expect(vm.verifyStillRunning()).resolves.toBe(true);

    expect(selectionStatus).toHaveBeenCalledTimes(1);
    expect(selectionStatus).toHaveBeenCalledWith(stormNight, { host: TRAIN_HOST, token: 'tok' });
    expect(share.end).not.toHaveBeenCalled();
  });

  it("doesn't check while positions keep coming", async () => {
    const { vm } = await makeVM({ initial: { selection: stormNight, ended: null } });
    vm.positionsReceived(4);
    expect(vm.assetCount()).toBe(4);
    expect(selectionStatus).not.toHaveBeenCalled();
  });

  it('goes back to live positions, says why and ends it everywhere once it has ended', async () => {
    const { vm, deps, share } = await makeVM({ initial: { selection: floodVale, ended: null } });
    vi.mocked(selectionStatus).mockResolvedValueOnce('ended');

    await expect(vm.verifyStillRunning()).resolves.toBe(false);

    expect(share.end).toHaveBeenCalledWith(floodVale, 'ended');
    expect(deps.onSelectionChange).toHaveBeenCalledWith(null);
    expect(vm.noticeName()).toBe('Demo <b>flood</b> exercise · Demo Vale');

    // The shared choice then reports it ended: nothing more happens.
    deps.onSelectionChange.mockClear();
    share.emit(ended(floodVale));
    expect(deps.onSelectionChange).not.toHaveBeenCalled();
    expect(vm.noticeVisible()).toBe(true);
  });

  it('does the same, with a warning, when the sign-in is refused', async () => {
    const { vm, share } = await makeVM({ initial: { selection: stormNight, ended: null } });
    vi.mocked(selectionStatus).mockResolvedValueOnce('unavailable');

    await vm.verifyStillRunning();

    expect(share.end).toHaveBeenCalledWith(stormNight, 'unavailable');
    expect(vm.noticeIsWarning()).toBe(true);
  });

  it("keeps the exercise when the list can't be checked", async () => {
    const { vm, share } = await makeVM({ initial: { selection: stormNight, ended: null } });
    vi.mocked(selectionStatus).mockResolvedValueOnce('unknown');
    await expect(vm.verifyStillRunning()).resolves.toBe(true);
    expect(share.end).not.toHaveBeenCalled();
  });

  it('leaves a newer choice alone', async () => {
    const { vm, share } = await makeVM({ initial: { selection: stormNight, ended: null } });
    let answer;
    vi.mocked(selectionStatus).mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );

    const checking = vm.verifyStillRunning();
    await flush();
    share.emit({ selection: floodVale, ended: null }); // chosen while the list loads
    answer('ended');

    await expect(checking).resolves.toBe(true);
    expect(share.end).not.toHaveBeenCalled();
    expect(vm.feedSelection().exerciseId).toBe('ex-grp');
  });

  it('checks once at a time', async () => {
    const { vm } = await makeVM({ initial: { selection: stormNight, ended: null } });
    vi.mocked(selectionStatus).mockResolvedValue('running');
    await Promise.all([vm.verifyStillRunning(), vm.verifyStillRunning()]);
    expect(selectionStatus).toHaveBeenCalledTimes(1);
  });

  it('still goes back to live positions when the end cannot be recorded', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { vm, share } = await makeVM({ initial: { selection: stormNight, ended: null } });
    share.end.mockRejectedValueOnce(new Error('storage gone'));

    await vm.endHere('ended');

    expect(vm.active()).toBe(false);
    expect(vm.noticeVisible()).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('the map alert', () => {
  it('shows while simulated assets are on, with the count and an escaped label', async () => {
    const { vm, deps } = await makeVM({ initial: { selection: floodVale, ended: null } });
    vm.positionsReceived(4);

    const [rule] = vm.alertRules();
    expect(rule).toMatchObject({
      id: 'simulated-exercise',
      level: 'info',
      title: 'Simulated exercise assets',
      count: 4,
    });
    expect(rule.items[0].label).toBe('Demo &lt;b&gt;flood&lt;/b&gt; exercise · Demo Vale (change)');

    rule.onClick('change');
    expect(deps.openPage).toHaveBeenCalledTimes(1);
  });

  it('stops from its "stop" item', async () => {
    const { vm, share } = await makeVM({ initial: { selection: stormNight, ended: null } });
    vm.alertRules()[0].onClick('stop');
    await flush();
    expect(vm.active()).toBe(false);
    expect(share.stop).toHaveBeenCalledTimes(1);
    expect(vm.alertRules()).toEqual([]);
  });
});
