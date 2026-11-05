import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { filter, simulated } from './asset.js';
import { isSimulationUnavailable } from '../cadenceSimulation.js';

vi.mock('./core/request.js', () => ({ request: vi.fn() }));

function makeLocalStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

const radioAsset = (name, extra = {}) => ({
  properties: { name, entity: 'HQ1', capability: 'Rescue', resourceType: 'Vehicle', lastSeen: '2026-01-01', ...extra },
});

const teleFeature = (displayName, extra = {}) => ({
  properties: { displayName, timestamp: 1735689600, type: 'Vehicle', ...extra },
});

beforeEach(() => {
  global.localStorage = makeLocalStorage();
  vi.mocked(request).mockReset();
});

describe('filter', () => {
  it('merges radio and telematics assets, tagging each with its type', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce([radioAsset('RES1A')]) // radio: array of pages -> flat()
      .mockResolvedValueOnce({ features: [teleFeature('RES1B Vehicle')] }); // telematics

    const result = await filter(null, ctx);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.type === 'psn').name).toContain('(PSN)');
    expect(result.find((r) => r.type === 'telematics').name).toContain('(Tele)');
  });

  it('filters the merged result down to the given asset names', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce([radioAsset('RES1A'), radioAsset('RES2A')])
      .mockResolvedValueOnce({ features: [] });

    const result = await filter(['RES1A (PSN)'], ctx);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('RES1A (PSN)');
  });

  it('returns everything when assetFilter is empty', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce([radioAsset('RES1A')])
      .mockResolvedValueOnce({ features: [] });

    const result = await filter([], ctx);
    expect(result).toHaveLength(1);
  });

  it('continues with telematics results when the radio fetch rejects', async () => {
    vi.mocked(request)
      .mockRejectedValueOnce(new Error('radio down'))
      .mockResolvedValueOnce({ features: [teleFeature('RES1B Vehicle')] });

    const result = await filter(null, ctx);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('telematics');
  });

  it('caches both radio and telematics responses and skips re-fetching within the cache window', async () => {
    vi.mocked(request).mockResolvedValueOnce([radioAsset('RES1A')]).mockResolvedValueOnce({ features: [] });
    await filter(null, ctx);
    expect(vi.mocked(request)).toHaveBeenCalledTimes(2);

    vi.mocked(request).mockClear();
    await filter(null, ctx);
    expect(vi.mocked(request)).not.toHaveBeenCalled();
  });
});

describe('telematics capability', () => {
  const teleCapability = async (displayName) => {
    vi.mocked(request)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ features: [teleFeature(displayName)] });
    const [asset] = await filter(null, ctx);
    return asset.capability;
  };

  it('is the make and model after the callsign, as a plain string', async () => {
    expect(await teleCapability('DEM40 Isuzu D-Max')).toBe('Isuzu D-Max');
  });

  it('ignores stray whitespace', async () => {
    expect(await teleCapability('DEM41A  Toyota HiLux ')).toBe('Toyota HiLux');
  });

  it('drops a dash between the callsign and the model', async () => {
    expect(await teleCapability('DEM43 - Toyota HiLux')).toBe('Toyota HiLux');
  });

  it('is empty when there is only a callsign', async () => {
    expect(await teleCapability('DEM42')).toBe('');
  });
});

