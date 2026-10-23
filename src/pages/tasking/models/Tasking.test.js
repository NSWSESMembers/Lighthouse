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
import { Tasking, etaInfoFor, primaryEtaTasking, ETA_ALERT_MINUTES, canCallOffFromHistory } from './Tasking.js';
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

  it('adds minutes on top of an eta still ahead; the label counts from the status time', () => {
    const t = new Tasking({});
    t.eta('2026-06-15T10:20');
    expect(t.etaQuickLabel()).toBe('From now (10:00): +20m');
    t.onEtaQuickButtonClick({ minutes: 10 });
    t.onEtaQuickButtonClick({ minutes: 10 });
    expect(t.eta()).toBe('2026-06-15T10:40');
    expect(t.etaQuickLabel()).toBe('From now (10:00): +40m'); // "from" stays put, the total grows
  });

  it('counts from the override time when one is set, and only that moves "from"', () => {
    const t = new Tasking({});
    t.timeOverrideEnabled(true);
    t.time('2026-06-15T09:30');
    expect(t.etcQuickLabel()).toBe('From 09:30, add:');
    t.onEtcQuickButtonClick({ minutes: 15 });
    expect(t.etc()).toBe('2026-06-15T09:45');
    t.etc('2026-06-15T10:30'); // picking an ETC doesn't move "from"
    expect(t.etcQuickLabel()).toBe('From 09:30: +1h');
    t.time('2026-06-15T09:40');
    expect(t.etcQuickLabel()).toBe('From 09:40: +50m');
  });

  it('counts from the status time when the eta picked is earlier', () => {
    const t = new Tasking({});
    t.eta('2026-06-15T09:00');
    expect(t.etaQuickLabel()).toBe('From now (10:00), add:');
    t.onEtaQuickButtonClick({ minutes: 10 });
    expect(t.eta()).toBe('2026-06-15T10:10');
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

describe('ETA / ETC', () => {
  // Beacon's estimates are offset-free local times, like currentStatusTime.
  const NOW = new Date(2026, 9, 15, 10, 0, 0);
  const local = (mins) => moment(NOW).add(mins, 'minutes').format('YYYY-MM-DDTHH:mm:ss');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('etaInfoFor', () => {
    it('uses the ETA while Enroute and the ETC while Onsite', () => {
      expect(etaInfoFor('Enroute', local(9), local(40)).kind).toBe('ETA');
      expect(etaInfoFor('Onsite', local(9), local(40)).kind).toBe('ETC');
      expect(etaInfoFor('Onsite', local(9), local(40)).minutesLeft).toBe(40);
    });

    it('is null in other statuses or without an estimate', () => {
      expect(etaInfoFor('Tasked', local(9), local(40))).toBeNull();
      expect(etaInfoFor('Offsite', local(9), local(40))).toBeNull();
      expect(etaInfoFor('Enroute', null, local(40))).toBeNull();
      expect(etaInfoFor('Onsite', local(9), null)).toBeNull();
      expect(etaInfoFor('Enroute', 'not a date', null)).toBeNull();
    });

    it('is on track, then due soon within 5 minutes', () => {
      const ok = etaInfoFor('Enroute', local(9), null);
      expect(ok.state).toBe('ok');
      expect(ok.label).toBe('ETA 9m');
      expect(ok.clockLabel).toBe('ETA 10:09 · 9m');
      expect(ok.title).toBe('Estimated arrival 10:09 (in 9m)');
      expect(ok.chipClass).toBe('eta-chip--ok');
      expect(ok.iconClass).toBe('fa-clock');

      const soon = etaInfoFor('Onsite', null, local(5));
      expect(soon.state).toBe('soon');
      expect(soon.label).toBe('ETC 5m');
    });

    it('rounds time left up, so it reads 1m until the moment it is due', () => {
      expect(etaInfoFor('Enroute', moment(NOW).add(20, 'seconds').format('YYYY-MM-DDTHH:mm:ss'), null).label).toBe('ETA 1m');
    });

    it('reads "now" at the due time and counts whole minutes late after', () => {
      const due = etaInfoFor('Enroute', local(0), null);
      expect(due.state).toBe('late');
      expect(due.label).toBe('ETA now');
      expect(due.minutesLate).toBe(0);

      const late = etaInfoFor('Enroute', local(-14), null);
      expect(late.label).toBe('ETA 14m late');
      expect(late.compactLabel).toBe('ETA +14m');
      expect(late.title).toBe('Estimated arrival 09:46 (14m overdue)');
      expect(late.iconClass).toBe('fa-exclamation-circle');
    });

    it('formats hours', () => {
      expect(etaInfoFor('Onsite', null, local(95)).label).toBe('ETC 1h 35m');
      expect(etaInfoFor('Onsite', null, local(95)).compactLabel).toBe('ETC 2h');
      expect(etaInfoFor('Onsite', null, local(35)).compactLabel).toBe('ETC 35m');
      expect(etaInfoFor('Enroute', local(-(5 * 60 + 54)), null).compactLabel).toBe('ETA +5h');
      expect(etaInfoFor('Onsite', null, local(-120)).label).toBe('ETC 2h late');
    });

    it('switches to days past 24 hours, and keeps the compact label to one unit', () => {
      const stale = etaInfoFor('Enroute', local(-(45 * 60 + 40)), null);
      expect(stale.label).toBe('ETA 1d late');
      expect(stale.compactLabel).toBe('ETA +1d');
      expect(stale.clockLabel).toMatch(/ · 1d 21h late$/);
      expect(stale.title).toMatch(/\(1d 21h overdue\)$/);
      expect(etaInfoFor('Enroute', local(-95), null).compactLabel).toBe('ETA +1h');
      expect(etaInfoFor('Enroute', local(-(48 * 60)), null).label).toBe('ETA 2d late');
    });
  });

  describe('Tasking.etaInfo', () => {
    it('follows status and estimate changes', () => {
      const t = new Tasking({ CurrentStatus: 'Tasked', EnrouteEstimatedCompletion: local(9) });
      expect(t.etaInfo()).toBeNull();
      t.currentStatus('Enroute');
      expect(t.etaInfo().label).toBe('ETA 9m');
    });

    it(`flags the alert only once ${ETA_ALERT_MINUTES} or more minutes late`, () => {
      const t = new Tasking({ CurrentStatus: 'Onsite', OnsiteEstimatedCompletion: local(-(ETA_ALERT_MINUTES - 1)) });
      expect(t.etaOverdueForAlert()).toBe(false);
      t.onsiteEstimatedCompletion(local(-ETA_ALERT_MINUTES));
      expect(t.etaOverdueForAlert()).toBe(true);
    });

    it('updateFrom patches both estimates', () => {
      const t = new Tasking({ CurrentStatus: 'Enroute' });
      t.updateFrom({ EnrouteEstimatedCompletion: local(12), OnsiteEstimatedCompletion: local(60) });
      expect(t.enrouteEstimatedCompletion()).toBe(local(12));
      expect(t.onsiteEstimatedCompletion()).toBe(local(60));
      expect(t.etaInfo().label).toBe('ETA 12m');
    });
  });

  describe('primaryEtaTasking', () => {
    const mk = (status, eta, etc) => new Tasking({ CurrentStatus: status, EnrouteEstimatedCompletion: eta, OnsiteEstimatedCompletion: etc });

    it('prefers the soonest (or most overdue) ETA over any ETC', () => {
      const onsite = mk('Onsite', null, local(2));
      const later = mk('Enroute', local(20), null);
      const overdue = mk('Enroute', local(-3), null);
      expect(primaryEtaTasking([onsite, later, overdue])).toBe(overdue);
      expect(primaryEtaTasking([onsite, later])).toBe(later);
    });

    it('falls back to the soonest ETC, and is null without estimates', () => {
      const a = mk('Onsite', null, local(30));
      const b = mk('Onsite', null, local(10));
      expect(primaryEtaTasking([a, b, mk('Tasked')])).toBe(b);
      expect(primaryEtaTasking([mk('Tasked'), mk('Offsite')])).toBeNull();
      expect(primaryEtaTasking([])).toBeNull();
    });
  });
});

describe('forward-first status menu', () => {
  const NOW = new Date(2026, 9, 15, 10, 0, 0);
  const local = (mins) => moment(NOW).add(mins, 'minutes').format('YYYY-MM-DDTHH:mm:ss');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeTasking(data = {}) {
    const t = new Tasking({ Id: 't1', ...data });
    t.team = { id: () => 'team1' };
    t.job = { id: () => 'job1', updateTeamStatus: vi.fn(), callOffTeam: vi.fn(), untaskTeam: vi.fn() };
    return t;
  }
  const onsite = () => makeTasking({
    CurrentStatus: 'Onsite', CurrentStatusTime: local(-42), Enroute: local(-45), Onsite: local(-42),
    EnrouteEstimatedCompletion: local(-40), OnsiteEstimatedCompletion: local(35),
  });
  const labels = (entries) => entries.map(e => e.label);

  describe('menu lists', () => {
    it('Tasked: En route next, skip-aheads (incl. Complete) with notes, then the stops', () => {
      const t = makeTasking({ CurrentStatus: 'Tasked' });
      expect(labels(t.nextStepEntries())).toEqual(['En route']);
      expect(t.skipAheadEntries().map(e => [e.label, e.note])).toEqual([
        ['On site', 'skips En route'], ['Off site', 'skips 2 steps'], ['Complete', 'skips 2 steps'],
      ]);
      expect(t.skipAheadEntries()[2].inBeacon).toBe(true);
      expect(labels(t.stopEntries())).toEqual(['Call off', 'Remove tasking']);
      expect(t.canCorrect()).toBe(false);
    });

    it('On site: Off site and Complete are both next steps, no stops, can correct back to En route', () => {
      const t = onsite();
      expect(labels(t.nextStepEntries())).toEqual(['Off site', 'Complete']);
      expect(t.skipAheadEntries()).toEqual([]);
      expect(t.stopEntries()).toEqual([]);
      expect(t.correctionEntries().map(e => [e.label, e.removes])).toEqual([['En route', 'On site 09:18']]);
    });

    it('Off site: Complete next; corrections list the nearest first and everything each removes', () => {
      const t = makeTasking({ CurrentStatus: 'Offsite', CurrentStatusTime: local(-5), Enroute: local(-45), Onsite: local(-42), Offsite: local(-5) });
      expect(labels(t.nextStepEntries())).toEqual(['Complete']);
      expect(t.skipAheadEntries()).toEqual([]);
      expect(t.correctionEntries().map(e => [e.label, e.removes])).toEqual([
        ['On site', 'Off site 09:55'],
        ['En route', 'On site 09:18, Off site 09:55'],
      ]);
    });

    it('without any history, falls back to the On site time to refuse Call off', () => {
      const t = makeTasking({ CurrentStatus: 'Enroute', Enroute: local(-45), Onsite: local(-42) });
      expect(t.canCalloff()).toBe(false);
      expect(t.stopEntries()).toEqual([]);
      expect(makeTasking({ CurrentStatus: 'Enroute', Enroute: local(-45) }).canCalloff()).toBe(true);
    });

    it('En route has nothing to correct back to (Beacon has no "back to Tasked")', () => {
      expect(makeTasking({ CurrentStatus: 'Enroute' }).canCorrect()).toBe(false);
    });

    it('offers nothing once the tasking is finished', () => {
      const t = makeTasking({ CurrentStatus: 'CalledOff' });
      expect(t.nextStepEntries()).toEqual([]);
      expect(t.stopEntries()).toEqual([]);
      expect(t.canCorrect()).toBe(false);
    });

    it('progress line marks done/current steps and only shows times reached so far', () => {
      const steps = onsite().progressSteps();
      expect(steps.map(s => s.css)).toEqual(['done', 'done', 'cur', '', '']);
      expect(steps.map(s => s.time)).toEqual(['', '09:15', '09:18', '', '']);
    });
  });

  describe('correction', () => {
    it('needs the tick box, then sends the earlier status with its original time, estimate and a note', () => {
      const t = onsite();
      t.onStatusDropdownToggleClick();
      t.chooseCorrection(t.correctionEntries()[0]);
      expect(t.statusDropdownPage()).toBe('details');
      expect(t.correctionTitle()).toBe('On site → En route');
      expect(t.submitLabel()).toBe('Change to En route');
      expect(t.submitCss()).toBe('btn-warning');
      expect(t.submitDisabled()).toBe(true);

      t.updateTaskingStatus();
      expect(t.job.updateTeamStatus).not.toHaveBeenCalled();

      t.correctionAck(true);
      t.updateTaskingStatus();
      const [, action, payload] = t.job.updateTeamStatus.mock.calls[0];
      expect(action).toBe('Enroute');
      expect(payload.overrideFutureStatuses).toBe('t1');
      expect(moment(payload.timeLogged).format('HH:mm')).toBe('09:15');
      expect(moment(payload.estimatedCompletion).format('HH:mm')).toBe('09:20');
      expect(payload.description).toBe('Status corrected from On site to En route (Lighthouse)');
    });

    it('Back from the confirm page returns to the correction list, then reopening resets it', () => {
      const t = onsite();
      t.onStatusDropdownToggleClick();
      t.openCorrection();
      t.chooseCorrection(t.correctionEntries()[0]);
      t.correctionAck(true);
      t.goBackFromDetails();
      expect(t.statusDropdownPage()).toBe('correct');
      expect(t.isForwardMode()).toBe(true);
      t.onStatusDropdownToggleClick();
      expect(t.correctionAck()).toBe(false);
      expect(t.correctionTarget()).toBeNull();
    });

    it('forward changes carry no correction note', () => {
      const t = makeTasking({ CurrentStatus: 'Tasked' });
      t.chooseStatusEntry(t.nextStepEntries()[0]);
      expect(t.submitLabel()).toBe('Set En route');
      t.updateTaskingStatus();
      expect(t.job.updateTeamStatus.mock.calls[0][2].description).toBe('');
    });
  });

  describe('changing the ETA/ETC of the current status', () => {
    it('keeps the status time and sends only the new estimate', () => {
      const t = onsite();
      t.openEstimateEditor();
      expect(t.isEstimateMode()).toBe(true);
      expect(t.statusDropdownPage()).toBe('details');
      expect(t.estimateUnchanged()).toBe(true); // pre-filled with the current ETC
      expect(t.submitDisabled()).toBe(true);
      expect(t.estimateQuickLabel()).toBe('From 10:35, add:');

      t.onEstimateQuickClick(t.estimateQuickButtons.find(b => b.minutes === 10));
      expect(t.estimateDraftInfo().clock).toBe('10:45');
      expect(t.estimateQuickLabel()).toBe('From 10:35: +10m');
      expect(t.submitLabel()).toBe('Save ETC 10:45');

      t.updateTaskingStatus();
      const [, action, payload] = t.job.updateTeamStatus.mock.calls[0];
      expect(action).toBe('Onsite');
      expect(moment(payload.timeLogged).format('HH:mm')).toBe('09:18');
      expect(moment(payload.estimatedCompletion).format('HH:mm')).toBe('10:45');
    });

    it('quick buttons add up with each click, counting from now once the ETA has passed', () => {
      const t = makeTasking({ CurrentStatus: 'Enroute', CurrentStatusTime: local(-30), EnrouteEstimatedCompletion: local(-14) });
      t.openEstimateEditor();
      expect(t.estimateQuickLabel()).toBe('From now (10:00), add:');
      const plus10 = t.estimateQuickButtons.find(b => b.minutes === 10);
      t.onEstimateQuickClick(plus10);
      t.onEstimateQuickClick(plus10);
      t.onEstimateQuickClick(t.estimateQuickButtons.find(b => b.minutes === 5));
      expect(t.estimateDraftInfo().clock).toBe('10:25');

      expect(t.estimateQuickLabel()).toBe('From now (10:00): +25m');

      t.resetEstimateDraft();
      expect(t.estimateQuickLabel()).toBe('From now (10:00), add:'); // back to the current (overdue) ETA
      expect(t.estimateUnchanged()).toBe(true);
      expect(moment(t.estimateDraft()).format('HH:mm')).toBe('09:46');
    });

    it('a typed time in the future is what the next click adds to', () => {
      const t = makeTasking({ CurrentStatus: 'Enroute', CurrentStatusTime: local(-30) });
      t.openEstimateEditor();
      t.onEstimateQuickClick(t.estimateQuickButtons.find(b => b.minutes === 5));
      t.estimateDraft(moment(NOW).add(40, 'minutes').format('YYYY-MM-DDTHH:mm')); // typed
      expect(t.estimateQuickLabel()).toBe('From now (10:00): +40m'); // typing doesn't move "from"
      t.onEstimateQuickClick(t.estimateQuickButtons.find(b => b.minutes === 15));
      expect(t.estimateDraftInfo().clock).toBe('10:55');
      expect(t.estimateQuickLabel()).toBe('From now (10:00): +55m');
    });

    it('offers "Set ETA" when there is none, and nothing outside En route / On site', () => {
      const t = makeTasking({ CurrentStatus: 'Enroute', CurrentStatusTime: local(-30) });
      expect(t.estimateEditLabel()).toBe('Set ETA');
      t.openEstimateEditor();
      expect(t.estimateDraft()).toBeNull();
      expect(t.submitDisabled()).toBe(true);

      const tasked = makeTasking({ CurrentStatus: 'Tasked' });
      tasked.openEstimateEditor();
      expect(tasked.isEstimateMode()).toBe(false);
    });
  });
});

describe('Call off gating (port of Beacon canCallOff)', () => {
  // Histories from the trainbeacon test of 2026-10-23 (team 49586), with
  // what Beacon's call-off endpoint did.
  const h = (...steps) => steps.map(([Name, hhmm]) => ({ Name, TimeLogged: `2026-10-23T${hhmm}:00` }));

  it.each([
    ['Tasked only', h(['Tasked', '16:38']), true],
    ['Enroute', h(['Tasked', '16:38'], ['Enroute', '16:38']), true],
    ['ETA changed (Enroute twice)', h(['Tasked', '16:38'], ['Enroute', '16:28'], ['Enroute', '16:28']), true],
    ['normal arrival: Enroute -> Onsite', h(['Tasked', '16:39'], ['Enroute', '16:19'], ['Onsite', '16:34']), false],
    ['C: Onsite corrected back to Enroute', h(['Tasked', '16:39'], ['Enroute', '16:19'], ['Onsite', '16:34'], ['Enroute', '16:19']), true],
    ['N: two Onsites then back to Enroute', h(['Tasked', '16:40'], ['Enroute', '16:10'], ['Onsite', '16:20'], ['Onsite', '16:25'], ['Enroute', '16:10']), true],
    ['H: Onsite logged before Enroute', h(['Tasked', '16:41'], ['Enroute', '16:31'], ['Onsite', '16:11'], ['Enroute', '16:31']), true],
    ['E: skipped to Onsite, then one Enroute', h(['Tasked', '16:41'], ['Onsite', '16:36'], ['Enroute', '16:26']), false],
    ['O: been Offsite, back to Enroute', h(['Tasked', '16:40'], ['Enroute', '16:10'], ['Onsite', '16:20'], ['Offsite', '16:35'], ['Enroute', '16:10']), false],
    ['I: skipped to Offsite', h(['Tasked', '16:41'], ['Offsite', '16:36']), false],
    ['ever Complete', h(['Tasked', '16:00'], ['Complete', '16:30']), false],
  ])('%s -> %s', (_label, history, expected) => {
    expect(canCallOffFromHistory(history)).toBe(expected);
  });

  it('gates the tasking\'s Call off on its history', () => {
    const corrected = new Tasking({ CurrentStatus: 'Enroute', JobTeamStatusTypeHistory: h(['Tasked', '16:39'], ['Enroute', '16:19'], ['Onsite', '16:34'], ['Enroute', '16:19']) });
    expect(corrected.canCalloff()).toBe(true);
    const wasOffsite = new Tasking({ CurrentStatus: 'Enroute', JobTeamStatusTypeHistory: h(['Tasked', '16:40'], ['Enroute', '16:10'], ['Onsite', '16:20'], ['Offsite', '16:35'], ['Enroute', '16:10']) });
    expect(wasOffsite.canCalloff()).toBe(false);
  });

  it('updateFrom replaces the history when a fetch brings it', () => {
    const t = new Tasking({ CurrentStatus: 'Enroute', JobTeamStatusTypeHistory: h(['Tasked', '16:00'], ['Enroute', '16:10']) });
    t.updateFrom({ CurrentStatus: 'Onsite', CurrentStatusTime: '2026-10-23T16:20:00', JobTeamStatusTypeHistory: h(['Tasked', '16:00'], ['Enroute', '16:10'], ['Onsite', '16:20']) });
    expect(t.statusHistory().map(x => x.Name)).toEqual(['Tasked', 'Enroute', 'Onsite']);
  });

  it('updateFrom appends a pushed status change (pushes carry no history)', () => {
    const t = new Tasking({ CurrentStatus: 'Enroute', CurrentStatusTime: '2026-10-23T16:10:00', JobTeamStatusTypeHistory: h(['Tasked', '16:00'], ['Enroute', '16:10']) });
    t.updateFrom({ CurrentStatusId: 4, CurrentStatusTime: '2026-10-23T16:20:00' }); // Onsite
    expect(t.statusHistory().map(x => [x.Name, x.TimeLogged.slice(11, 16)])).toEqual([['Tasked', '16:00'], ['Enroute', '16:10'], ['Onsite', '16:20']]);
    expect(t.canCalloff()).toBe(false);
    t.updateFrom({ CurrentStatusId: 4, CurrentStatusTime: '2026-10-23T16:20:00' }); // same again: no duplicate
    expect(t.statusHistory().length).toBe(3);
  });

  it('warns on a correction back to En route that still leaves Call off blocked', () => {
    const offsite = new Tasking({
      CurrentStatus: 'Offsite', Enroute: '2026-10-23T16:10:00', Onsite: '2026-10-23T16:20:00', Offsite: '2026-10-23T16:35:00',
      JobTeamStatusTypeHistory: h(['Tasked', '16:00'], ['Enroute', '16:10'], ['Onsite', '16:20'], ['Offsite', '16:35']),
    });
    const byKey = Object.fromEntries(offsite.correctionEntries().map(e => [e.key, e.stillNoCallOff]));
    expect(byKey).toEqual({ Onsite: false, Enroute: true });

    const onsite = new Tasking({
      CurrentStatus: 'Onsite', Enroute: '2026-10-23T16:10:00', Onsite: '2026-10-23T16:20:00',
      JobTeamStatusTypeHistory: h(['Tasked', '16:00'], ['Enroute', '16:10'], ['Onsite', '16:20']),
    });
    expect(onsite.correctionEntries()[0].stillNoCallOff).toBe(false); // back to En route makes Call off available
  });
});
