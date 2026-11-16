import { describe, it, expect } from 'vitest';
import { incidentId, incidentFromBeacon, shortAddress } from './incident.js';

const job = {
  Id: 70013,
  Identifier: '2611-0013',
  JobType: { Name: 'Storm' },
  JobStatusType: { Name: 'Tasked' },
  JobPriorityType: { Name: 'Priority', Description: 'Priority Response' },
  JobReceived: '2026-11-15T08:32:00',
  Address: { PrettyAddress: '172 Pretend Way, Demo City, NSW 2999' },
  SituationOnScene: 'Tree over the fence.',
  Tags: [{ Name: 'Demo Tag' }, { Name: 'Tree Down' }],
  EntityAssignedTo: { Code: 'DEM', ParentEntity: { Code: 'DMZ' } },
};

describe('incidentFromBeacon', () => {
  it('keeps what the popup shows', () => {
    expect(incidentFromBeacon(job, 'https://beacon.test')).toEqual({
      number: '2611-0013',
      typeName: 'Storm',
      statusName: 'Tasked',
      priority: 'Priority Response',
      priorityKey: 'priority',
      address: '172 Pretend Way, Demo City, NSW 2999',
      situation: 'Tree over the fence.',
      tags: 'Demo Tag, Tree Down',
      received: '08:32:00 15/11/2026',
      hq: 'DEM - DMZ',
      beaconUrl: 'https://beacon.test/Jobs/70013',
    });
  });

  it('colours rescues, and copes with missing fields', () => {
    const out = incidentFromBeacon({ Id: 1, JobPriorityType: { Name: 'Rescue', Description: 'Rescue' } }, 'https://beacon.test');
    expect(out).toMatchObject({ number: '', priorityKey: 'rescue', address: '', situation: '', tags: '', received: '', hq: '' });
    expect(incidentFromBeacon({ Id: 2 }, '').priorityKey).toBe('general');
  });
});

describe('incident numbers and addresses', () => {
  it('drops the dash for Beacon\'s API', () => {
    expect(incidentId('2611-0013')).toBe('26110013');
  });

  it('leaves the state off the address, as the old page did', () => {
    expect(shortAddress('172 Pretend Way, Demo City, NSW 2999')).toBe('172 Pretend Way, Demo City 2999');
    expect(shortAddress(null)).toBe('');
  });
});
