// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ko from 'knockout';

vi.mock('../utils/chromeRunTime.js', () => ({ openURLInBeacon: vi.fn() }));
vi.mock('../components/windowAlert.js', () => ({ showAlert: vi.fn(), closeAlert: vi.fn() }));

import { openURLInBeacon } from '../utils/chromeRunTime.js';
import { Team } from './Team.js';
import { loadSharedMapping } from '../utils/defaultAssetSync.js';

function assetStub(id, teams = 1) {
  return {
    id: ko.observable(id),
    matchingTeamsInView: () => Array.from({ length: teams }),
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('teamLeader / membersSorted', () => {
  it('finds the team leader by TeamLeader flag', () => {
    const t = new Team({
      Members: [
        { Person: { FirstName: 'A', LastName: 'One' }, TeamLeader: false },
        { Person: { FirstName: 'B', LastName: 'Two' }, TeamLeader: true },
      ],
    });
    expect(t.teamLeader()).toBe('B Two');
  });

  it('returns "-" when no member is flagged as leader', () => {
    const t = new Team({ Members: [{ Person: { FirstName: 'A', LastName: 'One' }, TeamLeader: false }] });
    expect(t.teamLeader()).toBe('-');
  });

  it('membersSorted puts the leader first', () => {
    const t = new Team({
      Members: [
        { Person: { FirstName: 'A' }, TeamLeader: false },
        { Person: { FirstName: 'B' }, TeamLeader: true },
        { Person: { FirstName: 'C' }, TeamLeader: false },
      ],
    });
    expect(t.membersSorted().map((m) => m.Person.FirstName)).toEqual(['B', 'A', 'C']);
  });
});

describe('defaultAsset / isDefaultAsset / trackableAssetEntries', () => {
  it('is null with no trackable assets', () => {
    const t = new Team({ Id: 'team1' });
    expect(t.defaultAsset()).toBeNull();
  });

  it('is the only asset when there is exactly one', () => {
    const t = new Team({ Id: 'team1' });
    const a = assetStub('a1');
    t.trackableAssets.push(a);
    expect(t.defaultAsset()).toBe(a);
  });

  it('falls back to the first asset with multiple assets and no shared mapping', () => {
    const t = new Team({ Id: 'team1' });
    const a1 = assetStub('a1');
    const a2 = assetStub('a2');
    t.trackableAssets.push(a1);
    t.trackableAssets.push(a2);
    expect(t.defaultAsset()).toBe(a1);
  });

  it('uses the shared mapping when it points at a known asset', () => {
    const t = new Team({ Id: 'team1' });
    const a1 = assetStub('a1');
    const a2 = assetStub('a2');
    t.trackableAssets.push(a1);
    t.trackableAssets.push(a2);
    localStorage.setItem('lh_sharedDefaultAssets', JSON.stringify({ team1: 'a2' }));
    expect(t.defaultAsset()).toBe(a2);
  });

  it('isDefaultAsset/isNotDefaultAsset agree with defaultAsset', () => {
    const t = new Team({ Id: 'team1' });
    const a1 = assetStub('a1');
    t.trackableAssets.push(a1);
    expect(t.isDefaultAsset(a1)).toBe(true);
    expect(t.isNotDefaultAsset(a1)).toBe(false);
  });

  it('trackableAssetEntries exposes isDefault/isNotDefault per asset', () => {
    const t = new Team({ Id: 'team1' });
    const a1 = assetStub('a1');
    const a2 = assetStub('a2');
    t.trackableAssets.push(a1);
    t.trackableAssets.push(a2);
    const entries = t.trackableAssetEntries();
    expect(entries.find((e) => e.asset === a1).isDefault).toBe(true);
    expect(entries.find((e) => e.asset === a2).isDefault).toBe(false);
  });

  it('trackableAssetsWithMultipleTeams filters to shared assets', () => {
    const t = new Team({ Id: 'team1' });
    t.trackableAssets.push(assetStub('a1', 1));
    t.trackableAssets.push(assetStub('a2', 2));
    expect(t.trackableAssetsWithMultipleTeams().map((a) => a.id())).toEqual(['a2']);
  });
});

describe('setDefaultAsset', () => {
  it('sets a new default and persists it to the shared mapping', () => {
    const t = new Team({ Id: 'team1' });
    const a1 = assetStub('a1');
    const a2 = assetStub('a2');
    t.trackableAssets.push(a1);
    t.trackableAssets.push(a2);
    t.setDefaultAsset(a2);
    expect(t.defaultAsset()).toBe(a2);
    expect(loadSharedMapping().team1).toBe('a2');
  });

  it('accepts an entry wrapper ({asset}) from trackableAssetEntries', () => {
    const t = new Team({ Id: 'team1' });
    const a1 = assetStub('a1');
    const a2 = assetStub('a2');
    t.trackableAssets.push(a1);
    t.trackableAssets.push(a2);
    t.setDefaultAsset({ asset: a2 });
    expect(t.defaultAsset()).toBe(a2);
  });

  it('clicking the current default (with >1 assets) clears it back to the [0] fallback', () => {
    const t = new Team({ Id: 'team1' });
    const a1 = assetStub('a1');
    const a2 = assetStub('a2');
    t.trackableAssets.push(a1);
    t.trackableAssets.push(a2);
    t.setDefaultAsset(a2); // a2 becomes default
    t.setDefaultAsset(a2); // clicked again -> clears
    expect(t.defaultAsset()).toBe(a1);
    expect(loadSharedMapping().team1).toBeUndefined();
  });

  it('claiming an asset removes it from another team that previously had it as default', () => {
    localStorage.setItem('lh_sharedDefaultAssets', JSON.stringify({ teamA: 'sharedAsset' }));
    const t = new Team({ Id: 'teamB' });
    const shared = assetStub('sharedAsset');
    // "other" pushed first so it's the [0] fallback -- otherwise "shared"
    // would already be teamB's fallback default, and setDefaultAsset would
    // take the toggle-OFF branch instead of the set-new-default branch.
    t.trackableAssets.push(assetStub('other'));
    t.trackableAssets.push(shared);
    t.setDefaultAsset(shared);
    const mapping = loadSharedMapping();
    expect(mapping.teamA).toBeUndefined();
    expect(mapping.teamB).toBe('sharedAsset');
  });
});

describe('currentTaskingSummary', () => {
  function taskingStub({ status, type, category }) {
    // filteredTaskings (which currentTaskingSummary reads) sorts every
    // filtered tasking by sequence()/currentStatusTime(), so both are
    // required on the stub even though the summary itself doesn't use them.
    return {
      currentStatus: () => status,
      sequence: () => 0,
      currentStatusTime: () => '2026-01-01T00:00:00.000Z',
      job: { type: () => type, categoriesName: () => category },
    };
  }

  it('counts taskings by job type', () => {
    const t = new Team({}, { teamTaskStatusFilter: () => ['Tasked'] });
    t.taskings.push(taskingStub({ status: 'Tasked', type: 'Storm' }));
    t.taskings.push(taskingStub({ status: 'Tasked', type: 'Storm' }));
    t.taskings.push(taskingStub({ status: 'Tasked', type: 'Rescue' }));
    expect(t.currentTaskingSummary()).toBe('Storm: 2, Rescue: 1');
  });

  it('breaks FR taskings down by category', () => {
    const t = new Team({}, { teamTaskStatusFilter: () => ['Tasked'] });
    t.taskings.push(taskingStub({ status: 'Tasked', type: 'FR', category: 'Category 1' }));
    t.taskings.push(taskingStub({ status: 'Tasked', type: 'FR', category: 'Category 1' }));
    t.taskings.push(taskingStub({ status: 'Tasked', type: 'FR', category: 'Category 2' }));
    // .replaceAll('Category', 'C') only strips the word, leaving the space
    // before the number ("Category 1" -> "C 1", not "C1").
    expect(t.currentTaskingSummary()).toBe('FR: 3 (C 1: 2, C 2: 1)');
  });

  it('is empty with no filtered taskings', () => {
    const t = new Team({}, { teamTaskStatusFilter: () => [] });
    expect(t.currentTaskingSummary()).toBe('');
  });
});

describe('filteredTaskings / displayedTaskings', () => {
  function taskingStub(id, status, sequence, statusTime) {
    return { id: ko.observable(id), currentStatus: () => status, sequence: ko.observable(sequence), currentStatusTime: () => statusTime };
  }

  it('filters to the statuses named by teamTaskStatusFilter', () => {
    const t = new Team({}, { teamTaskStatusFilter: () => ['Tasked', 'Enroute'] });
    t.taskings.push(taskingStub('t1', 'Tasked', 0, '2026-01-01'));
    t.taskings.push(taskingStub('t2', 'Complete', 0, '2026-01-01'));
    expect(t.filteredTaskings().map((x) => x.id())).toEqual(['t1']);
    expect(t.activeTaskingsCount()).toBe(1);
    expect(t.hiddenTaskingCount()).toBe(1);
  });

  it('sorts by sequence first, then by currentStatusTime descending', () => {
    const t = new Team({}, { teamTaskStatusFilter: () => ['Tasked'] });
    t.taskings.push(taskingStub('older-seq0', 'Tasked', 0, '2026-01-01T09:00:00Z'));
    t.taskings.push(taskingStub('newer-seq0', 'Tasked', 0, '2026-01-01T10:00:00Z'));
    t.taskings.push(taskingStub('seq1', 'Tasked', 1, '2026-01-01T08:00:00Z'));
    expect(t.filteredTaskings().map((x) => x.id())).toEqual(['newer-seq0', 'older-seq0', 'seq1']);
  });

  it('displayedTaskings follows reorderMode', () => {
    const t = new Team({}, { teamTaskStatusFilter: () => ['Tasked'] });
    const t1 = taskingStub('t1', 'Tasked', 0, '2026-01-01');
    t.taskings.push(t1);
    expect(t.displayedTaskings().map((x) => x.id())).toEqual(['t1']);
    t.enterReorderMode();
    expect(t.reorderMode()).toBe(true);
    expect(t.displayedTaskings()).toEqual(t.reorderList());
  });
});

describe('reorder mode', () => {
  function taskingStub(id, sequence = 0) {
    return { id: ko.observable(id), sequence: ko.observable(sequence), currentStatus: () => 'Tasked', currentStatusTime: () => '2026-01-01' };
  }

  it('moveTaskingUp/Down reorder within the snapshot list', () => {
    const t = new Team({}, { teamTaskStatusFilter: () => ['Tasked'] });
    const [a, b, c] = ['a', 'b', 'c'].map((id) => taskingStub(id));
    [a, b, c].forEach((x) => t.taskings.push(x));
    t.enterReorderMode();
    t.moveTaskingUp(b);
    expect(t.reorderList().map((x) => x.id())).toEqual(['b', 'a', 'c']);
    t.moveTaskingDown(b);
    expect(t.reorderList().map((x) => x.id())).toEqual(['a', 'b', 'c']);
  });

  it('moveTaskingUp/Down at the boundaries is a no-op', () => {
    const t = new Team({}, { teamTaskStatusFilter: () => ['Tasked'] });
    const [a, b] = ['a', 'b'].map((id) => taskingStub(id));
    [a, b].forEach((x) => t.taskings.push(x));
    t.enterReorderMode();
    t.moveTaskingUp(a); // already first
    expect(t.reorderList().map((x) => x.id())).toEqual(['a', 'b']);
    t.moveTaskingDown(b); // already last
    expect(t.reorderList().map((x) => x.id())).toEqual(['a', 'b']);
  });

  it('cancelReorderMode discards the snapshot', () => {
    const t = new Team({}, { teamTaskStatusFilter: () => ['Tasked'] });
    t.taskings.push(taskingStub('a'));
    t.enterReorderMode();
    t.cancelReorderMode();
    expect(t.reorderMode()).toBe(false);
    expect(t.reorderList()).toEqual([]);
  });

  it('saveReorder persists sequences and updates local values on success', async () => {
    const saveTaskingSequence = vi.fn().mockResolvedValue();
    const t = new Team({}, { teamTaskStatusFilter: () => ['Tasked'], saveTaskingSequence });
    const [a, b] = [taskingStub('a', 5), taskingStub('b', 9)];
    [a, b].forEach((x) => t.taskings.push(x));
    t.enterReorderMode();
    t.moveTaskingUp(b); // now [b, a]
    await t.saveReorder();

    expect(saveTaskingSequence).toHaveBeenCalledWith([
      { taskingId: 'b', sequence: 0 },
      { taskingId: 'a', sequence: 1 },
    ]);
    expect(b.sequence()).toBe(0);
    expect(a.sequence()).toBe(1);
    expect(t.reorderMode()).toBe(false);
    expect(t.reorderSaving()).toBe(false);
  });

  it('saveReorder logs and clears reorderSaving without leaving reorder mode on failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const saveTaskingSequence = vi.fn().mockRejectedValue(new Error('network down'));
    const t = new Team({}, { teamTaskStatusFilter: () => ['Tasked'], saveTaskingSequence });
    t.taskings.push(taskingStub('a'));
    t.enterReorderMode();
    await t.saveReorder();

    expect(errorSpy).toHaveBeenCalled();
    expect(t.reorderMode()).toBe(true); // not cleared on failure
    expect(t.reorderSaving()).toBe(false);
    errorSpy.mockRestore();
  });
});

describe('taskingRowColour', () => {
  it.each([
    [0, 'row-team-green'],
    [1, 'row-team-yellow'],
    [2, 'row-team-yellow'],
    [3, 'row-team-red'],
  ])('%i taskedJobCount -> %s', (count, expected) => {
    const t = new Team({ TaskedJobCount: count });
    expect(t.taskingRowColour()).toBe(expected);
  });
});

describe('updateStatusById', () => {
  it('resolves and sets the full TeamStatusType entry by id', () => {
    const t = new Team({});
    // Any valid TeamStatusType id from the enum -- verified indirectly via Name being populated.
    t.updateStatusById(1);
    expect(t.teamStatusType()).not.toBeNull();
    expect(t.teamStatusType().Id).toBe(1);
  });

  it('leaves teamStatusType untouched for an unknown id', () => {
    const t = new Team({ TeamStatusType: { Id: 1, Name: 'Existing' } });
    t.updateStatusById(999999);
    expect(t.teamStatusType().Name).toBe('Existing');
  });
});

describe('tasking list helpers', () => {
  it('addTaskingIfNotExists adds once and skips duplicates', () => {
    const t = new Team({});
    const job = { id: ko.observable('j1') };
    t.addTaskingIfNotExists(job);
    t.addTaskingIfNotExists(job);
    expect(t.taskings().filter((x) => x === job)).toHaveLength(1);
  });

  it('findTaskingById finds by id and returns undefined otherwise', () => {
    const t = new Team({});
    const tasking = { id: ko.observable('t1') };
    t.taskings.push(tasking);
    expect(t.findTaskingById('t1')).toBe(tasking);
    expect(t.findTaskingById('missing')).toBeUndefined();
  });

  it('addTaskingFromPayload delegates to the injected upsertTasking with teamContext', () => {
    const upsertTasking = vi.fn().mockReturnValue('created');
    const t = new Team({}, { upsertTasking, getTeamTasking: vi.fn() });
    const result = t.addTaskingFromPayload({ Id: 't1' });
    expect(upsertTasking).toHaveBeenCalledWith({ Id: 't1' }, { teamContext: t });
    expect(result).toBe('created');
  });

  it('upsertTaskingFromPayload adds the resulting tasking locally if not already present', () => {
    const newTasking = { id: ko.observable('t1') };
    const vm = { upsertTaskingFromPayload: vi.fn().mockReturnValue(newTasking) };
    const t = new Team({});
    t.upsertTaskingFromPayload(vm, { Id: 't1' });
    expect(vm.upsertTaskingFromPayload).toHaveBeenCalledWith({ Id: 't1' }, { teamContext: t });
    expect(t.taskings()).toContain(newTasking);
  });
});

describe('markerFocus', () => {
  it('does nothing when not filtered in', () => {
    const flyToAsset = vi.fn();
    const t = new Team({}, { flyToAsset });
    t.trackableAssets.push(assetStub('a1'));
    t.markerFocus();
    expect(flyToAsset).not.toHaveBeenCalled();
  });

  it('flies to the first asset when no popup is open', () => {
    const flyToAsset = vi.fn();
    const t = new Team({}, { flyToAsset, currentlyOpenMapPopup: () => null });
    t.isFilteredIn(true);
    const a1 = assetStub('a1');
    t.trackableAssets.push(a1);
    t.trackableAssets.push(assetStub('a2'));
    t.markerFocus();
    expect(flyToAsset).toHaveBeenCalledWith(a1);
  });

  it('cycles to the next asset when this team already has an asset popup open', () => {
    const flyToAsset = vi.fn();
    const t = new Team({}, { flyToAsset, currentlyOpenMapPopup: () => ({ kind: 'asset', id: 'a1' }) });
    t.isFilteredIn(true);
    const a2 = assetStub('a2');
    t.trackableAssets.push(assetStub('a1'));
    t.trackableAssets.push(a2);
    t.markerFocus();
    expect(flyToAsset).toHaveBeenCalledWith(a2);
  });

  it('wraps back to the first asset after the last', () => {
    const flyToAsset = vi.fn();
    const t = new Team({}, { flyToAsset, currentlyOpenMapPopup: () => ({ kind: 'asset', id: 'a2' }) });
    t.isFilteredIn(true);
    const a1 = assetStub('a1');
    t.trackableAssets.push(a1);
    t.trackableAssets.push(assetStub('a2'));
    t.markerFocus();
    expect(flyToAsset).toHaveBeenCalledWith(a1);
  });
});

describe('isPinned / togglePinned', () => {
  it('reflects the injected isTeamPinned predicate', () => {
    const t = new Team({ Id: 'team1' }, { isTeamPinned: (id) => id === 'team1' });
    expect(t.isPinned()).toBe(true);
  });

  it('togglePinned calls toggleTeamPinned with the team id', () => {
    const toggleTeamPinned = vi.fn();
    const t = new Team({ Id: 'team1' }, { toggleTeamPinned });
    t.togglePinned(null, { stopPropagation: vi.fn(), preventDefault: vi.fn() });
    expect(toggleTeamPinned).toHaveBeenCalledWith('team1');
  });
});

describe('toggle/expand/collapse and openBeaconEditTeam', () => {
  it('toggle/expand/collapse set expanded', () => {
    const t = new Team({});
    t.expand();
    expect(t.expanded()).toBe(true);
    t.collapse();
    expect(t.expanded()).toBe(false);
    t.toggle();
    expect(t.expanded()).toBe(true);
  });

  it('expanding triggers fetchTasking', () => {
    const getTeamTasking = vi.fn().mockResolvedValue({ results: [] });
    const t = new Team({ Id: 'team1' }, { getTeamTasking, upsertTasking: vi.fn() });
    // expand()'s subscriber calls fetchTasking() unforced, which is gated by
    // the single-fetch cooldown against lastTaskingDataUpdate -- back-date it
    // so the call isn't throttled away.
    t.lastTaskingDataUpdate = new Date(0);
    t.expand();
    expect(getTeamTasking).toHaveBeenCalled();
  });

  it('openBeaconEditTeam opens the team link in Beacon', () => {
    const t = new Team({ Id: 'team1' }, { makeTeamLink: (id) => `https://beacon.test/Teams/${id}` });
    const ev = { preventDefault: vi.fn() };
    t.openBeaconEditTeam(ev);
    expect(openURLInBeacon).toHaveBeenCalledWith('https://beacon.test/Teams/team1');
    expect(ev.preventDefault).toHaveBeenCalled();
  });
});

describe('sendSMS / sendSMSwithTasking / openRadioLogModal delegates', () => {
  it('sendSMS opens the SMS modal with just the team', () => {
    const openSMSTeamModal = vi.fn();
    const t = new Team({}, { openSMSTeamModal });
    t.sendSMS();
    expect(openSMSTeamModal).toHaveBeenCalledWith(t);
  });

  it('sendSMSwithTasking opens the SMS modal with the team and tasking', () => {
    const openSMSTeamModal = vi.fn();
    const t = new Team({}, { openSMSTeamModal });
    const tasking = {};
    t.sendSMSwithTasking(tasking);
    expect(openSMSTeamModal).toHaveBeenCalledWith(t, tasking);
  });

  it('openRadioLogModal delegates with the team', () => {
    const openRadioLogModal = vi.fn();
    const t = new Team({}, { openRadioLogModal });
    t.openRadioLogModal();
    expect(openRadioLogModal).toHaveBeenCalledWith(t);
  });
});

describe('fetchTasking', () => {
  it('does nothing when the required adapters are missing', () => {
    const t = new Team({});
    expect(() => t.fetchTasking()).not.toThrow();
  });

  it('fetches and upserts each tasking result when forced', async () => {
    const getTeamTasking = vi.fn().mockResolvedValue({ results: [{ Id: 't1' }, { Id: 't2' }] });
    const upsertTasking = vi.fn();
    const t = new Team({ Id: 'team1' }, { getTeamTasking, upsertTasking });
    // fetchTasking doesn't return its internal getTeamTasking(...).then().finally()
    // chain, so `await t.fetchTasking(...)` doesn't actually wait for it (every
    // real call site fires it and moves on rather than awaiting, so this is
    // dormant rather than a live bug) -- poll instead of awaiting the call itself.
    t.fetchTasking({ force: true });
    await vi.waitFor(() => expect(upsertTasking).toHaveBeenCalledTimes(2));
    expect(upsertTasking).toHaveBeenCalledWith({ Id: 't1' }, { teamContext: t });
    expect(t.taskingLoading()).toBe(false);
  });

  it('skips a redundant fetch within the cooldown window unless forced', async () => {
    const getTeamTasking = vi.fn().mockResolvedValue({ results: [] });
    const upsertTasking = vi.fn();
    const t = new Team({ Id: 'team1' }, { getTeamTasking, upsertTasking });
    // lastTaskingDataUpdate defaults to "now" (construction time), so an
    // unforced fetch right after construction should be throttled.
    t.fetchTasking();
    expect(getTeamTasking).not.toHaveBeenCalled();
    expect(t.taskingLoading()).toBe(false);
  });
});

describe('showCapabilities (shared singleton)', () => {
  it('toggleCapabilities flips the shared value for every team instance', () => {
    const t1 = new Team({});
    const t2 = new Team({});
    const before = t1.showCapabilities();
    t1.toggleCapabilities();
    expect(t1.showCapabilities()).toBe(!before);
    expect(t2.showCapabilities()).toBe(!before); // shared singleton
    t1.toggleCapabilities(); // restore, so other tests in this file aren't affected
  });
});

describe('updateFromJson', () => {
  it('applies simple scalar field changes', () => {
    const t = new Team({ Id: 'team1', Callsign: 'RESCUE1', TaskedJobCount: 0 });
    t.updateFromJson({ Callsign: 'RESCUE2', TaskedJobCount: 3 });
    expect(t.callsign()).toBe('RESCUE2');
    expect(t.taskedJobCount()).toBe(3);
  });

  it('resolves a reduced {Id}-only TeamStatusType via the enum', () => {
    const t = new Team({});
    t.updateFromJson({ TeamStatusType: { Id: 1 } });
    expect(t.teamStatusType().Name).toBeTruthy();
    expect(t.teamStatusType().Id).toBe(1);
  });

  it('does not overwrite teamStatusType when the id is unchanged', () => {
    const full = { Id: 1, Name: 'Original', Description: 'x' };
    const t = new Team({ TeamStatusType: full });
    t.updateFromJson({ TeamStatusType: { Id: 1 } });
    // Still the original full object, not replaced by the resolved enum entry
    expect(t.teamStatusType()).toBe(full);
  });

  it('resolves a reduced {Id}-only TeamType via the enum', () => {
    const t = new Team({});
    t.updateFromJson({ TeamType: { Id: 1 } });
    expect(t.teamType().Name).toBeTruthy();
  });

  it('replaces members only when membership actually changed', () => {
    const t = new Team({ Members: [{ Person: { Id: 1 }, TeamLeader: true }] });
    const sameMembers = [{ Person: { Id: 1 }, TeamLeader: true }];
    t.updateFromJson({ Members: sameMembers });
    expect(t.members()).not.toBe(sameMembers); // unchanged -> original array kept

    const changedMembers = [{ Person: { Id: 2 }, TeamLeader: true }];
    t.updateFromJson({ Members: changedMembers });
    expect(t.members()).toBe(changedMembers);
  });

  it('updates assignedTo only when the entity id differs', () => {
    const t = new Team({ AssignedTo: { Id: 'e1' } });
    const before = t.assignedTo();
    t.updateFromJson({ AssignedTo: { Id: 'e1' }, CreatedAt: null });
    expect(t.assignedTo()).toBe(before); // same id -> not replaced

    t.updateFromJson({ AssignedTo: { Id: 'e2' }, CreatedAt: null });
    expect(t.assignedTo()).not.toBe(before);
    expect(t.assignedTo().id()).toBe('e2');
  });

  it('resets the sector to empty when Sector is explicitly null', () => {
    const t = new Team({ Sector: { Id: 'sec1' } });
    expect(t.sector().id()).toBe('sec1');
    t.updateFromJson({ Sector: null });
    expect(t.sector().id()).toBeNull();
  });

  it('delegates to the existing sector.updateFromJson when Sector is given', () => {
    const t = new Team({});
    const spy = vi.spyOn(t.sector(), 'updateFromJson');
    t.updateFromJson({ Sector: { Id: 'sec2' } });
    expect(spy).toHaveBeenCalledWith({ Id: 'sec2' });
  });

  it('resolves status via statusId shorthand', () => {
    const t = new Team({});
    t.updateFromJson({ statusId: 1 });
    expect(t.teamStatusType()).not.toBeNull();
  });

  it('updates statusDate only when it actually changed', () => {
    const t = new Team({ TeamStatusStartDate: '2026-01-01T00:00:00.000Z' });
    const before = t.statusDate();
    t.updateFromJson({ TeamStatusStartDate: '2026-01-01T00:00:00.000Z' });
    expect(t.statusDate()).toBe(before);

    t.updateFromJson({ TeamStatusStartDate: '2026-01-02T00:00:00.000Z' });
    expect(t.statusDate()).not.toBe(before);
    expect(t.statusDate().toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });
});
