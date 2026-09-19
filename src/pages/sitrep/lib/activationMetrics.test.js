import { describe, it, expect } from 'vitest';
import { computeActivatedTeams, computeUniqueVolunteers } from './activationMetrics.js';

const d = (s) => new Date(s);
const windowStart = d('2026-01-01T00:00:00.000Z');
const windowEnd = d('2026-01-02T00:00:00.000Z');

function row(name, timeStamp) {
  return { Name: name, Description: '', TimeStamp: timeStamp };
}

function member(id, firstName, lastName) {
  return { Id: `member-${id}`, Person: { Id: id, FirstName: firstName, LastName: lastName } };
}

function team({ teamId, callsign = teamId, historyRows, historyTotalItems = historyRows.length, currentMembers = [], teamTypeName = null }) {
  return { teamId, callsign, historyRows, historyTotalItems, currentMembers, teamTypeName };
}

describe('computeActivatedTeams', () => {
  it('counts a team continuously Activated through the whole window (no status change inside it)', () => {
    const t = team({
      teamId: 't1',
      historyRows: [row('Team set as Activated', '2025-12-20T00:00:00.000Z')],
    });
    const { activatedTeamIds } = computeActivatedTeams([t], windowStart, windowEnd);
    expect(activatedTeamIds.has('t1')).toBe(true);
  });

  it('counts a team whose activation only partially overlaps the window (spans the boundary)', () => {
    const t = team({
      teamId: 't1',
      historyRows: [
        row('Team set as Activated', '2026-01-01T18:00:00.000Z'),
        row('Team set as Rest', '2026-01-02T06:00:00.000Z'), // ends after windowEnd
      ],
    });
    const { activatedTeamIds } = computeActivatedTeams([t], windowStart, windowEnd);
    expect(activatedTeamIds.has('t1')).toBe(true);
  });

  it('does not count a team never Activated near the window', () => {
    const t = team({
      teamId: 't1',
      historyRows: [row('Team set as Standby', '2025-12-20T00:00:00.000Z')],
    });
    const { activatedTeamIds } = computeActivatedTeams([t], windowStart, windowEnd);
    expect(activatedTeamIds.has('t1')).toBe(false);
  });

  it('does not double count multiple activations for one team', () => {
    const t = team({
      teamId: 't1',
      historyRows: [
        row('Team set as Activated', '2026-01-01T01:00:00.000Z'),
        row('Team set as Rest', '2026-01-01T05:00:00.000Z'),
        row('Team set as Activated', '2026-01-01T10:00:00.000Z'),
      ],
    });
    const { activatedTeamIds } = computeActivatedTeams([t], windowStart, windowEnd);
    expect(activatedTeamIds.size).toBe(1);
  });

  it('flags a team whose fetched history does not reach back to windowStart', () => {
    const t = team({
      teamId: 't1',
      historyRows: [row('Team set as Activated', '2026-01-01T12:00:00.000Z')],
      historyTotalItems: 500, // far more history exists than the one row fetched
    });
    const { activatedTeamsWithIncompleteHistory } = computeActivatedTeams([t], windowStart, windowEnd);
    expect(activatedTeamsWithIncompleteHistory.has('t1')).toBe(true);
  });

  it('an incident on the exact window boundary is excluded per exclusive-end semantics', () => {
    const t = team({
      teamId: 't1',
      historyRows: [row('Team set as Activated', windowEnd.toISOString())],
    });
    const { activatedTeamIds } = computeActivatedTeams([t], windowStart, windowEnd);
    expect(activatedTeamIds.has('t1')).toBe(false);
  });
});

