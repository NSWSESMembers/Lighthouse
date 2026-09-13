// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ko from 'knockout';
import moment from 'moment';

// openURLInBeacon touches the `chrome` global (undefined in this environment)
// and showAlert touches jQuery/Bootstrap DOM plumbing that isn't wired up in
// tests -- neither is what these tests are about, so stub them at the module
// boundary rather than pulling in a chrome mock / DOM fixture for every test.
vi.mock('../utils/chromeRunTime.js', () => ({ openURLInBeacon: vi.fn() }));
vi.mock('../components/windowAlert.js', () => ({ showAlert: vi.fn(), closeAlert: vi.fn() }));

import { openURLInBeacon } from '../utils/chromeRunTime.js';
import { showAlert } from '../components/windowAlert.js';
import { Tasking } from './Tasking.js';
import L from 'leaflet';

describe('status computeds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('derives statusSince/statusAgeSeconds/statusSetAt from currentStatusTime', () => {
    const t = new Tasking({ CurrentStatusTime: '2026-01-01T11:59:00.000Z' });
    expect(t.statusSince()).toEqual(new Date('2026-01-01T11:59:00.000Z'));
    expect(t.statusAgeSeconds()).toBe(60);
    // statusSetAt formats in the local timezone (moment's default), so
    // compare against moment's own formatting rather than a hardcoded string.
    expect(t.statusSetAt()).toBe(moment('2026-01-01T11:59:00.000Z').format('DD/MM/YYYY HH:mm:ss'));
  });

  it('is null/null/null when there is no currentStatusTime', () => {
    const t = new Tasking({});
    expect(t.statusSince()).toBeNull();
    expect(t.statusAgeSeconds()).toBeNull();
    expect(t.statusSetAt()).toBeNull();
  });

  it.each([
    [30, '30s ago'],
    [90, '1m ago'],
    [3600, '1h ago'],
    [3660, '1h 1m ago'],
  ])('formats statusTimeAgoLabel for %i seconds as %s', (seconds, label) => {
    const t = new Tasking({ CurrentStatusTime: new Date(Date.now() - seconds * 1000).toISOString() });
    expect(t.statusTimeAgoLabel()).toBe(label);
  });

  it('formats statusTimeAgoLabel as "-" with no status time', () => {
    const t = new Tasking({});
    expect(t.statusTimeAgoLabel()).toBe('-');
  });
});

describe('status flags', () => {
  it.each([
    ['Tasked', 'isTasked'],
    ['Enroute', 'isEnroute'],
    ['Onsite', 'isOnsite'],
    ['Offsite', 'isOffsite'],
    ['CalledOff', 'isCalledOff'],
    ['Untasked', 'isUntasked'],
  ])('sets only %s -> %s to true', (status, flagName) => {
    const t = new Tasking({ CurrentStatus: status });
    const allFlags = ['isTasked', 'isEnroute', 'isOnsite', 'isOffsite', 'isCalledOff', 'isUntasked'];
    allFlags.forEach((name) => {
      expect(t[name](), `${name} for status ${status}`).toBe(name === flagName);
    });
  });

  it('is case-insensitive', () => {
    const t = new Tasking({ CurrentStatus: 'ONSITE' });
    expect(t.isOnsite()).toBe(true);
  });

  it('isComplete reflects the complete flag, independent of currentStatus', () => {
    expect(new Tasking({ Complete: true }).isComplete()).toBe(true);
    expect(new Tasking({}).isComplete()).toBe(false);
  });
});

describe('tagColorFromStatus', () => {
  it.each([
    ['Tasked', 'bg-primary text-white'],
    ['Enroute', 'bg-info'],
    ['Onsite', 'bg-warning'],
    ['Complete', 'bg-success'],
    ['SomethingElse', 'bg-secondary text-white'],
  ])('maps %s -> %s', (status, expected) => {
    const t = new Tasking({ CurrentStatus: status });
    expect(t.tagColorFromStatus()).toBe(expected);
  });
});

