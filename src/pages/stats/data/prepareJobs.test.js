import { describe, it, expect } from 'vitest';
import {
  prepareJob, prepareJobs, stormDamageAggregate, statusTimes, zoneName, clusterName, agencyName, eventLabels,
  NOT_APPLICABLE, UNASSIGNED, FROM_ICEMS, NOT_ICEMS,
} from './prepareJobs.js';

const h = (Type, Timelogged) => ({ Type, Timelogged });

function job(overrides = {}) {
  return {
    Id: 1,
    Identifier: '2610-0001',
    JobReceived: '2026-10-15T08:00:00',
    JobStatusType: { Id: 6, Name: 'Complete' },
    JobPriorityType: { Id: 4, Name: 'General' },
    JobType: { Id: 1, Name: 'Storm' },
    Type: 'Storm',
    ReferringAgency: null,
    Event: { Identifier: 'EVT-1', Name: 'Demo Storm' },
    EntityAssignedTo: { Id: 10, Name: 'Demo City', ParentEntity: { Id: 9000, Name: 'Demo Zone' } },
    Sector: null,
    Categories: [],
    Address: { Locality: 'Northvale', PrettyAddress: '1 Example St, Northvale NSW 2999' },
    LGA: 'Demo City Council',
    ICEMSIncidentIdentifier: null,
    SituationOnScene: 'Tree down',
    Tags: [],
    JobStatusTypeHistory: [h(1, '2026-10-15T08:00:00'), h(2, '2026-10-15T08:10:00'), h(6, '2026-10-15T10:10:00')],
    ...overrides,
  };
}

describe('stormDamageAggregate', () => {
  it('combines the kinds a job covers, sorted', () => {
    expect(stormDamageAggregate(['Tree Down', 'Roof Damage', 'Branch Down'])).toBe('Damage+Tree');
    expect(stormDamageAggregate(['Leaking Roof'])).toBe('Leak');
  });

  it('is N/A when no storm-damage tags apply', () => {
    expect(stormDamageAggregate(['House'])).toBe(NOT_APPLICABLE);
    expect(stormDamageAggregate([])).toBe(NOT_APPLICABLE);
  });
});

describe('statusTimes', () => {
  it('times Active to the first Complete', () => {
    const t = statusTimes([h(1, '2026-10-15T08:00:00'), h(2, '2026-10-15T08:10:00'), h(6, '2026-10-15T10:10:00'), h(6, '2026-10-15T12:00:00')]);
    expect(t.durationMs).toBe(2 * 3600 * 1000);
    expect(t.closed).toEqual(new Date('2026-10-15T10:10:00'));
  });

  it('uses the first Active when there are several', () => {
    const t = statusTimes([h(2, '2026-10-15T08:00:00'), h(2, '2026-10-15T09:00:00'), h(6, '2026-10-15T10:00:00')]);
    expect(t.durationMs).toBe(2 * 3600 * 1000);
  });

  it('closes on Cancelled or Finalised without a duration', () => {
    expect(statusTimes([h(2, '2026-10-15T08:00:00'), h(7, '2026-10-15T09:00:00')])).toEqual({
      closed: new Date('2026-10-15T09:00:00'),
      durationMs: 0,
    });
    expect(statusTimes([h(8, '2026-10-15T09:00:00')]).closed).toEqual(new Date('2026-10-15T09:00:00'));
  });

  it('has no duration without an Active entry', () => {
    expect(statusTimes([h(1, '2026-10-15T08:00:00'), h(6, '2026-10-15T09:00:00')]).durationMs).toBe(0);
  });

  it('never goes negative', () => {
    expect(statusTimes([h(6, '2026-10-15T08:00:00'), h(2, '2026-10-15T09:00:00')]).durationMs).toBe(0);
  });

  it('copes with no history', () => {
    expect(statusTimes(undefined)).toEqual({ closed: null, durationMs: 0 });
  });
});

describe('zoneName', () => {
  it('is the parent for a unit', () => {
    expect(zoneName({ Name: 'Demo City', ParentEntity: { Id: 9000, Name: 'Demo Zone' } })).toBe('Demo Zone');
  });

  it('is itself for a zone (parent is State)', () => {
    expect(zoneName({ Name: 'Demo Zone', ParentEntity: { Id: 1, Name: 'State' } })).toBe('Demo Zone');
  });

  it('is itself for State', () => {
    expect(zoneName({ Name: 'State' })).toBe('State');
  });

  it('is N/A with no entity', () => {
    expect(zoneName(null)).toBe(NOT_APPLICABLE);
  });
});