describe('simulated exercise feed (ctx.simulation)', () => {
  const FEED = 'https://api.dev.cadence-extension.com/v1';
  const trainCtx = {
    host: 'https://apitrainbeacon.ses.nsw.gov.au',
    token: 'tok',
    userId: 'u1',
    simulation: { exerciseId: 'ex1', copyId: 'individual' },
  };
  // Shaped like the CADence backend's resource-locations feed (values invented).
  const simFeature = (name, extra = {}) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [151.1, -33.9] },
    properties: {
      id: `cadence-ex1-individual-${name}`,
      name,
      entity: 'Demo City',
      capability: 'General Purpose',
      resourceType: 'Vehicle',
      lastSeen: '2026-10-15T01:23:45.000Z',
      direction: 90,
      talkgroup: 'CADence exercise',
      talkgroupLastUpdated: '2026-10-15T01:23:45.000Z',
      radioId: '',
      licensePlate: 'SIM',
      ...extra,
    },
  });
  const radioCacheKey = 'apitrainbeacon.ses.nsw.gov.au-LighthouseFetchedRadioAssets';

  it("reads the radio half from the exercise feed and the telematics half from Beacon", async () => {
    vi.mocked(request)
      .mockResolvedValueOnce([simFeature('DMC56')])
      .mockResolvedValueOnce({ features: [teleFeature('DMC40 Demo Ute')] });

    const result = await filter(null, trainCtx);

    const urls = vi.mocked(request).mock.calls.map(([url]) => url);
    expect(urls[0]).toBe(`${FEED}/feed/exercises/ex1/copies/individual/resource-locations`);
    expect(urls[1]).toMatch(/^https:\/\/apitrainbeacon\.ses\.nsw\.gov\.au\/Api\/v1\/ResourceLocations\/Telematics\?/);
    expect(urls.some((u) => u.includes('/ResourceLocations/Radio'))).toBe(false);
    expect(result.map((r) => r.type).sort()).toEqual(['psn', 'telematics']);
  });

  it('normalises simulated features exactly like PSN radios', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce([simFeature('DMC711', { resourceType: 'Vessel', capability: 'Class 1' })])
      .mockResolvedValueOnce({ features: [] });

    const [vessel] = await filter(null, trainCtx);

    expect(vessel).toMatchObject({
      type: 'psn',
      name: 'DMC711 (PSN)',
      unitCode: 'DMC',
      vehCode: '711',
      markerLabel: 'DMC<br>711',
      entity: 'Demo City',
      capability: 'Class 1',
      resourceType: 'Vessel',
      talkGroup: 'CADence exercise',
      licensePlate: 'SIM',
      lastSeen: '2026-10-15T01:23:45.000Z',
    });
  });

  it('never reads or writes the radio cache', async () => {
    localStorage.setItem(
      radioCacheKey,
      JSON.stringify({ timestamp: Math.round(Date.now() / 1000), data: [radioAsset('REAL1')] }),
    );
    vi.mocked(request).mockResolvedValueOnce([simFeature('DMC56')]).mockResolvedValueOnce({ features: [] });

    const result = await filter(null, trainCtx);

    expect(result.map((r) => r.properties.name)).toEqual(['DMC56']);
    // The cached real feed is still the only thing under the radio key.
    expect(JSON.parse(localStorage.getItem(radioCacheKey)).data[0].properties.name).toBe('REAL1');
  });

  it('fetches fresh positions on every call', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce([simFeature('DMC56')])
      .mockResolvedValueOnce({ features: [] })
      .mockResolvedValueOnce([simFeature('DMC56', { lastSeen: '2026-10-15T01:24:15.000Z' })]);

    await filter(null, trainCtx);
    const [second] = await filter(null, trainCtx);

    expect(second.lastSeen).toBe('2026-10-15T01:24:15.000Z');
    // Telematics was cached by the first call, so only the feed was re-read.
    expect(vi.mocked(request)).toHaveBeenCalledTimes(3);
  });

  it('rejects when the exercise feed fails, instead of returning telematics alone', async () => {
    vi.mocked(request)
      .mockRejectedValueOnce(Object.assign(new Error('Beacon API 502'), { status: 502 }))
      .mockResolvedValueOnce({ features: [teleFeature('DMC40 Demo Ute')] });

    const err = await filter(null, trainCtx).catch((e) => e);
    expect(err.name).toBe('SimulationFeedError');
    expect(err.status).toBe(502);
    expect(isSimulationUnavailable(err)).toBe(false);
  });

  it('reports a refused sign-in as unavailable', async () => {
    vi.mocked(request)
      .mockRejectedValueOnce(Object.assign(new Error('Beacon API 403'), { status: 403 }))
      .mockResolvedValueOnce({ features: [] });

    const err = await filter(null, trainCtx).catch((e) => e);
    expect(isSimulationUnavailable(err)).toBe(true);
  });

  it('refuses a simulation on production without calling the exercise backend', async () => {
    vi.mocked(request).mockResolvedValueOnce({ features: [] }); // telematics
    const prodCtx = { ...trainCtx, host: 'https://apibeacon.ses.nsw.gov.au' };

    const err = await filter(null, prodCtx).catch((e) => e);

    expect(isSimulationUnavailable(err)).toBe(true);
    const urls = vi.mocked(request).mock.calls.map(([url]) => url);
    expect(urls.every((u) => u.startsWith('https://apibeacon.ses.nsw.gov.au/'))).toBe(true);
  });

  it('uses the real feed when the simulation is null', async () => {
    vi.mocked(request).mockResolvedValueOnce([radioAsset('REAL1')]).mockResolvedValueOnce({ features: [] });

    const result = await filter(null, { ...trainCtx, simulation: null });

    expect(vi.mocked(request).mock.calls[0][0]).toMatch(/\/Api\/v1\/ResourceLocations\/Radio\?/);
    expect(result[0].properties.name).toBe('REAL1');
  });

  it("marks each simulated asset with its copy's HQ, and leaves telematics alone", async () => {
    vi.mocked(request)
      .mockResolvedValueOnce([simFeature('DMC56'), simFeature('DMC711')])
      .mockResolvedValueOnce({ features: [teleFeature('DMC40 Demo Ute')] });

    const result = await filter(null, { ...trainCtx, simulation: { ...trainCtx.simulation, participantHqId: 101 } });

    expect(result.filter((r) => r.type === 'psn').map((r) => r.exerciseHqId)).toEqual(['101', '101']);
    expect(result.find((r) => r.type === 'telematics').exerciseHqId).toBeUndefined();
  });

  it('marks nothing when the simulation has no HQ, or for the real feed', async () => {
    vi.mocked(request).mockResolvedValueOnce([simFeature('DMC56')]).mockResolvedValueOnce({ features: [] });
    const [simulatedAsset] = await filter(null, trainCtx);
    expect(simulatedAsset.exerciseHqId).toBeUndefined();

    vi.mocked(request).mockResolvedValueOnce([radioAsset('REAL1')]);
    const [real] = await filter(null, { ...trainCtx, simulation: null });
    expect(real.exerciseHqId).toBeUndefined();
  });

  describe('simulated()', () => {
    it('returns only the exercise assets, normalised like radios, without asking Beacon', async () => {
      vi.mocked(request).mockResolvedValueOnce([
        simFeature('DMC56'),
        simFeature('DMC711', { resourceType: 'Vessel', capability: 'Class 1' }),
      ]);

      const assets = await simulated(trainCtx);

      expect(vi.mocked(request).mock.calls.map(([url]) => url)).toEqual([
        `${FEED}/feed/exercises/ex1/copies/individual/resource-locations`,
      ]);
      expect(assets.map((a) => [a.type, a.name, a.unitCode, a.vehCode, a.resourceType])).toEqual([
        ['psn', 'DMC56 (PSN)', 'DMC', '56', 'Vehicle'],
        ['psn', 'DMC711 (PSN)', 'DMC', '711', 'Vessel'],
      ]);
      expect(localStorage.getItem(radioCacheKey)).toBeNull();
    });

    it('refuses production, and a missing selection, without calling anything', async () => {
      const prod = await simulated({ ...trainCtx, host: 'https://apibeacon.ses.nsw.gov.au' }).catch((e) => e);
      const none = await simulated({ ...trainCtx, simulation: null }).catch((e) => e);

      expect(isSimulationUnavailable(prod)).toBe(true);
      expect(isSimulationUnavailable(none)).toBe(true);
      expect(request).not.toHaveBeenCalled();
    });

    it('passes a refused sign-in on', async () => {
      vi.mocked(request).mockRejectedValueOnce(Object.assign(new Error('403'), { status: 403 }));
      const err = await simulated(trainCtx).catch((e) => e);
      expect(isSimulationUnavailable(err)).toBe(true);
    });

    it('retries a refused sign-in once with the newest token from ctx.refreshToken', async () => {
      vi.mocked(request)
        .mockRejectedValueOnce(Object.assign(new Error('403'), { status: 403 }))
        .mockResolvedValueOnce([simFeature('DMC56')]);
      const assets = await simulated({ ...trainCtx, refreshToken: async () => 'tok-renewed' });
      expect(assets.map((a) => a.name)).toEqual(['DMC56 (PSN)']);
      expect(vi.mocked(request).mock.calls.map(([, opts]) => opts.token)).toEqual(['tok', 'tok-renewed']);
    });
  });

  it('filter() retries the simulated feed with the newest token too, and Beacon keeps its own token', async () => {
    vi.mocked(request).mockImplementation(async (url, { token }) => {
      if (url.startsWith(FEED)) {
        if (token !== 'tok-renewed') throw Object.assign(new Error('403'), { status: 403 });
        return [simFeature('DMC56')];
      }
      return { features: [] };
    });
    const result = await filter(null, { ...trainCtx, refreshToken: async () => 'tok-renewed' });
    expect(result.map((a) => a.name)).toEqual(['DMC56 (PSN)']);
    const calls = vi.mocked(request).mock.calls.map(([url, opts]) => [url.startsWith(FEED) ? 'feed' : 'beacon', opts.token]);
    expect(calls).toEqual([
      ['feed', 'tok'],
      ['beacon', 'tok'],
      ['feed', 'tok-renewed'],
    ]);
  });
});