describe('computeUniqueVolunteers', () => {
  it('counts a volunteer whose membership and Activated status both overlap the window', () => {
    const t = team({
      teamId: 't1',
      currentMembers: [member('p1', 'Jane', 'Smith')],
      historyRows: [
        row('Team set as Activated', '2025-12-20T00:00:00.000Z'),
        row('Jane Smith added to team', '2025-12-25T00:00:00.000Z'),
      ],
    });
    const { volunteerIds } = computeUniqueVolunteers([t], windowStart, windowEnd);
    expect(volunteerIds.has('p1')).toBe(true);
  });

  it('does not count a member of a team that was never Activated', () => {
    const t = team({
      teamId: 't1',
      currentMembers: [member('p1', 'Jane', 'Smith')],
      historyRows: [
        row('Team set as Standby', '2025-12-20T00:00:00.000Z'),
        row('Jane Smith added to team', '2025-12-25T00:00:00.000Z'),
      ],
    });
    const { volunteerIds, nameOnlyVolunteers } = computeUniqueVolunteers([t], windowStart, windowEnd);
    expect(volunteerIds.size).toBe(0);
    expect(nameOnlyVolunteers.size).toBe(0);
  });

  it('deduplicates a volunteer on multiple teams by stable person id', () => {
    const teamA = team({
      teamId: 't1',
      currentMembers: [member('p1', 'Jane', 'Smith')],
      historyRows: [row('Team set as Activated', '2025-12-20T00:00:00.000Z'), row('Jane Smith added to team', '2025-12-20T00:00:00.000Z')],
    });
    const teamB = team({
      teamId: 't2',
      currentMembers: [member('p1', 'Jane', 'Smith')],
      historyRows: [row('Team set as Activated', '2025-12-20T00:00:00.000Z'), row('Jane Smith added to team', '2025-12-21T00:00:00.000Z')],
    });
    const { volunteerIds } = computeUniqueVolunteers([teamA, teamB], windowStart, windowEnd);
    expect(volunteerIds.size).toBe(1);
    expect(volunteerIds.has('p1')).toBe(true);
  });

  it('does not count a volunteer whose membership interval is entirely outside the window (membership changed before/after)', () => {
    const t = team({
      teamId: 't1',
      currentMembers: [],
      historyRows: [
        row('Team set as Activated', '2025-12-01T00:00:00.000Z'),
        row('Jane Smith added to team', '2025-12-01T00:00:00.000Z'),
        row('Jane Smith removed from team', '2025-12-15T00:00:00.000Z'), // left well before the window
      ],
    });
    const { volunteerIds, nameOnlyVolunteers } = computeUniqueVolunteers([t], windowStart, windowEnd);
    expect(volunteerIds.size).toBe(0);
    expect(nameOnlyVolunteers.size).toBe(0);
  });

  it('falls back to a name-only tally for a departed member with no stable id available', () => {
    const t = team({
      teamId: 't1',
      currentMembers: [], // Jane has since left every known team -- no current Person.Id to resolve to
      historyRows: [
        row('Team set as Activated', '2025-12-20T00:00:00.000Z'),
        row('Jane Smith added to team', '2025-12-25T00:00:00.000Z'),
        row('Jane Smith removed from team', '2026-01-01T12:00:00.000Z'),
      ],
    });
    const { volunteerIds, nameOnlyVolunteers } = computeUniqueVolunteers([t], windowStart, windowEnd);
    expect(volunteerIds.size).toBe(0);
    expect(nameOnlyVolunteers.has('jane smith')).toBe(true);
  });

  it('handles a membership change during the period (joined then left, both inside the window)', () => {
    const t = team({
      teamId: 't1',
      currentMembers: [],
      historyRows: [
        row('Team set as Activated', '2025-12-01T00:00:00.000Z'),
        row('Jane Smith added to team', '2026-01-01T06:00:00.000Z'),
        row('Jane Smith removed from team', '2026-01-01T18:00:00.000Z'),
      ],
    });
    const { nameOnlyVolunteers } = computeUniqueVolunteers([t], windowStart, windowEnd);
    expect(nameOnlyVolunteers.has('jane smith')).toBe(true);
  });

  it('resolves a stable id from a different team than the one the history entry belongs to', () => {
    // Jane is a current member of team A, but the matching history entry
    // (her join) is recorded on team B, which she has since left.
    const teamA = team({
      teamId: 't1',
      currentMembers: [member('p1', 'Jane', 'Smith')],
      historyRows: [row('Team set as Activated', '2025-12-01T00:00:00.000Z')],
    });
    const teamB = team({
      teamId: 't2',
      currentMembers: [],
      historyRows: [
        row('Team set as Activated', '2025-12-20T00:00:00.000Z'),
        row('Jane Smith added to team', '2025-12-25T00:00:00.000Z'),
      ],
    });
    const { volunteerIds, nameOnlyVolunteers } = computeUniqueVolunteers([teamA, teamB], windowStart, windowEnd);
    expect(volunteerIds.has('p1')).toBe(true);
    expect(nameOnlyVolunteers.size).toBe(0);
  });

  it('does not resolve an ambiguous name shared by two distinct current members to either id', () => {
    const t = team({
      teamId: 't1',
      currentMembers: [member('p1', 'Jane', 'Smith'), member('p2', 'Jane', 'Smith')],
      historyRows: [
        row('Team set as Activated', '2025-12-20T00:00:00.000Z'),
        row('Jane Smith added to team', '2025-12-25T00:00:00.000Z'),
      ],
    });
    const { volunteerIds, nameOnlyVolunteers } = computeUniqueVolunteers([t], windowStart, windowEnd);
    expect(volunteerIds.size).toBe(0);
    expect(nameOnlyVolunteers.has('jane smith')).toBe(true);
  });
});

