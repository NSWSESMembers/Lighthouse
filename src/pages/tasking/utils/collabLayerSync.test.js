// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadCachedLayerIndex, loadCachedLayer, getSubscribedLayerIds, isSubscribed,
  subscribeLayer, unsubscribeLayer, migrateLegacyVisibleLayersToSubscriptions,
  listLayers, createLayer, deleteLayer, updateLayerModerators, updateLayerPermissions,
  updateLayerAttachment, fetchLayerMarkers, upsertMarker, deleteMarker, addMarkerComment,
} from './collabLayerSync.js';

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('local cache / subscriptions', () => {
  it('loadCachedLayerIndex/loadCachedLayer default to []/null', () => {
    expect(loadCachedLayerIndex()).toEqual([]);
    expect(loadCachedLayer('layer1')).toBeNull();
  });

  it('tolerates corrupt JSON', () => {
    localStorage.setItem('lh_collabLayers_index', 'not json');
    expect(loadCachedLayerIndex()).toEqual([]);
  });

  it('subscribeLayer/unsubscribeLayer/isSubscribed round-trip (ids coerced to string)', () => {
    subscribeLayer(42);
    expect(isSubscribed('42')).toBe(true);
    expect(isSubscribed(42)).toBe(true);
    unsubscribeLayer(42);
    expect(isSubscribed(42)).toBe(false);
  });

  it('getSubscribedLayerIds tolerates corrupt JSON', () => {
    localStorage.setItem('lh_collabLayer_subscriptions', 'not json');
    expect(getSubscribedLayerIds()).toEqual(new Set());
  });

  describe('migrateLegacyVisibleLayersToSubscriptions', () => {
    it('migrates legacy ov.online-collab-* = "1" flags into the subscriptions set', () => {
      localStorage.setItem('ov.online-collab-layer1', '1');
      localStorage.setItem('ov.online-collab-layer2', '0'); // explicitly hidden -- not migrated
      localStorage.setItem('unrelated-key', '1');
      migrateLegacyVisibleLayersToSubscriptions();
      expect(getSubscribedLayerIds()).toEqual(new Set(['layer1']));
    });

    it('is a no-op once the subscriptions key already exists (even if empty)', () => {
      localStorage.setItem('lh_collabLayer_subscriptions', '[]');
      localStorage.setItem('ov.online-collab-layer1', '1');
      migrateLegacyVisibleLayersToSubscriptions();
      expect(getSubscribedLayerIds()).toEqual(new Set());
    });
  });
});

describe('listLayers', () => {
  it('returns the cache without fetching when apiUrl is missing', async () => {
    global.fetch = vi.fn();
    localStorage.setItem('lh_collabLayers_index', JSON.stringify([{ id: 'l1' }]));
    const result = await listLayers(null, 'tok');
    expect(fetch).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: 'l1' }]);
  });

  it('caches the unfiltered list on success', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ layers: [{ id: 'l1' }] }));
    const result = await listLayers('https://beacon.test', 'tok');
    expect(result).toEqual([{ id: 'l1' }]);
    expect(loadCachedLayerIndex()).toEqual([{ id: 'l1' }]);
  });

  it('does NOT overwrite the cache for an HQ-scoped request', async () => {
    localStorage.setItem('lh_collabLayers_index', JSON.stringify([{ id: 'l1', hqId: 'hqA' }, { id: 'l2', hqId: 'hqB' }]));
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ layers: [{ id: 'l1', hqId: 'hqA' }] }));
    const result = await listLayers('https://beacon.test', 'tok', 'hqA');
    expect(result).toEqual([{ id: 'l1', hqId: 'hqA' }]);
    // cache is untouched -- still has both layers
    expect(loadCachedLayerIndex()).toHaveLength(2);
  });

  it('falls back to a client-side HQ filter over the full cache on failure', async () => {
    localStorage.setItem('lh_collabLayers_index', JSON.stringify([{ id: 'l1', hqId: 'hqA' }, { id: 'l2', hqId: 'hqB' }]));
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    const result = await listLayers('https://beacon.test', 'tok', 'hqA');
    expect(result).toEqual([{ id: 'l1', hqId: 'hqA' }]);
  });

  it('falls back to the cache on a fetch error', async () => {
    localStorage.setItem('lh_collabLayers_index', JSON.stringify([{ id: 'l1' }]));
    global.fetch = vi.fn().mockRejectedValue(new Error('down'));
    expect(await listLayers('https://beacon.test', 'tok')).toEqual([{ id: 'l1' }]);
  });
});