describe('updateFrom', () => {
  it('applies a direct CurrentStatus string', () => {
    const t = new Tasking({ CurrentStatus: 'Tasked' });
    t.updateFrom({ CurrentStatus: 'Onsite' });
    expect(t.currentStatus()).toBe('Onsite');
  });

  it('resolves CurrentStatusId to a status name via the Enum when no CurrentStatus string is given', () => {
    const t = new Tasking({ CurrentStatus: 'Tasked' });
    t.updateFrom({ CurrentStatusId: 4 }); // Onsite
    expect(t.currentStatus()).toBe('Onsite');
    expect(t.currentStatusId()).toBe(4);
  });

  it('leaves currentStatus untouched for an unknown CurrentStatusId', () => {
    const t = new Tasking({ CurrentStatus: 'Tasked' });
    t.updateFrom({ CurrentStatusId: 99999 });
    expect(t.currentStatus()).toBe('Tasked');
  });

  it('patches only the fields present on the partial update', () => {
    const t = new Tasking({ Onsite: 'a', Offsite: 'b' });
    t.updateFrom({ Onsite: 'c' });
    expect(t.onsite()).toBe('c');
    expect(t.offsite()).toBe('b');
  });
});

describe('setJob', () => {
  function makeJobStub(id) {
    const taskings = ko.observableArray([]);
    return {
      id: ko.observable(id),
      taskings,
    };
  }

  it('pushes itself onto the new job.taskings list', () => {
    const t = new Tasking({ Id: 't1' });
    const job = makeJobStub('job1');
    t.setJob(job);
    expect(job.taskings().includes(t)).toBe(true);
  });

  it('does not push a duplicate if it is already on the list', () => {
    const t = new Tasking({ Id: 't1' });
    const job = makeJobStub('job1');
    t.setJob(job);
    t.setJob(job);
    expect(job.taskings().filter((x) => x === t)).toHaveLength(1);
  });

  it('removes itself from the previous job when reassigned to a new one', () => {
    const t = new Tasking({ Id: 't1' });
    const jobA = makeJobStub('jobA');
    const jobB = makeJobStub('jobB');

    t.setJob(jobA);
    expect(jobA.taskings().includes(t)).toBe(true);

    t.setJob(jobB);
    expect(jobA.taskings().includes(t)).toBe(false);
    expect(jobB.taskings().includes(t)).toBe(true);
  });

  it('still detaches correctly after self.job has been raw-reassigned externally', () => {
    // Mirrors main.js's own "set shared ref" pattern (tasking.job = job),
    // which bypasses setJob entirely on the first link.
    const t = new Tasking({ Id: 't1' });
    const jobA = makeJobStub('jobA');
    jobA.taskings.push(t);
    t.job = jobA;

    const jobB = makeJobStub('jobB');
    t.setJob(jobB);

    expect(jobA.taskings().includes(t)).toBe(false);
    expect(jobB.taskings().includes(t)).toBe(true);
  });

  it('is a no-op when set to the same job reference twice in a row', () => {
    const t = new Tasking({ Id: 't1' });
    const job = makeJobStub('job1');
    t.setJob(job);
    const pushSpy = vi.spyOn(job.taskings, 'push');
    t.setJob(job);
    expect(pushSpy).not.toHaveBeenCalled();
  });
});

describe('status-transition gating', () => {
  // [currentStatus, cannotUpdateStatus, isActiveStatus, canUntask, canEnroute, canCalloff, canOnsite, canOffsite, canComplete]
  it.each([
    ['Tasked', false, true, true, true, true, true, true, true],
    ['Enroute', false, true, false, false, true, true, true, true],
    ['Onsite', false, true, false, false, false, false, true, true],
    ['Offsite', false, true, false, false, false, false, false, true],
    ['CalledOff', true, false, false, false, false, false, false, false],
    ['Untasked', true, false, false, false, false, false, false, false],
  ])('gates transitions correctly from %s', (status, cannot, active, untask, enroute, calloff, onsite, offsite, complete) => {
    const t = new Tasking({ CurrentStatus: status });
    expect(t.cannotUpdateStatus(), 'cannotUpdateStatus').toBe(cannot);
    expect(t.isActiveStatus(), 'isActiveStatus').toBe(active);
    expect(t.canUntask(), 'canUntask').toBe(untask);
    expect(t.canEnroute(), 'canEnroute').toBe(enroute);
    expect(t.canCalloff(), 'canCalloff').toBe(calloff);
    expect(t.canOnsite(), 'canOnsite').toBe(onsite);
    expect(t.canOffsite(), 'canOffsite').toBe(offsite);
    expect(t.canComplete(), 'canComplete').toBe(complete);
  });

  it('gates every transition off once Complete is set, regardless of currentStatus', () => {
    // cannotUpdateStatus checks isComplete() directly, so the Complete flag
    // gates transitions off even while currentStatus is still e.g. "Tasked".
    const t = new Tasking({ CurrentStatus: 'Tasked', Complete: true });
    expect(t.isComplete()).toBe(true);
    expect(t.cannotUpdateStatus()).toBe(true);
    expect(t.canUntask()).toBe(false);
  });

  it('statusOptions.enabled mirrors the corresponding can* computed', () => {
    const t = new Tasking({ CurrentStatus: 'Enroute' });
    const options = t.statusOptions();
    const byKey = Object.fromEntries(options.map((o) => [o.key, o]));
    expect(byKey.Untask.enabled).toBe(t.canUntask());
    expect(byKey.Enroute.enabled).toBe(t.canEnroute());
    expect(byKey.CallOff.enabled).toBe(t.canCalloff());
    expect(byKey.Onsite.enabled).toBe(t.canOnsite());
    expect(byKey.Offsite.enabled).toBe(t.canOffsite());
    expect(byKey.Complete.enabled).toBe(t.canComplete());
  });
});