describe('computeUniqueVolunteers by team type', () => {
  const activated = row('Team set as Activated', '2025-12-20T00:00:00.000Z');
  it('groups people by their team type, counting someone on both a Field and an Operations team once overall', () => {
    const field = team({ teamId: 'f', teamTypeName: 'Field', currentMembers: [member('p1', 'Jane', 'Smith'), member('p2', 'Bob', 'Jones')], historyRows: [activated, row('Jane Smith added to team', '2025-12-25T00:00:00.000Z'), row('Bob Jones added to team', '2025-12-25T00:00:00.000Z')] });
    const ops = team({ teamId: 'o', teamTypeName: 'Operations', currentMembers: [member('p1', 'Jane', 'Smith')], historyRows: [activated, row('Jane Smith added to team', '2025-12-25T00:00:00.000Z')] });
    const { volunteerIds, volunteerIdsByType } = computeUniqueVolunteers([field, ops], windowStart, windowEnd);
    expect(volunteerIds.size).toBe(2);
    expect(volunteerIdsByType.get('field').size).toBe(2);
    expect(volunteerIdsByType.get('operations').size).toBe(1);
  });
  it('keeps people on teams of another or unknown type in the total only', () => {
    const av = team({ teamId: 'a', teamTypeName: 'Aviation', currentMembers: [member('p9', 'Ann', 'Pilot')], historyRows: [activated, row('Ann Pilot added to team', '2025-12-25T00:00:00.000Z')] });
    const { volunteerIds, volunteerIdsByType } = computeUniqueVolunteers([av], windowStart, windowEnd);
    expect(volunteerIds.size).toBe(1);
    expect(volunteerIdsByType.get('field')).toBeUndefined();
  });
});

describe('computeUniqueVolunteers personnel involved (participant keys)', () => {
  const activated = row('Team set as Activated', '2025-12-20T00:00:00.000Z');
  it('counts someone stood down during the period, even once they are off every team (matched by name), and counts each person once', () => {
    const t1 = team({ teamId: 't1', teamTypeName: 'Field', currentMembers: [member('p1', 'Jane', 'Smith')], historyRows: [activated, row('Jane Smith added to team', '2025-12-25T00:00:00.000Z'), row('Gone Person added to team', '2025-12-25T00:00:00.000Z'), row('Gone Person removed from team', '2026-01-01T12:00:00.000Z')] });
    const t2 = team({ teamId: 't2', teamTypeName: 'Operations', currentMembers: [member('p1', 'Jane', 'Smith')], historyRows: [activated, row('Jane Smith added to team', '2025-12-25T00:00:00.000Z')] });
    const { participantKeys, participantKeysByType } = computeUniqueVolunteers([t1, t2], windowStart, windowEnd);
    expect(participantKeys.size).toBe(2); // Jane once (two teams), the stood-down person once
    expect(participantKeysByType.get('field').size).toBe(2);
    expect(participantKeysByType.get('operations').size).toBe(1);
  });
  it('counts a person who left one team and joined another once, by person id', () => {
    const a = team({ teamId: 'a', teamTypeName: 'Field', currentMembers: [], historyRows: [activated, row('Jane Smith added to team', '2025-12-25T00:00:00.000Z'), row('Jane Smith removed from team', '2026-01-01T06:00:00.000Z')] });
    const b = team({ teamId: 'b', teamTypeName: 'Field', currentMembers: [member('p1', 'Jane', 'Smith')], historyRows: [activated, row('Jane Smith added to team', '2026-01-01T07:00:00.000Z')] });
    const { participantKeys } = computeUniqueVolunteers([a, b], windowStart, windowEnd);
    expect([...participantKeys]).toEqual(['id:p1']);
  });
});
