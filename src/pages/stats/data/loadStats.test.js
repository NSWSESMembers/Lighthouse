import { describe, it, expect, vi } from 'vitest';
import { loadJobs, loadClusters } from './loadStats.js';

const ctx = { host: 'https://api.test', userId: '17', token: 't' };

const beaconJob = (Id, Event = null) => ({
  Id, Identifier: `J${Id}`, JobReceived: '2026-10-15T08:00:00', JobStatusTypeHistory: [], Tags: [],
  EntityAssignedTo: { Name: 'Demo City' }, Event,
});

describe('loadJobs', () => {
  const start = new Date('2026-10-14T00:00:00Z');
  const end = new Date('2026-10-15T00:00:00Z');

  it('searches a single unit as an entity, several as an array, none as []', async () => {
    const search = vi.fn(async () => ({ results: [] }));
    const client = { job: { search } };
    const a = { Id: 1 };
    const b = { Id: 2 };
    await loadJobs(client, { units: [a], start, end }, ctx);
    await loadJobs(client, { units: [a, b], start, end }, ctx);
    await loadJobs(client, { units: [], start, end }, ctx);
    expect(search.mock.calls.map((c) => c[0])).toEqual([a, [a, b], []]);
    expect(search).toHaveBeenCalledWith(a, start, end, ctx);
  });

  it('returns facts, events and the total', async () => {
    const results = [beaconJob(1, { Identifier: 'E1', Name: 'Storm' }), beaconJob(2)];
    const client = { job: { search: async () => ({ results }) } };
    const out = await loadJobs(client, { units: [], start, end, clusters: { 'Demo City': { clusterName: 'North' } } }, ctx);
    expect(out.total).toBe(2);
    expect(out.events).toEqual(['E1 - Storm']);
    expect(out.facts.map((f) => [f.id, f.cluster])).toEqual([[1, 'North'], [2, 'North']]);
  });

  it('passes Beacon errors through', async () => {
    const client = { job: { search: async () => { throw Object.assign(new Error('nope'), { status: 500 }); } } };
    await expect(loadJobs(client, { units: [], start, end }, ctx)).rejects.toMatchObject({ status: 500 });
  });
});

describe('loadClusters', () => {
  it('returns the JSON', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ A: { clusterName: 'X' } }) }));
    expect(await loadClusters('/c.json', fetchImpl)).toEqual({ A: { clusterName: 'X' } });
    expect(fetchImpl).toHaveBeenCalledWith('/c.json');
  });

  it('resolves null on failure', async () => {
    expect(await loadClusters('/c.json', async () => ({ ok: false }))).toBeNull();
    expect(await loadClusters('/c.json', async () => { throw new Error('offline'); })).toBeNull();
  });
});
