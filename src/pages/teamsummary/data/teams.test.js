import { describe, it, expect } from 'vitest';
import {
  teamFromBeacon, statusInfo, shownByDefault, hoursSince, hoursLevel, taskedLevel, taskedText, messageUrl, stampText,
} from './teams.js';

const raw = {
  Id: 80001,
  Callsign: 'DEM02',
  TeamStatusStartDate: '2026-11-15T09:00:00',
  Sector: { Id: 1, Name: 'North Demo' },
  TeamStatusType: { Id: 3, Name: 'Activated' },
  TeamType: { Id: 1, Name: 'Field' },
  Members: [
    { Id: 1, TimeOn: '2026-11-15T08:48:00', TeamLeader: true, Person: { Id: 50, FullName: 'Alex Nguyen', FirstName: 'Alex', LastName: 'Nguyen' } },
    { Id: 2, TimeOn: null, TeamLeader: false, Person: { Id: 51, FirstName: 'Sam', LastName: 'Okafor' } },
    { Id: 3, TeamLeader: false, Person: null },
  ],
  Resources: [{ Id: 1, Name: 'Demo Ute' }, { Id: 2, Name: '' }],
  TaskedJobCount: 2,
};

describe('teamFromBeacon', () => {
  it('keeps what a card shows', () => {
    const t = teamFromBeacon(raw);
    expect(t).toMatchObject({
      id: 80001, callsign: 'DEM02', typeName: 'Field', sector: 'North Demo',
      statusName: 'Activated', statusLabel: 'Activated', statusKey: 'activated', tasked: 2,
      resources: ['Demo Ute'],
    });
    expect(t.statusSince).toEqual(new Date('2026-11-15T09:00:00'));
  });

  it('builds member names and skips members without a person', () => {
    const { members } = teamFromBeacon(raw);
    expect(members).toEqual([
      { id: 1, personId: 50, name: 'Alex Nguyen', leader: true, timeOn: new Date('2026-11-15T08:48:00') },
      { id: 2, personId: 51, name: 'Sam Okafor', leader: false, timeOn: null },
    ]);
  });

  it('copes with a bare team', () => {
    const t = teamFromBeacon({ Id: 1 });
    expect(t).toMatchObject({ callsign: '', typeName: '', sector: '', statusKey: 'other', tasked: 0, resources: [], members: [] });
    expect(t.statusSince).toBeNull();
  });
});

describe('statusInfo', () => {
  it('names Beacon statuses for people', () => {
    expect(statusInfo('OnAlert')).toEqual({ label: 'On Alert', key: 'alert' });
    expect(statusInfo('StoodDown').label).toBe('Stood Down');
    expect(statusInfo('Something')).toEqual({ label: 'Something', key: 'other' });
  });
});

describe('shownByDefault', () => {
  it('shows activated field teams only', () => {
    expect(shownByDefault(teamFromBeacon(raw))).toBe(true);
    expect(shownByDefault(teamFromBeacon({ ...raw, TeamType: { Name: 'Operations' } }))).toBe(false);
    expect(shownByDefault(teamFromBeacon({ ...raw, TeamStatusType: { Name: 'Standby' } }))).toBe(false);
  });
});

describe('hours', () => {
  const now = new Date('2026-11-15T15:30:00');
  it('counts whole hours', () => {
    expect(hoursSince(new Date('2026-11-15T05:31:00'), now)).toBe(9);
    expect(hoursSince(new Date('2026-11-15T05:30:00'), now)).toBe(10);
    expect(hoursSince(null, now)).toBe(0);
    expect(hoursSince(new Date('2026-11-16T00:00:00'), now)).toBe(0);
  });

  it('goes amber at 10 hours and red past 12', () => {
    expect(hoursLevel(9)).toBe('');
    expect(hoursLevel(10)).toBe('amber');
    expect(hoursLevel(12)).toBe('amber');
    expect(hoursLevel(13)).toBe('red');
  });
});

describe('tasked incidents', () => {
  it('is red with none and amber with one', () => {
    expect(taskedLevel(0)).toBe('red');
    expect(taskedLevel(1)).toBe('amber');
    expect(taskedLevel(2)).toBe('');
  });

  it('says how many, as the old page\'s "Active Jobs"', () => {
    expect(taskedText(0)).toBe('Active Incidents: 0');
    expect(taskedText(3)).toBe('Active Incidents: 3');
  });
});

describe('stampText', () => {
  it('is the old page\'s "Nov 15 09.05"', () => {
    expect(stampText(new Date('2026-11-15T09:05:00'))).toBe('Nov 15 09.05');
    expect(stampText(new Date('2026-01-03T23:59:00'))).toBe('Jan 3 23.59');
    expect(stampText(null)).toBe('—');
  });
});

describe('messageUrl', () => {
  it('fills in the members for Beacon\'s Messages screen', () => {
    const url = messageUrl('https://beacon.test', [50, 51]);
    expect(url.startsWith('https://beacon.test/Messages/Create?lhquickrecipient=')).toBe(true);
    // The Beacon script reads it with unescape().
    expect(JSON.parse(unescape(url.split('=')[1]))).toEqual([50, 51]);
  });
});