describe('createLayer', () => {
  const permissions = { hq: { id: 'hqA', name: 'HQ A' } };

  it('returns null without fetching when required fields are missing', async () => {
    global.fetch = vi.fn();
    expect(await createLayer(null, 'name', 'actor1', 'tok', permissions)).toBeNull();
    expect(await createLayer('https://beacon.test', '  ', 'actor1', 'tok', permissions)).toBeNull();
    expect(await createLayer('https://beacon.test', 'name', 'actor1', 'tok', {})).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('trims the name and defaults mode fields to "anyone"', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ id: 'l1', name: 'My Layer' }));
    await createLayer('https://beacon.test', '  My Layer  ', 'actor1', 'tok', permissions);
    const [, opts] = fetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.name).toBe('My Layer');
    expect(body.markerMode).toBe('anyone');
    expect(body.moderators).toEqual([]);
  });

  it('appends the created layer to the cached index on success', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ id: 'l1', name: 'My Layer' }));
    const layer = await createLayer('https://beacon.test', 'My Layer', 'actor1', 'tok', permissions);
    expect(layer).toEqual({ id: 'l1', name: 'My Layer' });
    expect(loadCachedLayerIndex()).toEqual([{ id: 'l1', name: 'My Layer' }]);
  });

  it('returns null and does not touch the cache on failure', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    const layer = await createLayer('https://beacon.test', 'My Layer', 'actor1', 'tok', permissions);
    expect(layer).toBeNull();
    expect(loadCachedLayerIndex()).toEqual([]);
  });
});

