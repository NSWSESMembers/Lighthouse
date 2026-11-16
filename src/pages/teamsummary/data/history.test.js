import { describe, it, expect } from 'vitest';
import { historyEntries, lastPosition, trimDescription, agoText, HISTORY_LIMIT } from './history.js';

const row = (Name, TimeStamp, Description = 'Tasking updated by Alex Nguyen') => ({ Name, Description, TimeStamp });

// Newest first, as Beacon sends it.
const rows = [
  row('DEM01 Onsite on job 2611-0013', '2026-11-15T15:06:00'),
  row('DEM01 Enroute on job 2611-0013', '2026-11-15T14:51:00'),
  row('Sam Okafor added to team', '2026-11-15T13:00:00', 'Member added by Alex Nguyen'),
  row('Riley Moreau added to team', '2026-11-15T13:00:00', 'Member added by Alex Nguyen'),
  row('Jordan Petrov added to team', '2026-11-15T13:00:00', 'Member added by Alex Nguyen'),
  row('Team set as Activated', '2026-11-15T12:59:00', 'Status changed by Alex Nguyen'),
  row('Casey Haddad removed from team', '2026-11-15T12:00:00', 'Member removed by Alex Nguyen'),
  row('DEM01 Complete on job 2611-0012', '2026-11-15T10:30:00'),
];

describe('historyEntries', () => {
  it('shows the latest entries, members added together as one', () => {
    const out = historyEntries(rows, { callsign: 'DEM01' });
    expect(out.map((e) => [e.title, e.detail])).toEqual([
      ['Onsite on job 2611-0013', 'Tasking updated'],
      ['Enroute on job 2611-0013', 'Tasking updated'],
      ['Members added to team', 'Sam Okafor, Riley Moreau, Jordan Petrov'],
      ['Team set as Activated', ''],
      ['Casey Haddad removed from team', 'Member removed'],
    ]);
    expect(out).toHaveLength(HISTORY_LIMIT);
    expect(out[0].incidentNumber).toBe('2611-0013');
    expect(out[2].incidentNumber).toBe('');
    expect(out[0].at).toEqual(new Date('2026-11-15T15:06:00'));
  });

  it('can leave out members added and removed', () => {
    const out = historyEntries(rows, { callsign: 'DEM01', memberChanges: false });
    expect(out.map((e) => e.title)).toEqual([
      'Onsite on job 2611-0013', 'Enroute on job 2611-0013', 'Team set as Activated', 'Complete on job 2611-0012',
    ]);
  });

  it('does not group members added at different times, or added then removed', () => {
    const out = historyEntries([
      row('A One added to team', '2026-11-15T13:00:00'),
      row('B Two removed from team', '2026-11-15T13:00:00'),
      row('C Three added to team', '2026-11-15T12:00:00'),
    ], { callsign: 'X' });
    expect(out.map((e) => e.title)).toEqual(['A One added to team', 'B Two removed from team', 'C Three added to team']);
  });

  it('sorts newest first whatever order Beacon sends', () => {
    const out = historyEntries([...rows].reverse(), { callsign: 'DEM01', limit: 2 });
    expect(out.map((e) => e.title)).toEqual(['Onsite on job 2611-0013', 'Enroute on job 2611-0013']);
  });

  it('gives each entry a distinct key', () => {
    const out = historyEntries([row('Same', '2026-11-15T10:00:00'), row('Same', '2026-11-15T10:00:00')], { callsign: 'X' });
    expect(new Set(out.map((e) => e.key)).size).toBe(2);
  });

  it('copes with nothing, and with odd rows', () => {
    expect(historyEntries(null, { callsign: 'X' })).toEqual([]);
    expect(historyEntries([null, { Description: 'no name' }], { callsign: 'X' })).toEqual([]);
  });
});

describe('lastPosition', () => {
  it('is the latest move on an incident', () => {
    expect(lastPosition(rows)).toEqual({ statusName: 'Onsite', incidentNumber: '2611-0013', at: new Date('2026-11-15T15:06:00') });
  });

  it('ignores Tasked, which is not a move', () => {
    expect(lastPosition([row('DEM01 Tasked to job 2611-0099', '2026-11-15T16:00:00'), ...rows]).incidentNumber).toBe('2611-0013');
  });

  it('is null without any', () => {
    expect(lastPosition([row('Team set as Activated', '2026-11-15T12:59:00')])).toBeNull();
  });
});

describe('trimDescription', () => {
  it('drops who did it', () => {
    expect(trimDescription('Tasking updated by Alex Nguyen')).toBe('Tasking updated');
    expect(trimDescription('Dropped by the depot by Alex Nguyen')).toBe('Dropped by the depot');
    expect(trimDescription('No author')).toBe('No author');
    expect(trimDescription(null)).toBe('');
  });
});

describe('agoText', () => {
  const now = new Date('2026-11-15T15:30:00');
  const ago = (mins) => agoText(new Date(now - mins * 60e3), now);
  it('says how long ago in moment\'s words, as the old page did', () => {
    expect(ago(0.5)).toBe('a few seconds ago');
    expect(ago(1)).toBe('a minute ago');
    expect(ago(12)).toBe('12 minutes ago');
    expect(ago(44)).toBe('44 minutes ago');
    expect(ago(48)).toBe('an hour ago');
    expect(ago(89)).toBe('an hour ago');
    expect(ago(3 * 60)).toBe('3 hours ago');
    expect(ago(23 * 60)).toBe('a day ago');
    expect(ago(3 * 24 * 60)).toBe('3 days ago');
    expect(agoText(null, now)).toBe('');
  });
});