describe('quick ETA/ETC buttons', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds minutes to now when eta is unset', () => {
    const t = new Tasking({});
    t.onEtaQuickButtonClick({ minutes: 5 });
    expect(t.eta()).toBe('2026-06-15T10:05');
  });

  it('adds minutes on top of an existing eta rather than from now', () => {
    const t = new Tasking({});
    t.eta('2026-06-15T09:00');
    t.onEtaQuickButtonClick({ minutes: 10 });
    expect(t.eta()).toBe('2026-06-15T09:10');
  });

  it('rolls over into the next hour/day correctly', () => {
    const t = new Tasking({});
    t.etc('2026-06-15T23:55');
    t.onEtcQuickButtonClick({ minutes: 10 });
    expect(t.etc()).toBe('2026-06-16T00:05');
  });

  it('prevents default and stops propagation on the click event when given', () => {
    const t = new Tasking({});
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    t.onEtaQuickButtonClick({ minutes: 1 }, event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('tolerates a missing event', () => {
    const t = new Tasking({});
    expect(() => t.onEtaQuickButtonClick({ minutes: 1 })).not.toThrow();
  });
});

describe('onStatusOptionClick', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('is a no-op for a disabled option', () => {
    const t = new Tasking({ CurrentStatus: 'CalledOff' }); // cannotUpdateStatus -> everything disabled
    const before = t.statusDropdownPage();
    t.onStatusOptionClick({ key: 'Enroute', enabled: false });
    expect(t.statusDropdownPage()).toBe(before);
    expect(t.newStatus()).toBeNull();
  });

  it('is a no-op for a null option', () => {
    const t = new Tasking({});
    expect(() => t.onStatusOptionClick(null)).not.toThrow();
  });

  it('sets newStatus and flips the requested flags for Enroute (needsTimeSet + needsETA)', () => {
    const t = new Tasking({ CurrentStatus: 'Tasked' });
    t.onStatusOptionClick({ key: 'Enroute', label: 'En route', enabled: true, needsDetails: true, needsTimeSet: true, needsETA: true, needsETC: false, needsReason: false });
    expect(t.newStatus()).toBe('Enroute');
    expect(t.statusDropdownPage()).toBe('details');
    expect(t.needsTimeSet()).toBe(true);
    expect(t.needsETA()).toBe(true);
    expect(t.needsETC()).toBe(false);
    expect(t.needsReason()).toBe(false);
  });

  it('sets needsReason for CallOff', () => {
    const t = new Tasking({ CurrentStatus: 'Tasked' });
    t.onStatusOptionClick({ key: 'CallOff', enabled: true, needsDetails: true, needsTimeSet: false, needsETA: false, needsETC: false, needsReason: true });
    expect(t.needsReason()).toBe(true);
    expect(t.needsTimeSet()).toBe(false);
  });

  it('calls updateTaskingStatus immediately for Untask', () => {
    const t = new Tasking({ CurrentStatus: 'Tasked', Id: 't1' });
    t.team = { id: () => 'team1' };
    t.job = { id: () => 'job1', untaskTeam: vi.fn() };
    t.onStatusOptionClick({ key: 'Untask', enabled: true, needsDetails: false, needsTimeSet: false, needsETA: false, needsETC: false, needsReason: false });
    expect(t.job.untaskTeam).toHaveBeenCalledTimes(1);
  });

  it('opens the completion link in Beacon and shows an alert for Complete when a source param is present', () => {
    history.pushState({}, '', '?source=https://source.example/');
    const t = new Tasking({ CurrentStatus: 'Enroute', Id: 't1' });
    t.job = { id: () => 'job1' };
    t.onStatusOptionClick({ key: 'Complete', enabled: true, needsDetails: false, needsTimeSet: false, needsETA: false, needsETC: false, needsReason: false });
    expect(openURLInBeacon).toHaveBeenCalledWith('https://source.example/Jobs/job1?lhquickComplete=t1');
    expect(showAlert).toHaveBeenCalled();
    history.pushState({}, '', '/');
  });

  it('does not open a completion link for Complete when there is no source param', () => {
    history.pushState({}, '', '/');
    const t = new Tasking({ CurrentStatus: 'Enroute', Id: 't1' });
    t.job = { id: () => 'job1' };
    t.onStatusOptionClick({ key: 'Complete', enabled: true, needsDetails: false, needsTimeSet: false, needsETA: false, needsETC: false, needsReason: false });
    expect(openURLInBeacon).not.toHaveBeenCalled();
  });
});

