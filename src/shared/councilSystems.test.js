import { describe, it, expect } from 'vitest';
import { fetchCouncilDataset, fetchCouncilPath, COUNCIL_SYSTEMS_URL } from './councilSystems.js';

const reply = (status, body) => async (url, opts) => ({ ok: status < 300, status, url, opts, json: async () => body });

describe('fetchCouncilDataset', () => {
  it('GETs the dataset with the Beacon token and no cookies', async () => {
    let seen;
    const body = { type: 'FeatureCollection', features: [], meta: { ok: true } };
    const out = await fetchCouncilDataset('example', 'water-levels', 'tok', {
      fetchImpl: async (url, opts) => { seen = { url, opts }; return reply(200, body)(); },
    });
    expect(out).toBe(body);
    expect(seen.url).toBe(`${COUNCIL_SYSTEMS_URL}/example/water-levels`);
    expect(seen.opts).toMatchObject({ headers: { Authorization: 'Bearer tok' }, credentials: 'omit' });
  });

  it('throws on an HTTP error or a body that is not a FeatureCollection', async () => {
    await expect(fetchCouncilDataset('example', 'x', 't', { fetchImpl: reply(502, {}) })).rejects.toThrow('HTTP 502');
    await expect(fetchCouncilDataset('example', 'x', 't', { fetchImpl: reply(200, { error: 'x' }) })).rejects.toThrow('unexpected response');
  });

  it('throws when the source is down with nothing cached, but keeps stale features', async () => {
    const down = { features: [], meta: { ok: false, system: 'ExampleSys' } };
    await expect(fetchCouncilDataset('example', 'x', 't', { fetchImpl: reply(200, down) })).rejects.toThrow('ExampleSys is not responding');
    const stale = { features: [{ type: 'Feature' }], meta: { ok: false } };
    await expect(fetchCouncilDataset('example', 'x', 't', { fetchImpl: reply(200, stale) })).resolves.toBe(stale);
  });

  it('refuses anything but a plain council and dataset, without fetching', async () => {
    const fetchImpl = async () => { throw new Error('fetched'); };
    for (const [council, dataset] of [['example', '../x'], ['https://example.test', 'x'], ['Example', 'x'], ['example', 'x/y']]) {
      await expect(fetchCouncilDataset(council, dataset, 'tok', { fetchImpl })).rejects.toThrow('bad path');
    }
  });
});

describe('fetchCouncilPath', () => {
  const body = { type: 'FeatureCollection', features: [], meta: { ok: true } };

  it('GETs a path under the council systems URL', async () => {
    let seen;
    await fetchCouncilPath('example/cameras/cam-1', 'tok', { fetchImpl: async (url) => { seen = url; return reply(200, body)(); } });
    expect(seen).toBe(`${COUNCIL_SYSTEMS_URL}/example/cameras/cam-1`);
  });

  it('refuses anything but a plain path, without fetching', async () => {
    let fetched = 0;
    const fetchImpl = async () => { fetched++; return reply(200, body)(); };
    for (const path of ['https://example.test/x/y', '//example.test/x', 'example/../../x', 'example', 'a/b/c/d', 'a/b?x=1', '', null]) {
      await expect(fetchCouncilPath(path, 'tok', { fetchImpl })).rejects.toThrow('bad path');
    }
    expect(fetched).toBe(0);
  });
});
