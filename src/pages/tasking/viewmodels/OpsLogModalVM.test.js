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

function makeJob(id = 'job1', identifier = '0015-0240') {
  return {
    id: ko.observable(id),
    identifier: ko.observable(identifier),
    taskings: ko.observableArray([]),
    taskingLoading: ko.observable(false),
    fetchTasking: vi.fn(),
  };
}

function makeTasking(status = 'Tasked', { job = makeJob(), callsign = 'Par Air', id = 't1' } = {}) {
  const t = new Tasking({ Id: id, CurrentStatus: status });
  t.job = job;
  t.team = makeTeam(callsign);
  job.taskings.push(t);
  return t;
}

function makeTeam(callsign, id = `team-${callsign}`) {
  return { id: () => id, callsign: ko.observable(callsign) };
}

function makeParent(jobs = [], teams = []) {
  const calls = [];
  return {
    calls,
    allTags: ko.observableArray([new Tag({ Id: 6, Name: 'Radio', TagGroupId: 3 })]),
    jobs: ko.observableArray(jobs),
    teams: ko.observableArray(teams),
    trackableAssets: ko.observableArray([]),
    applyTaskingStatusChange: vi.fn(async (tasking, action, payload) => { calls.push(['status', action, payload]); return {}; }),
    applyTaskTeam: vi.fn(async (team, job) => { calls.push(['task', team, job]); return [{ Id: 'new' }]; }),
    createOpsLogEntry: vi.fn((payload, cb) => { calls.push(['log', payload]); cb({ Id: 1 }); }),
    attachSendSMSModal: vi.fn((...args) => { calls.push(['sms', ...args]); }),
    reloadJobTaskings: vi.fn(async () => { calls.push(['reload']); return true; }),
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
    expect(vm.errorMessage()).toBe('Error: Tasking is already complete. Try again.');
    expect(modal.hide).not.toHaveBeenCalled();
    expect(vm.submitting()).toBe(false);
    expect(vm.pendingStatusKey()).toBe('Enroute'); // kept so they can retry
    expect(parent.reloadJobTaskings).not.toHaveBeenCalled(); // a 4xx is a real "no"
  });

  it('a 500 where the status change went through anyway still saves the log, and does not resend', async () => {
    parent.applyTaskingStatusChange.mockImplementationOnce(async () => { throw new BeaconApiError(500, 'Internal Server Error', 'u', ''); });
    parent.reloadJobTaskings.mockImplementationOnce(async () => { tasking.currentStatus('Onsite'); return true; });
    vm.pickPendingStatus(option(vm, 'Onsite'));

    await vm.submit();

    expect(parent.reloadJobTaskings).toHaveBeenCalledWith(tasking.job);
    expect(parent.applyTaskingStatusChange).toHaveBeenCalledTimes(1);
    expect(parent.createOpsLogEntry).toHaveBeenCalled();
    expect(vm.showError()).toBe(false);
    expect(modal.hide).toHaveBeenCalled();
  });

  it('a 500 where the status did not change reports the failure and keeps the draft', async () => {
    parent.applyTaskingStatusChange.mockRejectedValueOnce(new BeaconApiError(502, 'Bad Gateway', 'u', ''));
    vm.pickPendingStatus(option(vm, 'Enroute'));

    await vm.submit();

    expect(parent.reloadJobTaskings).toHaveBeenCalled();
    expect(parent.createOpsLogEntry).not.toHaveBeenCalled();
    expect(vm.errorMessage()).toBe('Error: Beacon returned 502 Bad Gateway. Try again.');
    expect(vm.pendingStatusKey()).toBe('Enroute');
  });

  it('a network error with a failed reload reports the failure', async () => {
    parent.applyTaskingStatusChange.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    parent.reloadJobTaskings.mockResolvedValueOnce(false);
    vm.pickPendingStatus(option(vm, 'Enroute'));

    await vm.submit();

    expect(parent.createOpsLogEntry).not.toHaveBeenCalled();
    expect(vm.errorMessage()).toBe("Error: Couldn't reach Beacon. Try again.");
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

  it('switching to another team on the same incident moves to its tasking and drops the draft', async () => {
    const other = makeTasking('Enroute', { job: tasking.job, callsign: 'DEM02', id: 't2' });
    vm.pickPendingStatus(option(vm, 'Untask'));
    vm.teamInput('DEM02');
    expect(vm.activeTasking()).toBe(other);
    expect(vm.currentStatusLabel()).toBe('Enroute');
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

describe('OpsLogModalVM finds the tasking from the Incident + Team fields', () => {
  let job, tasking, parent, vm;

  beforeEach(() => {
    job = makeJob('job7', '0015-5759');
    tasking = makeTasking('Onsite', { job, callsign: 'PAR31' });
    parent = makeParent([makeJob('job8', '0015-9999'), job]);
    vm = new CreateOpsLogModalVM(parent);
    vm.modalInstance = { hide: vi.fn() };
  });

  // what picking an incident suggestion does
  const pickJob = (j) => vm.pickJobSuggestion({ label: j.identifier(), job: j });

  it('blank dialog: picking the incident and typing the team shows the status change', async () => {
    await vm.openForRadioLog();
    expect(vm.showStatusChange()).toBe(false);
    pickJob(job);
    expect(vm.showStatusChange()).toBe(false);
    vm.teamInput('par31'); // case-insensitive
    expect(vm.activeTasking()).toBe(tasking);
    expect(vm.currentStatusLabel()).toBe('Onsite');
  });

  it('team row: adding the incident shows the status change, and submit uses that tasking', async () => {
    await vm.openForRadioLog({ teamCallsign: 'PAR31' });
    pickJob(job);
    expect(vm.showStatusChange()).toBe(true);

    vm.text('Leaving scene');
    vm.pickPendingStatus(option(vm, 'Offsite'));
    await vm.submit();
    expect(parent.applyTaskingStatusChange).toHaveBeenCalledWith(tasking, 'Offsite', expect.any(Object));
    expect(parent.createOpsLogEntry).toHaveBeenCalled();
  });

  it('also works in the plain Ops Log dialog opened from an incident', async () => {
    await vm.openForNewJobLog(job);
    vm.teamInput('PAR31');
    expect(vm.activeTasking()).toBe(tasking);
  });

  it('a picked asset counts as its matched team, even when its name differs from the callsign', async () => {
    await vm.openForRadioLog();
    pickJob(job);
    const asset = { name: ko.observable('Parramatta 31 Radio'), matchingTeams: ko.observableArray([tasking.team]) };
    vm.pickTeamSuggestion({ label: 'Parramatta 31 Radio', asset });
    expect(vm.activeTasking()).toBe(tasking);
  });

  it('stays hidden when that team is not tasked to the incident', async () => {
    await vm.openForRadioLog({ teamCallsign: 'DEM99' });
    pickJob(job);
    expect(vm.showStatusChange()).toBe(false);
  });

  it('typing the incident without picking it does not count (the log would not be attached to it)', async () => {
    await vm.openForRadioLog({ teamCallsign: 'PAR31' });
    vm.jobIdInput('0015-5759');
    expect(vm.showStatusChange()).toBe(false);
  });

  it('prefers the tasking whose status can still change when the team has several on the incident', async () => {
    const old = makeTasking('CalledOff', { job, callsign: 'PAR31', id: 'old' });
    job.taskings([old, tasking]);
    await vm.openForRadioLog({ teamCallsign: 'PAR31' });
    pickJob(job);
    expect(vm.activeTasking()).toBe(tasking);
  });

  it('loads the incident\'s taskings if they have not been fetched yet', async () => {
    const unloaded = makeJob('job9', '0015-1111');
    parent.jobs.push(unloaded);
    await vm.openForRadioLog({ teamCallsign: 'PAR31' });
    pickJob(unloaded);
    expect(unloaded.fetchTasking).toHaveBeenCalled();
    expect(job.fetchTasking).not.toHaveBeenCalled();
  });
});

describe('OpsLogModalVM Task Team (team not tasked to the incident)', () => {
  let job, team, parent, vm;

  beforeEach(async () => {
    job = makeJob('job7', '0015-5759');
    job.canTaskJob = ko.observable(true);
    team = makeTeam('DEM03');
    parent = makeParent([job], [makeTeam('DEM01'), team]);
    vm = new CreateOpsLogModalVM(parent);
    vm.modalInstance = { hide: vi.fn() };
    await vm.openForRadioLog({ teamCallsign: 'DEM03' });
    vm.pickJobSuggestion({ label: job.identifier(), job });
    vm.text('Tasking DEM03 to this one');
  });

  it('offers Task Team instead of the status change, and nothing is sent until Submit', () => {
    expect(vm.showStatusChange()).toBe(false);
    expect(vm.canTaskTeam()).toBe(true);
    expect(vm.resolvedTeam()).toBe(team);
    vm.toggleTaskTeam();
    expect(vm.submitLabel()).toBe('Submit & Task Team');
    expect(parent.applyTaskTeam).not.toHaveBeenCalled();
    vm.toggleTaskTeam(); // clicking again un-selects
    expect(vm.pendingTask()).toBe(null);
    expect(vm.submitLabel()).toBe('Submit');
  });

  it('Task Team: tasks first, then logs, then closes; no SMS', async () => {
    vm.toggleTaskTeam();
    await vm.submit();
    expect(parent.calls.map(c => c[0])).toEqual(['task', 'log']);
    expect(parent.applyTaskTeam).toHaveBeenCalledWith(team, job);
    expect(vm.modalInstance.hide).toHaveBeenCalled();
    expect(parent.attachSendSMSModal).not.toHaveBeenCalled();
  });

  it('Task Team & SMS: opens Send SMS for the team only after the log saved', async () => {
    vm.toggleTaskTeamSms();
    expect(vm.submitLabel()).toBe('Submit, Task Team & SMS');
    await vm.submit();
    expect(parent.calls.map(c => c[0])).toEqual(['task', 'log', 'sms']);
    expect(parent.attachSendSMSModal).toHaveBeenCalledWith([], team, null, job);
  });

  it('waits for the dialog\'s hidden event before opening Send SMS', async () => {
    const el = document.createElement('div');
    el.id = 'CreateOpsLogModal';
    document.body.appendChild(el);
    try {
      vm.toggleTaskTeamSms();
      await vm.submit();
      expect(vm.modalInstance.hide).toHaveBeenCalled();
      expect(parent.attachSendSMSModal).not.toHaveBeenCalled();
      el.dispatchEvent(new Event('hidden.bs.modal'));
      expect(parent.attachSendSMSModal).toHaveBeenCalledTimes(1);
    } finally {
      el.remove();
    }
  });

  it('does not log (or SMS) and shows an error when tasking fails', async () => {
    parent.applyTaskTeam.mockRejectedValueOnce(Object.assign(new Error('x'), { userMessage: "Beacon didn't create the tasking" }));
    vm.toggleTaskTeamSms();
    await vm.submit();
    expect(parent.createOpsLogEntry).not.toHaveBeenCalled();
    expect(parent.attachSendSMSModal).not.toHaveBeenCalled();
    expect(vm.errorMessage()).toBe("Error: Beacon didn't create the tasking. Try again.");
    expect(vm.pendingTask()).toBe('taskSms'); // kept for a retry
    expect(vm.modalInstance.hide).not.toHaveBeenCalled();
    expect(parent.reloadJobTaskings).not.toHaveBeenCalled();
  });

  it('a 500 where the tasking was created anyway still logs and opens the SMS, without tasking twice', async () => {
    parent.applyTaskTeam.mockRejectedValueOnce(new BeaconApiError(500, 'Internal Server Error', 'u', ''));
    parent.reloadJobTaskings.mockImplementationOnce(async () => {
      makeTasking('Tasked', { job, callsign: 'DEM03', id: 'created' });
      return true;
    });
    vm.toggleTaskTeamSms();

    await vm.submit();

    expect(parent.reloadJobTaskings).toHaveBeenCalledWith(job);
    expect(parent.calls.map(c => c[0])).toEqual(['log', 'sms']);
    expect(parent.applyTaskTeam).toHaveBeenCalledTimes(1);
    expect(vm.showError()).toBe(false);
  });

  it('a 500 where no tasking was created reports the failure', async () => {
    parent.applyTaskTeam.mockRejectedValueOnce(new BeaconApiError(500, 'Internal Server Error', 'u', ''));
    vm.toggleTaskTeam();

    await vm.submit();

    expect(parent.reloadJobTaskings).toHaveBeenCalledWith(job);
    expect(parent.createOpsLogEntry).not.toHaveBeenCalled();
    expect(vm.errorMessage()).toBe('Error: Beacon returned 500 Internal Server Error. Try again.');
  });

  it('if the log fails after tasking, a retry does not task again and still opens the SMS', async () => {
    parent.createOpsLogEntry.mockImplementationOnce((payload, cb) => cb(null));
    vm.toggleTaskTeamSms();
    await vm.submit();
    expect(vm.errorMessage()).toContain("DEM03 was tasked to 0015-5759, but the log entry didn't save");
    expect(parent.attachSendSMSModal).not.toHaveBeenCalled();

    await vm.submit();
    expect(parent.applyTaskTeam).toHaveBeenCalledTimes(1);
    expect(parent.attachSendSMSModal).toHaveBeenCalledTimes(1);
  });

  it('refuses if the team got tasked elsewhere while the dialog was open', async () => {
    vm.toggleTaskTeam();
    makeTasking('Tasked', { job, callsign: 'DEM03', id: 'elsewhere' });
    expect(vm.showStatusChange()).toBe(true);
    await vm.submit();
    expect(parent.applyTaskTeam).not.toHaveBeenCalled();
    expect(parent.createOpsLogEntry).not.toHaveBeenCalled();
    expect(vm.errorMessage()).toContain('has just been tasked to this incident');
  });

  it('a team whose only tasking here is finished can be tasked again', () => {
    makeTasking('CalledOff', { job, callsign: 'DEM03', id: 'old' });
    expect(vm.showStatusChange()).toBe(false);
    expect(vm.canTaskTeam()).toBe(true);
  });

  it('is not offered while the incident\'s taskings are loading, or when the incident can\'t be tasked', () => {
    job.taskingLoading(true);
    expect(vm.canTaskTeam()).toBe(false);
    job.taskingLoading(false);
    job.canTaskJob(false);
    expect(vm.canTaskTeam()).toBe(false);
  });

  it('is not offered when the Team field is not a known team', () => {
    vm.teamInput('NOBODY');
    expect(vm.canTaskTeam()).toBe(false);
  });

  it('changing the team drops the Task Team choice', () => {
    vm.toggleTaskTeam();
    vm.teamInput('DEM01');
    expect(vm.pendingTask()).toBe(null);
  });
});

describe('OpsLogModalVM picked status whose tasking stops being active', () => {
  it('refuses with a reason instead of logging without the status', async () => {
    const job = makeJob();
    const tasking = makeTasking('Tasked', { job });
    const parent = makeParent([job]);
    const vm = new CreateOpsLogModalVM(parent);
    vm.modalInstance = { hide: vi.fn() };
    await vm.openForRadioLog({ job, teamCallsign: 'Par Air', tasking });
    vm.text('x');
    vm.pickPendingStatus(option(vm, 'Enroute'));
    tasking.currentStatus('CalledOff'); // called off in Beacon
    await vm.submit();
    expect(parent.createOpsLogEntry).not.toHaveBeenCalled();
    expect(vm.errorMessage()).toContain('no longer active');
  });
});
