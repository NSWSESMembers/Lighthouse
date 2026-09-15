import { describe, it, expect } from 'vitest';
import { buildSmsRecipientsFromTeam, buildSmsPrefillFromTasking, buildSmsPrefillFromJob } from './smsHelpers.js';

describe('buildSmsRecipientsFromTeam', () => {
  it('maps team members to {id, name, isTeamLeader}', () => {
    const team = {
      members: () => [
        { Person: { Id: 1, FirstName: 'Jane', LastName: 'Doe' }, TeamLeader: true },
        { Person: { Id: 2, FirstName: 'John', LastName: 'Smith' }, TeamLeader: false },
      ],
    };
    expect(buildSmsRecipientsFromTeam(team)).toEqual([
      { id: 1, name: 'Jane Doe', isTeamLeader: true },
      { id: 2, name: 'John Smith', isTeamLeader: false },
    ]);
  });

  it('returns [] for a team with no members', () => {
    expect(buildSmsRecipientsFromTeam({ members: () => [] })).toEqual([]);
  });
});

describe('buildSmsPrefillFromTasking', () => {
  it('builds header/text from the tasking\'s job', () => {
    const tasking = {
      job: {
        id: () => 'job1',
        identifier: () => '14/7570',
        address: { prettyAddress: () => '1 Main St, Sydney' },
      },
    };
    const result = buildSmsPrefillFromTasking(tasking);
    expect(result.taskId).toBe('job1');
    expect(result.headerLabel).toBe('Send SMS - Incident: 14/7570');
    expect(result.initialText).toBe('Re: Inc 14/7570 at 1 Main St, Sydney: ');
  });
});

describe('buildSmsPrefillFromJob', () => {
  function job(overrides = {}) {
    return {
      id: () => 'job1',
      identifier: () => '14/7570',
      priorityName: () => 'Rescue',
      typeShort: () => 'FR',
      categoriesNameNumberDash: () => '-1',
      entityAssignedTo: { code: () => 'HQ1' },
      contactFirstName: () => 'Jane',
      contactLastName: () => 'Doe',
      address: { prettyAddress: () => '1 Main St' },
      contactPhoneNumber: () => '0400000000',
      tagsCsv: () => 'Urgent',
      situationOnScene: () => 'Tree down',
      ...overrides,
    };
  }

  it('builds header/taskId from the job', () => {
    const result = buildSmsPrefillFromJob(job());
    expect(result.taskId).toBe('job1');
    expect(result.headerLabel).toBe('Send SMS - Incident: 14/7570');
  });

  it('joins non-empty fields with spaces and uppercases the result', () => {
    const result = buildSmsPrefillFromJob(job());
    expect(result.initialText).toBe('RESCUE FR-1 HQ1 14/7570 JANE DOE 1 MAIN ST 0400000000 URGENT TREE DOWN');
  });

  it('drops empty/falsy fields from the joined text', () => {
    const result = buildSmsPrefillFromJob(job({ situationOnScene: () => '', tagsCsv: () => '' }));
    expect(result.initialText).not.toContain('  '); // no double-space gaps
    expect(result.initialText.endsWith('0400000000')).toBe(true);
  });
});
