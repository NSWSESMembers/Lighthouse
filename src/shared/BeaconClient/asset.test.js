import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { filter } from './asset.js';

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