describe('updateTaskingStatus payload construction', () => {
  function makeTasking(overrides = {}) {
    const t = new Tasking({ Id: 't1', CurrentStatus: 'Tasked', ...overrides });
    t.team = { id: () => 'team1' };
    t.job = { id: () => 'job1', updateTeamStatus: vi.fn(), callOffTeam: vi.fn(), untaskTeam: vi.fn() };
    return t;
  }

  it('sends a null estimatedCompletion for Enroute when eta is unset', () => {
    const t = makeTasking();
    t.newStatus('Enroute');
    t.updateTaskingStatus();
    const [, action, payload] = t.job.updateTeamStatus.mock.calls[0];
    expect(action).toBe('Enroute');
    expect(payload.estimatedCompletion).toBeNull();
  });

  it('formats a valid eta for Enroute', () => {
    const t = makeTasking();
    t.newStatus('Enroute');
    t.eta('2026-06-15T10:05');
    t.updateTaskingStatus();
    const [, , payload] = t.job.updateTeamStatus.mock.calls[0];
    expect(payload.estimatedCompletion).toBe(moment('2026-06-15T10:05').format('YYYY-MM-DDTHH:mm:ssZ'));
  });

  it('sets overrideFutureStatuses for Enroute only when not already Tasked', () => {
    const fromTasked = makeTasking({ CurrentStatus: 'Tasked' });
    fromTasked.newStatus('Enroute');
    fromTasked.updateTaskingStatus();
    expect(fromTasked.job.updateTeamStatus.mock.calls[0][2].overrideFutureStatuses).toBe(0);

    const fromOnsite = makeTasking({ CurrentStatus: 'Onsite', Id: 't2' });
    fromOnsite.newStatus('Enroute');
    fromOnsite.updateTaskingStatus();
    expect(fromOnsite.job.updateTeamStatus.mock.calls[0][2].overrideFutureStatuses).toBe('t2');
  });

  it('sets taskingId and a null estimatedCompletion for Offsite', () => {
    const t = makeTasking({ CurrentStatus: 'Onsite' });
    t.newStatus('Offsite');
    t.updateTaskingStatus();
    const [, action, payload] = t.job.updateTeamStatus.mock.calls[0];
    expect(action).toBe('Offsite');
    expect(payload.estimatedCompletion).toBeNull();
    expect(payload.taskingId).toBe('t1');
  });

  it('builds the full CallOff payload and routes to callOffTeam', () => {
    const t = makeTasking({ CurrentStatus: 'Enroute' });
    t.newStatus('CallOff');
    t.callOffReason('Weather');
    t.updateTaskingStatus();
    expect(t.job.updateTeamStatus).not.toHaveBeenCalled();
    const [, payload] = t.job.callOffTeam.mock.calls[0];
    expect(payload.TaskingId).toBe('t1');
    expect(payload.ReasonForCallOff).toBe('Weather');
    expect(payload.LighthouseFunction).toBe('callOffTeamFromJob');
  });

  it('strips timeLogged/description/overrideFutureStatuses and routes to untaskTeam for Untask', () => {
    const t = makeTasking();
    t.newStatus('Untask');
    t.updateTaskingStatus();
    const [, payload] = t.job.untaskTeam.mock.calls[0];
    expect(payload).not.toHaveProperty('timeLogged');
    expect(payload).not.toHaveProperty('description');
    expect(payload).not.toHaveProperty('overrideFutureStatuses');
    expect(payload.TeamId).toBe('team1');
    expect(payload.JobId).toBe('job1');
    expect(payload.LighthouseFunction).toBe('untaskTeamFromJob');
  });

  it('closes the status dropdown after submitting', () => {
    document.body.innerHTML = '<div class="tasking-dropdown-menu show"></div>';
    const t = makeTasking();
    t.newStatus('Enroute');
    t.updateTaskingStatus();
    expect(document.querySelector('.tasking-dropdown-menu.show')).toBeNull();
  });
});

