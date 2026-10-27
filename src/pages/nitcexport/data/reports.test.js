import { describe, it, expect } from 'vitest';
import { participantHours, activityRows, memberReport, buildReport, roundHours, ACTIVITY_HEADER, NO_TAG } from './reports.js';

const person = (Id, FirstName, LastName) => ({ Id, FirstName, LastName, FullName: `${FirstName} ${LastName}` });
const ALEX = person(1, 'Alex', 'Sample');
const SAM = person(2, 'Sam', 'Example');
const ALEX_TOO = person(3, 'Alex', 'Sample'); // same name, different member

function task(over = {}) {
  return {
    Name: 'Rescue training',
    StartDate: '2026-10-20T18:00:00',
    EndDate: '2026-10-20T21:00:00',
    CreatedAt: { Id: 9001, Code: 'DEM', Name: 'Demo City' },
    Tags: [{ Name: 'Training' }],
    Participants: [],
    ...over,
  };
}
const on = (Person, StartDate, EndDate) => ({ Person, StartDate, EndDate });

describe('participantHours', () => {
  it('is the participant\'s own time, to 2 decimal places', () => {
    expect(participantHours(on(ALEX, '2026-10-20T18:00:00', '2026-10-20T20:30:00'), task())).toBe(2.5);
    expect(participantHours(on(ALEX, '2026-10-20T18:00:00', '2026-10-20T18:20:00'), task())).toBe(0.33);
  });

  it('falls back to the task\'s times when the participant has none', () => {
    expect(participantHours(on(ALEX, null, null), task())).toBe(3);
    expect(participantHours(on(ALEX, '2026-10-20T20:00:00', null), task())).toBe(1);
  });

  it('counts 0 for times that make no sense, not NaN or negative hours', () => {
    expect(participantHours(on(ALEX, '2026-10-20T21:00:00', '2026-10-20T18:00:00'), task())).toBe(0);
    expect(participantHours(on(ALEX, null, null), task({ StartDate: null, EndDate: null }))).toBe(0);
  });
});

describe('activityRows', () => {
  it('writes the old columns, ISO times and Name[hours] participants (PR #608)', () => {
    const rows = activityRows([task({
      Name: 'Hall #2 clean (east)',
      Tags: [{ Name: 'Training' }, { Name: 'Maintenance' }],
      Participants: [on(ALEX, '2026-10-20T18:00:00', '2026-10-20T20:30:00'), on(SAM, null, null)],
    })]);
    expect(rows).toEqual([[
      'Hall #2 clean (east)', '2026-10-20T18:00:00+11:00', '2026-10-20T21:00:00+11:00', 'DEM',
      'Training,Maintenance', 2, 5.5, 'Alex Sample[2.5] Sam Example[3]',
    ]]);
    expect(ACTIVITY_HEADER).toHaveLength(rows[0].length);
  });

  it('handles a task with no participants or tags', () => {
    expect(activityRows([task({ Tags: [], Participants: [] })])[0].slice(4)).toEqual(['', 0, 0, '']);
  });
});

describe('memberReport', () => {
  const tasks = [
    task({ Tags: [{ Name: 'Training' }], Participants: [on(SAM, null, null), on(ALEX, null, null)] }),
    task({ Tags: [{ Name: 'community' }, { Name: 'Training' }], Participants: [on(ALEX, '2026-10-20T18:00:00', '2026-10-20T19:00:00')] }),
    task({ Tags: [], Participants: [on(ALEX_TOO, '2026-10-20T18:00:00', '2026-10-20T18:06:00')] }),
  ];

  it('has a column per tag (A to Z, case-blind), No tag last, and Total Hours', () => {
    expect(memberReport(tasks).header).toEqual(['Name', 'TotalHours', 'community', 'Training', NO_TAG]);
  });

  it('adds up each member\'s hours per tag; a two-tag task counts under both', () => {
    const { rows } = memberReport(tasks);
    expect(rows).toEqual([
      ['Alex Sample', 4, 1, 4, 0],
      ['Alex Sample', 0.1, 0, 0, 0.1], // a different member with the same name: their own row
      ['Sam Example', 3, 0, 3, 0],
    ]);
  });

  it('has no No tag column when every task has a tag', () => {
    expect(memberReport(tasks.slice(0, 2)).header).not.toContain(NO_TAG);
  });

  it('is just the header columns with no tasks', () => {
    expect(memberReport([])).toEqual({ header: ['Name', 'TotalHours'], rows: [] });
  });
});

describe('buildReport', () => {
  it('picks the report', () => {
    expect(buildReport('activity', [task()]).header).toBe(ACTIVITY_HEADER);
    expect(buildReport('member', [task()]).header[1]).toBe('TotalHours');
  });
});

describe('roundHours', () => {
  it('drops float dust', () => {
    expect(roundHours(0.1 + 0.2)).toBe(0.3);
  });
});
