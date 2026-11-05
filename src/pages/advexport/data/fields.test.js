import { describe, it, expect } from 'vitest';
import { FIELDS, DEFAULT_KEYS, cellValue, buildRows, orderedKeys, readPath } from './fields.js';

const job = {
  Id: 80001,
  Identifier: '2610-1001',
  JobReceived: '2026-10-27T08:00:00',
  JobPriorityType: { Name: 'Priority' },
  JobType: { Name: 'Storm' },
  JobStatusType: { Name: 'Complete' },
  Tags: [{ Name: 'Tree Down' }, { Name: 'House' }],
  Categories: [{ Id: 10, Name: 'Category 2' }],
  Reconnoitered: false,
  Sector: null,
  EntityAssignedTo: { Code: 'DEM', ParentEntity: { Code: 'DMZ' } },
  Address: { Street: 'Example St', Level: null, Latitude: -33.8 },
  HowToEnterPremises: 'Side gate',
  Event: null,
  JobStatusTypeHistory: [
    { Name: 'Complete', Timelogged: '2026-10-27T11:00:00' },
    { Name: 'New', Timelogged: '2026-10-27T08:00:00' },
    { Name: 'Active', Timelogged: '2026-10-27T08:10:00' },
    { Name: 'Active', Timelogged: '2026-10-27T12:00:00' },
    { Name: 'Complete', Timelogged: '2026-10-27T13:00:00' },
  ],
};

describe('fields', () => {
  it('has unique keys and the old page\'s defaults', () => {
    const keys = FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(DEFAULT_KEYS).toHaveLength(20);
    expect(DEFAULT_KEYS).toContain('JobReceived');
    expect(DEFAULT_KEYS).not.toContain('PermissionToEnterPremises');
  });

  it('reads dotted paths, stopping at a missing part', () => {
    expect(readPath(job, 'EntityAssignedTo.ParentEntity.Code')).toBe('DMZ');
    expect(readPath(job, 'Event.Identifier')).toBeUndefined();
  });
});

describe('cellValue', () => {
  it('reads plain fields and paths', () => {
    expect(cellValue(job, 'Identifier')).toBe('2610-1001');
    expect(cellValue(job, 'JobType.Name')).toBe('Storm');
    expect(cellValue(job, 'Address.Latitude')).toBe(-33.8);
    expect(cellValue(job, 'Reconnoitered')).toBe(false);
  });

  it('gives empty for missing, null and nested-object values', () => {
    expect(cellValue(job, 'Address.Level')).toBe('');
    expect(cellValue(job, 'Sector.Name')).toBe('');
    expect(cellValue(job, 'Event.Identifier')).toBe('');
    expect(cellValue({ Sector: { Name: { x: 1 } } }, 'Sector.Name')).toBe('');
    expect(cellValue(job, 'NotAField')).toBe('');
  });

  it('writes times as ISO 8601 with the offset', () => {
    expect(cellValue(job, 'JobReceived')).toBe('2026-10-27T08:00:00+11:00');
  });

  it('takes the first Active, and the last Complete, whatever order the history is in', () => {
    expect(cellValue(job, 'JobAcknowledged')).toBe('2026-10-27T08:10:00+11:00');
    expect(cellValue(job, 'JobCompleted')).toBe('2026-10-27T13:00:00+11:00');
    expect(cellValue(job, 'JobFinalised')).toBe('');
  });

  it('does not reorder the incident\'s history (the old page did)', () => {
    const before = job.JobStatusTypeHistory.map((h) => h.Timelogged);
    cellValue(job, 'JobAcknowledged');
    cellValue(job, 'JobCompleted');
    expect(job.JobStatusTypeHistory.map((h) => h.Timelogged)).toEqual(before);
  });

  it('joins tag and category names', () => {
    expect(cellValue(job, 'Tags')).toBe('Tree Down,House');
    expect(cellValue(job, 'Categories')).toBe('Category 2');
    expect(cellValue({ Tags: null }, 'Tags')).toBe('');
  });

  it('fills Premises Access - Info from HowToEnterPremises', () => {
    expect(cellValue(job, 'howToEnterPremises')).toBe('Side gate');
  });

  it('gives the flood rescue category number', () => {
    expect(cellValue(job, 'FloodRescueCategories')).toBe(2);
    expect(cellValue({ Categories: [] }, 'FloodRescueCategories')).toBe('');
  });

  it('takes ICEMS update counts from what was counted', () => {
    expect(cellValue(job, 'ICEMSIUMTransactions')).toBe('');
    expect(cellValue(job, 'ICEMSIUMTransactions', { icemsUpdates: new Map([[80001, 3]]) })).toBe(3);
    expect(cellValue(job, 'ICEMSIUMTransactions', { icemsUpdates: new Map([[80001, 0]]) })).toBe(0);
  });
});

describe('buildRows / orderedKeys', () => {
  it('builds a row per incident in the keys\' order', () => {
    expect(buildRows([job, { Identifier: 'X' }], ['Identifier', 'JobType.Name'])).toEqual([['2610-1001', 'Storm'], ['X', '']]);
  });

  it('puts chosen keys in the page\'s order and drops unknown ones', () => {
    expect(orderedKeys(['Tags', 'Identifier', 'Nope', 'Address.Street'])).toEqual(['Identifier', 'Tags', 'Address.Street']);
  });
});
