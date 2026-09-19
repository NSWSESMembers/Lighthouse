import { describe, it, expect } from 'vitest';
import { computeSitrepReport } from './computeSitrepReport.js';

const windowStart = new Date('2026-01-01T00:00:00.000Z');
const windowEnd = new Date('2026-01-02T00:00:00.000Z');
const row = (name, timeStamp) => ({ Name: name, Description: '', TimeStamp: timeStamp });

function baseFetched(overrides = {}) {
  return {
    jobs: [],
    jobsFetchComplete: true,
    teamContexts: [],
    teamsFetchComplete: true,
    activationLookbackStart: new Date('2025-12-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('computeSitrepReport', () => {
  it('reports complete data with no issues when everything was fetched cleanly', () => {
    const report = computeSitrepReport(baseFetched(), windowStart, windowEnd);
    expect(report.dataCompleteness.complete).toBe(true);
    expect(report.dataCompleteness.level).toBe('green');
    expect(report.incidentsReceived).toBe(0);
    expect(report.teamsActivated).toBe(0);
  });

  it('flags incompleteness and lists teams whose history fetch failed, excluding them from counts (not showing zero as valid)', () => {
    const fetched = baseFetched({
      teamContexts: [
        { teamId: 't1', callsign: 'RESCUE1', historyRows: [], historyTotalItems: 0, historyFetchFailed: true, currentMembers: [] },
      ],
    });
    const report = computeSitrepReport(fetched, windowStart, windowEnd);
    expect(report.dataCompleteness.complete).toBe(false);
    expect(report.dataCompleteness.level).toBe('red');
    expect(report.dataCompleteness.issues.some((i) => i.includes('RESCUE1'))).toBe(true);
    expect(report.teamsActivated).toBe(0); // excluded, not miscounted as an activated-or-not zero
  });

  it('counts incidents, activated teams and volunteers together end to end', () => {
    const fetched = baseFetched({
      jobs: [{ Id: 'j1', JobReceived: '2026-01-01T06:00:00.000Z' }],
      teamContexts: [
        {
          teamId: 't1',
          callsign: 'RESCUE1',
          historyRows: [
            row('Team set as Activated', '2025-12-20T00:00:00.000Z'),
            row('Jane Smith added to team', '2025-12-25T00:00:00.000Z'),
          ],
          historyTotalItems: 2,
          historyFetchFailed: false,
          currentMembers: [{ Id: 'm1', Person: { Id: 'p1', FirstName: 'Jane', LastName: 'Smith' } }],
        },
      ],
    });
    const report = computeSitrepReport(fetched, windowStart, windowEnd);
    expect(report.incidentsReceived).toBe(1);
    expect(report.teamsActivated).toBe(1);
    expect(report.volunteersParticipating).toBe(1);
    expect(report.currentlyActivatedTeamIds.has('t1')).toBe(true);
  });

  it('applies incident sector/event filters', () => {
    const fetched = baseFetched({
      jobs: [
        { Id: 'j1', JobReceived: '2026-01-01T06:00:00.000Z', Sector: { Id: 1 } },
        { Id: 'j2', JobReceived: '2026-01-01T07:00:00.000Z', Sector: { Id: 2 } },
      ],
    });
    const report = computeSitrepReport(fetched, windowStart, windowEnd, { sectorId: 1 });
    expect(report.incidentsReceived).toBe(1);
  });
});

describe('computeSitrepReport personnelInvolved', () => {
  const activated = row('Team set as Activated', '2025-12-20T00:00:00.000Z');
  const ctxFor = (teamId, teamTypeName, members, rows) => ({
    teamId,
    callsign: teamId,
    teamTypeName,
    historyRows: [activated, ...rows],
    historyTotalItems: rows.length + 1,
    currentMembers: members,
  });
  const jane = { Id: 'm1', Person: { Id: 'p1', FirstName: 'Jane', LastName: 'Smith' } };

  it('counts people by person id (once across teams), by team type, with unmatchable people as Other', () => {
    const fetched = baseFetched({
      teamContexts: [
        ctxFor('f', 'Field', [jane], [row('Jane Smith added to team', '2025-12-25T00:00:00.000Z'), row('Gone Person added to team', '2025-12-25T00:00:00.000Z'), row('Gone Person removed from team', '2026-01-01T12:00:00.000Z')]),
        ctxFor('o', 'Operations', [jane], [row('Jane Smith added to team', '2025-12-25T00:00:00.000Z')]),
      ],
    });
    const { personnelInvolved } = computeSitrepReport(fetched, windowStart, windowEnd);
    expect(personnelInvolved).toEqual({ total: 2, field: 1, operations: 1, aviation: 0, other: 1 });
  });

  it('lists the people counted as Other as sub-points of that Data Status issue, with their teams', () => {
    const fetched = baseFetched({
      teamContexts: [
        ctxFor('f', 'Field', [jane], [row('Gone Person added to team', '2025-12-25T00:00:00.000Z'), row('Gone Person removed from team', '2026-01-01T12:00:00.000Z')]),
        ctxFor('o', 'Operations', [], [row('Gone Person added to team', '2025-12-25T00:00:00.000Z'), row('Alan Other added to team', '2025-12-25T00:00:00.000Z')]),
      ],
    });
    const { dataCompleteness } = computeSitrepReport(fetched, windowStart, windowEnd);
    const index = dataCompleteness.issues.findIndex((i) => i.includes('be matched to a person in Beacon'));
    expect(index).toBeGreaterThan(-1);
    expect(dataCompleteness.issueDetails[index]).toEqual(['Alan Other (o)', 'Gone Person (f, o)']);
    expect(dataCompleteness.level).toBe('amber');
  });

  it('has no sub-points when everyone was matched', () => {
    const { dataCompleteness } = computeSitrepReport(baseFetched({ teamContexts: [ctxFor('f', 'Field', [jane], [row('Jane Smith added to team', '2025-12-25T00:00:00.000Z')])] }), windowStart, windowEnd);
    expect(dataCompleteness.issueDetails).toEqual({});
  });
});