describe('closeStatusDropdown', () => {
  it('removes "show" only from elements also carrying tasking-dropdown-menu', () => {
    document.body.innerHTML = `
      <div class="show tasking-dropdown-menu" id="a"></div>
      <div class="show" id="b"></div>
    `;
    const t = new Tasking({});
    t.closeStatusDropdown();
    expect(document.getElementById('a').classList.contains('show')).toBe(false);
    expect(document.getElementById('b').classList.contains('show')).toBe(true);
  });
});

describe('goBackFromDetails / onStatusDropdownToggleClick', () => {
  it('onStatusDropdownToggleClick resets the status-entry fields and switches to the status page', () => {
    const t = new Tasking({});
    t.needsTimeSet(true);
    t.eta('2026-01-01T00:00');
    t.callOffReason('x');
    t.onStatusDropdownToggleClick();
    expect(t.statusDropdownPage()).toBe('status');
    expect(t.needsTimeSet()).toBe(false);
    expect(t.eta()).toBeNull();
    expect(t.callOffReason()).toBeNull();
  });

  it('goBackFromDetails returns to the status page and clears the needs* flags but not the entered values', () => {
    const t = new Tasking({});
    t.statusDropdownPage('details');
    t.needsTimeSet(true);
    t.needsETA(true);
    t.eta('2026-01-01T00:00');
    t.goBackFromDetails();
    expect(t.statusDropdownPage()).toBe('status');
    expect(t.needsTimeSet()).toBe(false);
    expect(t.needsETA()).toBe(false);
    expect(t.eta()).toBe('2026-01-01T00:00'); // goBackFromDetails doesn't clear entered values
  });
});

describe('showTimeInput', () => {
  it('is true only when both needsTimeSet and timeOverrideEnabled are set', () => {
    const t = new Tasking({});
    expect(t.showTimeInput()).toBe(false);
    t.needsTimeSet(true);
    expect(t.showTimeInput()).toBe(false);
    t.timeOverrideEnabled(true);
    expect(t.showTimeInput()).toBe(true);
  });
});

describe('sendSMS / openRadioLogModal (thin delegates)', () => {
  it('sendSMS delegates to team.sendSMSwithTasking(self)', () => {
    const t = new Tasking({});
    t.team = { sendSMSwithTasking: vi.fn() };
    t.sendSMS();
    expect(t.team.sendSMSwithTasking).toHaveBeenCalledWith(t);
  });

  it('openRadioLogModal delegates to job.openRadioLogModal(self)', () => {
    const t = new Tasking({});
    t.job = { openRadioLogModal: vi.fn() };
    t.openRadioLogModal();
    expect(t.job.openRadioLogModal).toHaveBeenCalledWith(t);
  });
});

describe('getTeamLatLng', () => {
  it('returns null when there is no team', () => {
    const t = new Tasking({});
    t.team = null;
    expect(t.getTeamLatLng()).toBeNull();
  });

  it('prefers the default trackable asset over team HQ', () => {
    const t = new Tasking({});
    t.team = {
      trackableAssets: () => [{ latitude: -33.8, longitude: 151.2 }],
      defaultAsset: () => ({ latitude: -33.9, longitude: 151.3 }),
      assignedTo: { latitude: -34, longitude: 151 },
    };
    const ll = t.getTeamLatLng();
    expect(ll).toEqual(L.latLng(-33.9, 151.3));
  });

  it('falls back to the first trackable asset when there is no defaultAsset', () => {
    const t = new Tasking({});
    t.team = {
      trackableAssets: () => [{ latitude: -33.8, longitude: 151.2 }],
      defaultAsset: null,
      assignedTo: { latitude: -34, longitude: 151 },
    };
    expect(t.getTeamLatLng()).toEqual(L.latLng(-33.8, 151.2));
  });

  it('falls back to assignedTo (team HQ) when there are no trackable assets', () => {
    const t = new Tasking({});
    t.team = {
      trackableAssets: () => [],
      assignedTo: { latitude: -34, longitude: 151 },
    };
    expect(t.getTeamLatLng()).toEqual(L.latLng(-34, 151));
  });

  it('unwraps ko-observable lat/lng values', () => {
    const t = new Tasking({});
    t.team = {
      trackableAssets: () => [],
      assignedTo: { latitude: ko.observable(-34), longitude: ko.observable(151) },
    };
    expect(t.getTeamLatLng()).toEqual(L.latLng(-34, 151));
  });

  it('returns null when the assignedTo coordinates are not finite', () => {
    const t = new Tasking({});
    // +null coerces to 0 (finite); use undefined (+undefined === NaN) to
    // actually exercise the "no usable coordinates" branch.
    t.team = { trackableAssets: () => [], assignedTo: { latitude: undefined, longitude: undefined } };
    expect(t.getTeamLatLng()).toBeNull();
  });
});

