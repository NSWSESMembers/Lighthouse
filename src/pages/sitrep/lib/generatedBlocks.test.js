import { describe, it, expect } from 'vitest';
import { buildGeneratedBlocks, mergeGeneratedBlock } from './generatedBlocks.js';

const stats = (o = {}) => ({
  received: 12,
  outstanding: 4,
  referred: 1,
  complete: 7,
  other: 0,
  jobTypes: [{ label: 'Tree', count: 4 }, { label: 'N/A', count: 1 }],
  priorities: [{ label: 'Immediate', count: 3 }],
  localities: [{ label: 'Parramatta', count: 2 }],
  averageMs: 125 * 60000,
  sampleSize: 6,
  ...o,
});

const report = (o = {}) => ({
  incidentsReceived: 12,
  incidentStats: stats(),
  teamsActivated: 2,
  volunteersParticipating: 5,
  personnelInvolved: { total: 5, field: 4, operations: 2, aviation: 0, other: 0 },
  volunteersParticipatingNameOnly: 0,
  currentlyActivatedTeamIds: new Set(['t1']),
  ...o,
});

describe('buildGeneratedBlocks', () => {
  it('leaves Situation for the operator -- no generated block', () => {
    expect(buildGeneratedBlocks(report()).situation).toBeUndefined();
  });

  it('leads Impact with the incident counts on one line', () => {
    const { impact } = buildGeneratedBlocks(report());
    expect(impact.split('\n')[0]).toBe('12 Incidents Received, 4 Incidents Outstanding, 1 Incidents Referred, 7 Incidents Complete');
  });

  it('flags jobs whose status is in neither group instead of hiding them', () => {
    expect(buildGeneratedBlocks(report({ incidentStats: stats({ other: 2 }) })).impact.split('\n')[0]).toContain('2 Incidents Other status');
  });

  it('summarises incident types, priorities, most impacted suburbs and average completion time under Impact', () => {
    const { impact } = buildGeneratedBlocks(report());
    expect(impact).toContain('Incident types: Tree (4), N/A (1)');
    expect(impact).toContain('Job priorities: Immediate (3)');
    expect(impact).toContain('Most impacted suburbs: Parramatta (2)');
    expect(impact).not.toContain('Average completion time');
    expect(buildGeneratedBlocks(report()).execution).toBe('Average completion time: 2 hr 5 min (6 incidents)');
  });

  it('lists only the top 5 suburbs and leaves N/A out of them', () => {
    const localities = [{ label: 'N/A', count: 50 }, ...Array.from({ length: 8 }, (_, i) => ({ label: `S${i}`, count: 8 - i }))];
    const line = buildGeneratedBlocks(report({ incidentStats: stats({ localities }) })).impact.split('\n').find((l) => l.startsWith('Most impacted suburbs'));
    expect(line).toBe('Most impacted suburbs: S0 (8), S1 (7), S2 (6), S3 (5), S4 (4)');
  });

  it('says so when no completion time can be measured, rather than showing zero', () => {
    const { execution } = buildGeneratedBlocks(report({ incidentStats: stats({ averageMs: null, sampleSize: 0 }) }));
    expect(execution).toContain('Average completion time: not available');
  });

  it('produces the resources lines', () => {
    const b = buildGeneratedBlocks(report());
    expect(b.resources.split('\n')).toEqual([
      'Teams Currently Active: 1',
      'Teams operational during reporting period: 2',
      'Personnel involved: 5 Total (4 Field / 2 Operations)',
    ]);
  });

  it('formats as "N Total (a Field / b Operations / c Aviation / d Other)", listing only the groups that have someone', () => {
    const line = (p) => buildGeneratedBlocks(report({ personnelInvolved: p })).resources.split('\n')[2];
    expect(line({ total: 6, field: 3, operations: 2, aviation: 1, other: 1 })).toBe('Personnel involved: 6 Total (3 Field / 2 Operations / 1 Aviation / 1 Other)');
    expect(line({ total: 3, field: 3, operations: 0, aviation: 0, other: 0 })).toBe('Personnel involved: 3 Total (3 Field)');
    expect(line({ total: 2, field: 0, operations: 0, aviation: 0, other: 2 })).toBe('Personnel involved: 2 Total (2 Other)');
    expect(line({ total: 0, field: 0, operations: 0, aviation: 0, other: 0 })).toBe('Personnel involved: 0 Total');
  });
});

describe('mergeGeneratedBlock', () => {
  it('removes a previously generated block when there is no new one, keeping the operator text', () => {
    expect(mergeGeneratedBlock('Counts line\nRain easing.', 'Counts line', '')).toBe('Rain easing.');
    expect(mergeGeneratedBlock('Counts line', 'Counts line', '')).toBe('');
    expect(mergeGeneratedBlock('Their own text', '', '')).toBe('Their own text');
  });

  it('puts the block above existing operator text', () => {
    expect(mergeGeneratedBlock('Rain easing.', '', 'Incidents: 3')).toBe('Incidents: 3\nRain easing.');
  });
  it('is just the block when the text is empty', () => {
    expect(mergeGeneratedBlock('  ', '', 'Incidents: 3')).toBe('Incidents: 3');
  });
  it('replaces the previous block in place, keeping text around it', () => {
    expect(mergeGeneratedBlock('Incidents: 3\nRain easing.', 'Incidents: 3', 'Incidents: 4')).toBe('Incidents: 4\nRain easing.');
  });
  it('prepends when the operator reworded the previous block away', () => {
    expect(mergeGeneratedBlock('3 jobs so far.', 'Incidents: 3', 'Incidents: 4')).toBe('Incidents: 4\n3 jobs so far.');
  });
});