describe('deleteLayer', () => {
  it('returns false without fetching when required fields are missing', async () => {
    global.fetch = vi.fn();
    expect(await deleteLayer(null, 'l1', 'actor1', 'tok')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('optimistically removes the layer from the index, then confirms on success', async () => {
    localStorage.setItem('lh_collabLayers_index', JSON.stringify([{ id: 'l1' }, { id: 'l2' }]));
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const result = await deleteLayer('https://beacon.test', 'l1', 'actor1', 'tok');
    expect(result).toBe(true);
    expect(loadCachedLayerIndex()).toEqual([{ id: 'l2' }]);
  });

  it('restores the optimistically-removed entry if the remote delete fails', async () => {
    localStorage.setItem('lh_collabLayers_index', JSON.stringify([{ id: 'l1' }, { id: 'l2' }]));
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    const result = await deleteLayer('https://beacon.test', 'l1', 'actor1', 'tok');
    expect(result).toBe(false);
    expect(loadCachedLayerIndex()).toEqual([{ id: 'l1' }, { id: 'l2' }]);
  });

  it('clears the per-layer cache entry on success', async () => {
    localStorage.setItem('lh_collabLayer_l1', JSON.stringify({ id: 'l1', markers: [] }));
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    await deleteLayer('https://beacon.test', 'l1', 'actor1', 'tok');
    expect(loadCachedLayer('l1')).toBeNull();
  });
});

describe('updateLayerModerators / updateLayerPermissions / updateLayerAttachment', () => {
  it('each returns null without fetching when required ids are missing', async () => {
    global.fetch = vi.fn();
    expect(await updateLayerModerators(null, 'l1', [], 'tok')).toBeNull();
    expect(await updateLayerPermissions(null, 'l1', {}, 'tok')).toBeNull();
    expect(await updateLayerAttachment('https://beacon.test', 'l1', {}, 'tok')).toBeNull(); // missing hq.id
    expect(fetch).not.toHaveBeenCalled();
  });

  it('updateLayerModerators reconciles both the index entry and the cached layer', async () => {
    localStorage.setItem('lh_collabLayers_index', JSON.stringify([{ id: 'l1', moderators: [] }]));
    localStorage.setItem('lh_collabLayer_l1', JSON.stringify({ id: 'l1', moderators: [] }));
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ moderators: [{ id: 'u1', name: 'Jane' }] }));

    const saved = await updateLayerModerators('https://beacon.test', 'l1', [{ id: 'u1', name: 'Jane' }], 'tok');
    expect(saved).toEqual([{ id: 'u1', name: 'Jane' }]);
    expect(loadCachedLayerIndex()[0].moderators).toEqual(saved);
    expect(loadCachedLayer('l1').moderators).toEqual(saved);
  });

  it('updateLayerPermissions returns null and leaves the cache untouched on failure', async () => {
    localStorage.setItem('lh_collabLayers_index', JSON.stringify([{ id: 'l1', markerMode: 'anyone' }]));
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, false, 403));
    const saved = await updateLayerPermissions('https://beacon.test', 'l1', { markerMode: 'moderators' }, 'tok');
    expect(saved).toBeNull();
    expect(loadCachedLayerIndex()[0].markerMode).toBe('anyone');
  });

  it('updateLayerAttachment reconciles the index entry via Object.assign', async () => {
    localStorage.setItem('lh_collabLayers_index', JSON.stringify([{ id: 'l1', hqId: 'hqA' }]));
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ hqId: 'hqB', hqName: 'HQ B', eventId: null }));
    const saved = await updateLayerAttachment('https://beacon.test', 'l1', { hq: { id: 'hqB', name: 'HQ B' } }, 'tok');
    expect(saved.hqId).toBe('hqB');
    expect(loadCachedLayerIndex()[0].hqId).toBe('hqB');
  });
});

describe('fetchLayerMarkers', () => {
  it('returns the cached layer without fetching when apiUrl is missing', async () => {
    global.fetch = vi.fn();
    localStorage.setItem('lh_collabLayer_l1', JSON.stringify({ id: 'l1', markers: [] }));
    const result = await fetchLayerMarkers(null, 'l1', 'tok');
    expect(fetch).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'l1', markers: [] });
  });

  it('caches the layer on success', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ id: 'l1', markers: [{ id: 'm1' }] }));
    const result = await fetchLayerMarkers('https://beacon.test', 'l1', 'tok');
    expect(result.markers).toHaveLength(1);
    expect(loadCachedLayer('l1').markers).toHaveLength(1);
  });

  it('falls back to the cache on failure', async () => {
    localStorage.setItem('lh_collabLayer_l1', JSON.stringify({ id: 'l1', markers: [{ id: 'm1' }] }));
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    const result = await fetchLayerMarkers('https://beacon.test', 'l1', 'tok');
    expect(result.markers).toHaveLength(1);
  });
});

