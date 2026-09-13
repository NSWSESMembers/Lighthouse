// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadSharedMapping, saveSharedMapping, fetchSharedDefaults, pushSharedDefault } from './defaultAssetSync.js';

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('loadSharedMapping / saveSharedMapping', () => {
  it('round-trips a mapping through localStorage', () => {
    saveSharedMapping({ team1: 'asset1' });
    expect(loadSharedMapping()).toEqual({ team1: 'asset1' });
  });

  it('defaults to {} when nothing is cached', () => {
    expect(loadSharedMapping()).toEqual({});
  });

  it('defaults to {} on corrupt JSON rather than throwing', () => {
    localStorage.setItem('lh_sharedDefaultAssets', 'not json');
    expect(loadSharedMapping()).toEqual({});
  });

  it('stamps a fetch timestamp on save', () => {
    saveSharedMapping({});
    expect(localStorage.getItem('lh_sharedDefaultAssets_ts')).toBeTruthy();
  });
});

describe('fetchSharedDefaults', () => {
  it('returns the cache without calling fetch when teamIds is empty', async () => {
    global.fetch = vi.fn();
    saveSharedMapping({ team1: 'asset1' });
    const result = await fetchSharedDefaults('https://beacon.test', [], 'tok');
    expect(fetch).not.toHaveBeenCalled();
    expect(result).toEqual({ team1: 'asset1' });
  });

  it('merges fresh data for requested ids while keeping unrelated cached ids', async () => {
    saveSharedMapping({ teamOld: 'assetOld', team1: 'stale' });
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ mapping: { team1: 'fresh1' } }));
    const result = await fetchSharedDefaults('https://beacon.test', ['team1'], 'tok');
    expect(result).toEqual({ teamOld: 'assetOld', team1: 'fresh1' });
    expect(loadSharedMapping()).toEqual(result);
  });

  it('deletes a requested id from the merged result when the Lambda no longer has a mapping for it', async () => {
    saveSharedMapping({ team1: 'stale' });
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ mapping: {} }));
    const result = await fetchSharedDefaults('https://beacon.test', ['team1'], 'tok');
    expect(result.team1).toBeUndefined();
  });

  it('falls back to the cache on a non-2xx response', async () => {
    saveSharedMapping({ team1: 'cached' });
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    const result = await fetchSharedDefaults('https://beacon.test', ['team1'], 'tok');
    expect(result).toEqual({ team1: 'cached' });
  });

  it('falls back to the cache when fetch rejects', async () => {
    saveSharedMapping({ team1: 'cached' });
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await fetchSharedDefaults('https://beacon.test', ['team1'], 'tok');
    expect(result).toEqual({ team1: 'cached' });
  });

  it('sends the Authorization header and requested team ids', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ mapping: {} }));
    await fetchSharedDefaults('https://beacon.test', ['team1', 'team2'], 'tok123');
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('teamIds=team1,team2');
    expect(opts.headers.Authorization).toBe('Bearer tok123');
  });
});

describe('pushSharedDefault', () => {
  it('does nothing when assetId is falsy', async () => {
    global.fetch = vi.fn();
    await pushSharedDefault('https://beacon.test', 'team1', null, 'tok');
    expect(fetch).not.toHaveBeenCalled();
    expect(loadSharedMapping()).toEqual({});
  });

  it('optimistically updates localStorage before the remote write', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    await pushSharedDefault('https://beacon.test', 'team1', 'asset1', 'tok');
    expect(loadSharedMapping()).toEqual({ team1: 'asset1' });
    const [, opts] = fetch.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({ apiUrl: 'https://beacon.test', teamId: 'team1', assetId: 'asset1' });
  });

  it('keeps the optimistic local write even if the remote PUT fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(pushSharedDefault('https://beacon.test', 'team1', 'asset1', 'tok')).resolves.toBeUndefined();
    expect(loadSharedMapping()).toEqual({ team1: 'asset1' });
  });
});