describe('getJobLatLng', () => {
  it('returns null when there is no job', () => {
    const t = new Tasking({});
    t.job = null;
    expect(t.getJobLatLng()).toBeNull();
  });

  it('returns the job address as a LatLng when finite', () => {
    const t = new Tasking({});
    t.job = { address: { latitude: -33.8, longitude: 151.2 } };
    expect(t.getJobLatLng()).toEqual(L.latLng(-33.8, 151.2));
  });

  it('returns null when the job address coordinates are not finite', () => {
    const t = new Tasking({});
    t.job = { address: { latitude: undefined, longitude: undefined } };
    expect(t.getJobLatLng()).toBeNull();
  });
});

describe('updateTaskingStatus -- remaining branches', () => {
  function makeTasking(overrides = {}) {
    const t = new Tasking({ Id: 't1', CurrentStatus: 'Tasked', ...overrides });
    t.team = { id: () => 'team1' };
    t.job = { id: () => 'job1', updateTeamStatus: vi.fn(), callOffTeam: vi.fn(), untaskTeam: vi.fn() };
    return t;
  }

  it('formats a valid etc for Onsite', () => {
    const t = makeTasking({ CurrentStatus: 'Enroute' });
    t.newStatus('Onsite');
    t.etc('2026-06-15T11:00');
    t.updateTaskingStatus();
    const [, action, payload] = t.job.updateTeamStatus.mock.calls[0];
    expect(action).toBe('Onsite');
    expect(payload.estimatedCompletion).toBe(moment('2026-06-15T11:00').format('YYYY-MM-DDTHH:mm:ssZ'));
  });

  it('sends a null estimatedCompletion for Onsite when etc is unset', () => {
    const t = makeTasking({ CurrentStatus: 'Enroute' });
    t.newStatus('Onsite');
    t.updateTaskingStatus();
    const [, , payload] = t.job.updateTeamStatus.mock.calls[0];
    expect(payload.estimatedCompletion).toBeNull();
  });

  it('sets overrideFutureStatuses for Onsite only when not already Enroute', () => {
    const t = makeTasking({ CurrentStatus: 'Onsite' }); // i.e. skipped straight to Onsite
    t.newStatus('Onsite');
    t.updateTaskingStatus();
    expect(t.job.updateTeamStatus.mock.calls[0][2].overrideFutureStatuses).toBe('t1');
  });

  it('sets overrideFutureStatuses for Offsite only when not already Onsite', () => {
    const t = makeTasking({ CurrentStatus: 'Enroute' }); // skipped straight to Offsite
    t.newStatus('Offsite');
    t.updateTaskingStatus();
    expect(t.job.updateTeamStatus.mock.calls[0][2].overrideFutureStatuses).toBe('t1');
  });

  it('logs an error and does not throw when the Enroute/Onsite/Offsite callback receives a falsy result', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const t = makeTasking();
    t.newStatus('Enroute');
    t.updateTaskingStatus();
    const callback = t.job.updateTeamStatus.mock.calls[0][3];
    expect(() => callback(null)).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs an error and does not throw when the CallOff callback receives a falsy result', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const t = makeTasking({ CurrentStatus: 'Enroute' });
    t.newStatus('CallOff');
    t.updateTaskingStatus();
    const callback = t.job.callOffTeam.mock.calls[0][2];
    expect(() => callback(null)).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs an error and does not throw when the Untask callback receives a falsy result', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const t = makeTasking();
    t.newStatus('Untask');
    t.updateTaskingStatus();
    const callback = t.job.untaskTeam.mock.calls[0][2];
    expect(() => callback(null)).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