describe('upsertMarker', () => {
  it('returns null without fetching when required args are missing', async () => {
    global.fetch = vi.fn();
    expect(await upsertMarker(null, 'l1', { lat: 1, lng: 2 }, 'actor1', 'tok')).toBeNull();
    expect(await upsertMarker('https://beacon.test', 'l1', null, 'actor1', 'tok')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('optimistically adds a new marker to the cache before the fetch resolves, then reconciles with the server id', async () => {
    localStorage.setItem('lh_collabLayer_l1', JSON.stringify({ id: 'l1', markers: [] }));
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ id: 'server-1', lat: 1, lng: 2 }));

    const saved = await upsertMarker('https://beacon.test', 'l1', { lat: 1, lng: 2, icon: 'x', fill: '#fff' }, 'actor1', 'tok');
    expect(saved.id).toBe('server-1');
    const cached = loadCachedLayer('l1');
    expect(cached.markers).toHaveLength(1);
    expect(cached.markers[0].id).toBe('server-1');
  });

  it('updates an existing marker in place when marker.id matches', async () => {
    localStorage.setItem('lh_collabLayer_l1', JSON.stringify({ id: 'l1', markers: [{ id: 'm1', lat: 0, lng: 0 }] }));
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ id: 'm1', lat: 5, lng: 5 }));
    await upsertMarker('https://beacon.test', 'l1', { id: 'm1', lat: 5, lng: 5 }, 'actor1', 'tok');
    const cached = loadCachedLayer('l1');
    expect(cached.markers).toHaveLength(1);
    expect(cached.markers[0].lat).toBe(5);
  });

  it('returns the optimistic marker (not null) when the remote write fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('down'));
    const result = await upsertMarker('https://beacon.test', 'l1', { lat: 1, lng: 2 }, 'actor1', 'tok');
    expect(result).not.toBeNull();
    expect(result.lat).toBe(1);
    expect(result.deleted).toBe(false);
  });
});

describe('deleteMarker', () => {
  it('is a no-op without fetching when required args are missing', async () => {
    global.fetch = vi.fn();
    await deleteMarker(null, 'l1', 'm1', 'actor1', 'tok');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('optimistically removes the marker from the cache before firing the request', async () => {
    localStorage.setItem('lh_collabLayer_l1', JSON.stringify({ id: 'l1', markers: [{ id: 'm1' }, { id: 'm2' }] }));
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    await deleteMarker('https://beacon.test', 'l1', 'm1', 'actor1', 'tok');
    expect(loadCachedLayer('l1').markers).toEqual([{ id: 'm2' }]);
  });

  it('does not throw when the remote delete fails (fire-and-forget)', async () => {
    localStorage.setItem('lh_collabLayer_l1', JSON.stringify({ id: 'l1', markers: [{ id: 'm1' }] }));
    global.fetch = vi.fn().mockRejectedValue(new Error('down'));
    await expect(deleteMarker('https://beacon.test', 'l1', 'm1', 'actor1', 'tok')).resolves.toBeUndefined();
    expect(loadCachedLayer('l1').markers).toEqual([]); // optimistic removal is NOT rolled back
  });
});

describe('addMarkerComment', () => {
  it('returns null without fetching when required args are missing', async () => {
    global.fetch = vi.fn();
    expect(await addMarkerComment(null, 'l1', 'm1', 5, 'actor1', 'tok')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('optimistically appends the ops-log id to the marker, then reconciles with the saved marker on success', async () => {
    localStorage.setItem('lh_collabLayer_l1', JSON.stringify({ id: 'l1', markers: [{ id: 'm1', commentOpsLogIds: [1] }] }));
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ id: 'm1', commentOpsLogIds: [1, 5] }));
    const saved = await addMarkerComment('https://beacon.test', 'l1', 'm1', 5, 'actor1', 'tok');
    expect(saved.commentOpsLogIds).toEqual([1, 5]);
    expect(loadCachedLayer('l1').markers[0].commentOpsLogIds).toEqual([1, 5]);
  });

  it('returns null on failure but leaves the optimistic local append in place', async () => {
    localStorage.setItem('lh_collabLayer_l1', JSON.stringify({ id: 'l1', markers: [{ id: 'm1' }] }));
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    const saved = await addMarkerComment('https://beacon.test', 'l1', 'm1', 5, 'actor1', 'tok');
    expect(saved).toBeNull();
    // Unlike deleteLayer, there is no rollback here on failure.
    expect(loadCachedLayer('l1').markers[0].commentOpsLogIds).toEqual([5]);
  });
});
