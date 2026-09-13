import { describe, it, expect } from 'vitest';
import { mapJobNotificationToJobJson, withJobReceivedFallback } from './pushNotificationMapping.js';

describe('mapJobNotificationToJobJson', () => {
  it('remaps notification fields to Job.js-shaped fields', () => {
    const n = {
      Id: 'notification1', // must NOT end up as the job's Id
      JobId: 'job1',
      JobIdentifier: '14/7570',
      ICEMSIncidentIdentifier: '6/1718',
      JobPriorityTypeId: 1,
      JobStatusTypeId: 2,
      Entity: { Id: 'hq1' },
    };
    expect(mapJobNotificationToJobJson(n)).toEqual({
      Id: 'job1',
      Identifier: '14/7570',
      ICEMSIncidentIdentifier: '6/1718',
      JobPriorityTypeId: 1,
      JobStatusTypeId: 2,
      EntityAssignedTo: { Id: 'hq1' },
    });
  });
});

describe('withJobReceivedFallback', () => {
  it('sets JobReceived from the notification CreatedOn when not already tracked', () => {
    const jobJson = { Id: 'job1' };
    const result = withJobReceivedFallback(jobJson, { CreatedOn: '2026-01-01T00:00:00.000Z' }, false);
    expect(result.JobReceived).toBe('2026-01-01T00:00:00.000Z');
  });

  it('does not set JobReceived when already tracked (would clobber the real value)', () => {
    const jobJson = { Id: 'job1' };
    const result = withJobReceivedFallback(jobJson, { CreatedOn: '2026-01-01T00:00:00.000Z' }, true);
    expect(result.JobReceived).toBeUndefined();
  });

  it('mutates and returns the same jobJson instance', () => {
    const jobJson = { Id: 'job1' };
    const result = withJobReceivedFallback(jobJson, { CreatedOn: '2026-01-01T00:00:00.000Z' }, false);
    expect(result).toBe(jobJson);
  });
});
