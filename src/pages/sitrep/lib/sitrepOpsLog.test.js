import { describe, it, expect } from 'vitest';
import { isDefaultSitrepTag, missingDefaultTags, buildSitrepOpsLogPayload, sitrepOpsLogSubject } from './sitrepOpsLog.js';

describe('default tags', () => {
  it('pre-selects SES (Contact Types) and Information + Update (Entry Purpose) only', () => {
    expect(isDefaultSitrepTag(2, 'SES')).toBe(true);
    expect(isDefaultSitrepTag(4, ' information ')).toBe(true);
    expect(isDefaultSitrepTag(4, 'Update')).toBe(true);
    expect(isDefaultSitrepTag(4, 'Incoming')).toBe(false);
    expect(isDefaultSitrepTag(3, 'SES')).toBe(false);
  });
  it('reports which defaults the loaded tags lack', () => {
    expect(missingDefaultTags({ 2: [{ Name: 'SES' }], 4: [{ Name: 'Information' }, { Name: 'Update' }] })).toEqual([]);
    expect(missingDefaultTags({ 2: [], 4: [{ Name: 'Information' }] })).toEqual(['ses', 'update']);
  });
});

describe('buildSitrepOpsLogPayload', () => {
  it('has the Ops Log create shape with no job, timing, or action flags', () => {
    const p = buildSitrepOpsLogPayload({ entityId: 7, subject: 'S', text: 'T', tagIds: [1, 2], eventId: 5 });
    expect(p).toMatchObject({ EntityId: 7, EventId: 5, JobId: null, Subject: 'S', Text: 'T', TagIds: [1, 2], TimeLogged: null, ActionRequired: false, Important: false, Restricted: false });
  });
});

describe('sitrepOpsLogSubject', () => {
  it('joins sitrep number and event name', () => {
    expect(sitrepOpsLogSubject({ eventName: 'Flooding', sitrepNumber: '3' })).toBe('Sitrep #3 - Flooding');
    expect(sitrepOpsLogSubject({})).toBe('Sitrep');
    expect(sitrepOpsLogSubject({ eventName: 'x'.repeat(80) }).length).toBe(50);
  });
});
