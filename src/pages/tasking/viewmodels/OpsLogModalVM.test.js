// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ko from 'knockout';

vi.mock('../utils/chromeRunTime.js', () => ({ openURLInBeacon: vi.fn() }));
vi.mock('../components/windowAlert.js', () => ({ showAlert: vi.fn(), closeAlert: vi.fn() }));

import { openURLInBeacon } from '../utils/chromeRunTime.js';
import { BeaconApiError } from '../../../shared/BeaconClient/core/request.js';
import { Tasking } from '../models/Tasking.js';
import { Tag } from '../models/Tag.js';
import { CreateOpsLogModalVM } from './OpsLogModalVM.js';

function makeTasking(status = 'Tasked') {
  const t = new Tasking({ Id: 't1', CurrentStatus: status });
  t.job = { id: ko.observable('job1'), identifier: ko.observable('0015-0240') };
  t.team = { id: () => 'team1', callsign: ko.observable('Par Air') };
  return t;
}

function makeParent() {
  const calls = [];
  return {
    calls,
    allTags: ko.observableArray([new Tag({ Id: 6, Name: 'Radio', TagGroupId: 3 })]),
    jobs: ko.observableArray([]),
    trackableAssets: ko.observableArray([]),
    applyTaskingStatusChange: vi.fn(async (tasking, action, payload) => { calls.push(['status', action, payload]); return {}; }),
    createOpsLogEntry: vi.fn((payload, cb) => { calls.push(['log', payload]); cb({ Id: 1 }); }),
  };
}

function option(vm, key) {
  return vm.statusOptions().find(o => o.key === key);
}

describe('OpsLogModalVM team status change', () => {
  let parent, vm, tasking, modal;

  beforeEach(async () => {
    vi.mocked(openURLInBeacon).mockReset();
    window.history.replaceState({}, '', '/?source=https://source.example');
    parent = makeParent();
    vm = new CreateOpsLogModalVM(parent);
    modal = { hide: vi.fn() };
    vm.modalInstance = modal;
    tasking = makeTasking();
    await vm.openForRadioLog({ job: tasking.job, teamCallsign: 'Par Air', tasking });
    vm.text('Team on scene');
  });

  it('is hidden when there is no tasking (blank / team radio log)', async () => {
    await vm.openForRadioLog({ teamCallsign: 'Par Air' });
    expect(vm.showStatusChange()).toBe(false);
  });

  it('shows the live current status and defaults to no change', () => {
    expect(vm.showStatusChange()).toBe(true);
    expect(vm.currentStatusLabel()).toBe('Tasked');
    expect(vm.pendingStatusLabel()).toBe('No change');
    expect(vm.submitLabel()).toBe('Submit');
  });

  it('sends nothing when a status is picked -- only on submit, status first then log', async () => {
    vm.pickPendingStatus(option(vm, 'Onsite'));
    vm.statusEtc('2026-01-01T14:30');
    expect(parent.applyTaskingStatusChange).not.toHaveBeenCalled();
    expect(vm.submitLabel()).toBe('Submit & On site');

    await vm.submit();

    expect(parent.calls.map(c => c[0])).toEqual(['status', 'log']);
    const [, action, payload] = parent.calls[0];
    expect(action).toBe('Onsite');
    expect(payload.estimatedCompletion).toMatch(/^2026-01-01T14:30:00/);
    expect(payload.overrideFutureStatuses).toBe('t1'); // Tasked -> Onsite skips Enroute
    expect(modal.hide).toHaveBeenCalled();
  });

  it('does not log and shows an error when the status change fails', async () => {
    parent.applyTaskingStatusChange.mockRejectedValueOnce(
      new BeaconApiError(400, 'Bad Request', 'u', JSON.stringify({ Message: 'Tasking is already complete' }))
    );
    vm.pickPendingStatus(option(vm, 'Enroute'));

    await vm.submit();

    expect(parent.createOpsLogEntry).not.toHaveBeenCalled();
    expect(vm.showError()).toBe(true);
    expect(vm.errorMessage()).toContain('Couldn\'t change Par Air to "En route"');
    expect(vm.errorMessage()).toContain('Tasking is already complete');
    expect(vm.errorMessage()).toContain('was not saved');
    expect(modal.hide).not.toHaveBeenCalled();
    expect(vm.submitting()).toBe(false);
    expect(vm.pendingStatusKey()).toBe('Enroute'); // kept so they can retry
  });

  it('if the log fails after the status landed, says so and does not resend the status on retry', async () => {
    parent.createOpsLogEntry.mockImplementationOnce((payload, cb) => cb(null));
    vm.pickPendingStatus(option(vm, 'CallOff'));
    vm.statusReason('Not required');

    await vm.submit();
    expect(vm.errorMessage()).toContain('Par Air was changed to "Call off", but the log entry didn\'t save');
    expect(vm.pendingStatusKey()).toBe(null);
    expect(parent.calls[0][2].ReasonForCallOff).toBe('Not required');

    await vm.submit();
    expect(parent.applyTaskingStatusChange).toHaveBeenCalledTimes(1);
    expect(parent.createOpsLogEntry).toHaveBeenCalledTimes(2);
    expect(modal.hide).toHaveBeenCalled();
  });

  it('Complete opens Beacon only after the log saves, with no status API call', async () => {
    vm.pickPendingStatus(option(vm, 'Complete'));
    expect(openURLInBeacon).not.toHaveBeenCalled();

    await vm.submit();

    expect(parent.applyTaskingStatusChange).not.toHaveBeenCalled();
    expect(parent.createOpsLogEntry).toHaveBeenCalled();
    expect(openURLInBeacon).toHaveBeenCalledWith('https://source.example/Jobs/job1?lhquickComplete=t1');
  });

  it('Complete does not open Beacon when the log fails', async () => {
    parent.createOpsLogEntry.mockImplementationOnce((payload, cb) => cb(null));
    vm.pickPendingStatus(option(vm, 'Complete'));
    await vm.submit();
    expect(openURLInBeacon).not.toHaveBeenCalled();
  });

  it('refuses to submit a status that stopped being valid while the modal was open', async () => {
    vm.pickPendingStatus(option(vm, 'Untask'));
    tasking.currentStatus('Onsite'); // e.g. a SignalR update
    expect(vm.pendingStatusUnavailable()).toBe(true);

    await vm.submit();

    expect(parent.applyTaskingStatusChange).not.toHaveBeenCalled();
    expect(parent.createOpsLogEntry).not.toHaveBeenCalled();
    expect(vm.errorMessage()).toContain('Par Air is now Onsite');
  });

  it('hides and clears the status change when the team or incident field is changed', () => {
    vm.pickPendingStatus(option(vm, 'Enroute'));
    vm.teamInput('Someone Else');
    expect(vm.showStatusChange()).toBe(false);
    expect(vm.pendingStatusKey()).toBe(null);
  });

  it('validates the log before touching the status', async () => {
    vm.text('');
    vm.pickPendingStatus(option(vm, 'Enroute'));
    await vm.submit();
    expect(parent.applyTaskingStatusChange).not.toHaveBeenCalled();
    expect(vm.errorMessage()).toContain('must enter text');
  });
});