describe('clusterName', () => {
  const clusters = { 'Demo-City': { clusterName: 'Demo North' }, Plain: { clusterName: 'Plain Cluster' } };

  it('matches "A - B" names against the file\'s "A-B" keys', () => {
    expect(clusterName('Demo - City', clusters)).toBe('Demo North');
    expect(clusterName('Plain', clusters)).toBe('Plain Cluster');
  });

  it('is Unknown when not listed or no table loaded', () => {
    expect(clusterName('Nowhere', clusters)).toBe('Unknown');
    expect(clusterName('Plain', null)).toBe('Unknown');
  });
});

describe('agencyName', () => {
  it('handles strings, objects and nothing', () => {
    expect(agencyName('Police')).toBe('Police');
    expect(agencyName({ Name: 'FRNSW' })).toBe('FRNSW');
    expect(agencyName(null)).toBe(NOT_APPLICABLE);
  });
});

describe('prepareJob', () => {
  it('flattens a job into a fact', () => {
    const f = prepareJob(job({
      Tags: [
        { Name: 'Tree Down', TagGroupId: 5 },
        { Name: 'Powerlines Down', TagGroupId: 7 },
        { Name: 'House', TagGroupId: 10 },
        { Name: 'Shed', TagGroupId: 13 },
        { Name: 'Other', TagGroupId: 99 },
      ],
      Sector: { Name: 'Sector A' },
      Categories: [{ Name: 'Category 1' }, { Name: 'Category 2' }],
      ReferringAgency: 'Police',
    }), { clusters: { 'Demo City': { clusterName: 'Demo North' } } });

    expect(f).toMatchObject({
      id: 1,
      identifier: '2610-0001',
      received: new Date('2026-10-15T08:00:00'),
      closed: new Date('2026-10-15T10:10:00'),
      durationMs: 2 * 3600 * 1000,
      status: 'Complete',
      type: 'Storm',
      priority: 'General',
      agency: 'Police',
      event: 'EVT-1',
      unit: 'Demo City',
      cluster: 'Demo North',
      zone: 'Demo Zone',
      sector: 'Sector A',
      category: 'Category 1',
      locality: 'Northvale',
      lga: 'Demo City Council',
      icems: NOT_ICEMS,
      address: '1 Example St, Northvale NSW 2999',
      situation: 'Tree down',
      stormDamage: 'Tree',
      hazardTags: ['Powerlines Down'],
      propertyTags: ['House', 'Shed'],
    });
  });

  it('marks incidents that came in through ICEMS', () => {
    expect(prepareJob(job({ ICEMSIncidentIdentifier: 'DEMO-ICEMS-1' })).icems).toBe(FROM_ICEMS);
    expect(prepareJob(job({ ICEMSIncidentIdentifier: '' })).icems).toBe(NOT_ICEMS);
  });

  it('fills placeholders for missing fields', () => {
    const f = prepareJob(job({
      Event: null, Sector: null, Categories: undefined, Address: {}, SituationOnScene: null, Tags: undefined,
    }));
    expect(f.event).toBe(NOT_APPLICABLE);
    expect(f.sector).toBe(UNASSIGNED);
    expect(f.category).toBe(UNASSIGNED);
    expect(f.locality).toBe(NOT_APPLICABLE);
    expect(prepareJob(job({ LGA: null })).lga).toBe(NOT_APPLICABLE);
    expect(f.situation).toBe('');
    expect(f.hazardTags).toEqual([]);
    expect(f.cluster).toBe('Unknown');
  });

  it('does not modify the Beacon job', () => {
    const j = job();
    const copy = structuredClone(j);
    prepareJob(j);
    expect(j).toEqual(copy);
  });

  it('prepareJobs maps every job', () => {
    expect(prepareJobs([job(), job({ Id: 2 })]).map((f) => f.id)).toEqual([1, 2]);
  });
});

describe('eventLabels', () => {
  it('lists distinct events in first-seen order', () => {
    const e = (Identifier, Name) => ({ Event: { Identifier, Name } });
    expect(eventLabels([e('B', 'Two'), e('A', 'One'), e('B', 'Two'), { Event: null }])).toEqual(['B - Two', 'A - One']);
  });
});
