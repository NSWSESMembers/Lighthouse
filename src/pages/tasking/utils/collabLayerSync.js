/**
 * collabLayerSync.js
 *
 * Client-side helper for the collaborative map-layers feature: listing
 * layers for an org, creating layers, and reading/writing markers via
 * the Lambda / S3 backend.
 *
 * Mirrors the fetch/cache conventions of defaultAssetSync.js: GETs are
 * cached to localStorage so data survives reloads and is available
 * immediately on next open; mutations apply an optimistic local update
 * before firing the remote write.
 */

const LAMBDA_BASE = 'https://lambda.lighthouse-extension.com/lad/map-layers';

const LS_INDEX_KEY = 'lh_collabLayers_index'; // cached layer list for the current org
const layerCacheKey = (layerId) => `lh_collabLayer_${layerId}`;

// ── Local cache helpers ─────────────────────────────────────────────

/**
 * Read the cached layer index (list of layers for the current org).
 * @returns {Array<Object>}
 */
export function loadCachedLayerIndex() {
    try {
        return JSON.parse(localStorage.getItem(LS_INDEX_KEY)) || [];
    } catch {
        return [];
    }
}

function saveCachedLayerIndex(layers) {
    localStorage.setItem(LS_INDEX_KEY, JSON.stringify(layers || []));
}

/**
 * Read a cached layer (including its markers).
 * @param {string} layerId
 * @returns {Object|null}
 */
export function loadCachedLayer(layerId) {
    try {
        return JSON.parse(localStorage.getItem(layerCacheKey(layerId))) || null;
    } catch {
        return null;
    }
}

function saveCachedLayer(layerId, layer) {
    localStorage.setItem(layerCacheKey(layerId), JSON.stringify(layer));
}

// ── List / create layers ────────────────────────────────────────────

/**
 * List collaborative layers for an org (layers unused for 120+ days are
 * excluded server-side, not deleted).
 * @param {string} apiUrl
 * @returns {Promise<Array<Object>>}
 */
export async function listLayers(apiUrl) {
    if (!apiUrl) return loadCachedLayerIndex();

    try {
        const url = `${LAMBDA_BASE}?apiUrl=${encodeURIComponent(apiUrl)}`;
        const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
        if (!res.ok) {
            console.warn('[collabLayerSync] list failed:', res.status);
            return loadCachedLayerIndex();
        }
        const { layers } = await res.json();
        saveCachedLayerIndex(layers || []);
        return layers || [];
    } catch (err) {
        console.warn('[collabLayerSync] list error:', err);
        return loadCachedLayerIndex();
    }
}

/**
 * Create a new named collaborative layer.
 * @param {string} apiUrl
 * @param {string} name
 * @param {string} actorId
 * @returns {Promise<Object|null>} the created layer summary, or null on failure
 */
export async function createLayer(apiUrl, name, actorId) {
    const trimmed = (name || '').trim();
    if (!apiUrl || !trimmed) return null;

    try {
        const res = await fetch(LAMBDA_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiUrl, name: trimmed, createdBy: String(actorId) }),
        });
        if (!res.ok) {
            throw new Error(`Create layer failed with status ${res.status}`);
        }
        const layer = await res.json();

        // Optimistically add to the cached index
        const index = loadCachedLayerIndex();
        index.push(layer);
        saveCachedLayerIndex(index);

        return layer;
    } catch (err) {
        console.warn('[collabLayerSync] createLayer error:', err);
        return null;
    }
}

// ── Layer markers ────────────────────────────────────────────────────

/**
 * Fetch a layer's markers (also counts as "use" server-side, so this
 * layer won't age out of listLayers()).
 * @param {string} apiUrl
 * @param {string} layerId
 * @returns {Promise<Object|null>} the layer, including its markers array
 */
export async function fetchLayerMarkers(apiUrl, layerId) {
    if (!apiUrl || !layerId) return loadCachedLayer(layerId);

    try {
        const url = `${LAMBDA_BASE}/${encodeURIComponent(layerId)}?apiUrl=${encodeURIComponent(apiUrl)}`;
        const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
        if (!res.ok) {
            console.warn('[collabLayerSync] fetchLayerMarkers failed:', res.status);
            return loadCachedLayer(layerId);
        }
        const layer = await res.json();
        saveCachedLayer(layerId, layer);
        return layer;
    } catch (err) {
        console.warn('[collabLayerSync] fetchLayerMarkers error:', err);
        return loadCachedLayer(layerId);
    }
}

/**
 * Create or update a marker on a layer. Applies an optimistic local
 * update to the cached layer before firing the remote write.
 * @param {string} apiUrl
 * @param {string} layerId
 * @param {{id?: string, lat: number, lng: number, shape: string, fill: string, stroke: string, description: string}} marker
 * @param {string} actorId
 * @returns {Promise<Object|null>} the saved marker (with server-assigned id/timestamps), or null on failure
 */
export async function upsertMarker(apiUrl, layerId, marker, actorId) {
    if (!apiUrl || !layerId || !marker) return null;

    // Optimistic local update
    const cached = loadCachedLayer(layerId) || { id: layerId, markers: [] };
    cached.markers = Array.isArray(cached.markers) ? cached.markers : [];
    const now = new Date().toISOString();
    const optimistic = {
        ...marker,
        id: marker.id || `local-${Date.now()}`,
        updatedBy: String(actorId),
        updatedAt: now,
        createdBy: marker.createdBy || String(actorId),
        createdAt: marker.createdAt || now,
        deleted: false,
    };
    const idx = cached.markers.findIndex((m) => m.id === optimistic.id);
    if (idx >= 0) {
        cached.markers[idx] = optimistic;
    } else {
        cached.markers.push(optimistic);
    }
    saveCachedLayer(layerId, cached);

    try {
        const res = await fetch(`${LAMBDA_BASE}/${encodeURIComponent(layerId)}/features`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiUrl, marker, actorId: String(actorId) }),
        });
        if (!res.ok) {
            throw new Error(`upsertMarker failed with status ${res.status}`);
        }
        const saved = await res.json();

        // Reconcile optimistic entry with server-assigned id/timestamps
        const latest = loadCachedLayer(layerId) || cached;
        const i = latest.markers.findIndex((m) => m.id === optimistic.id);
        if (i >= 0) latest.markers[i] = saved;
        else latest.markers.push(saved);
        saveCachedLayer(layerId, latest);

        return saved;
    } catch (err) {
        console.warn('[collabLayerSync] upsertMarker error:', err);
        return optimistic;
    }
}

/**
 * Delete (soft-delete) a marker from a layer. Optimistically removes it
 * from the local cache, then fires the remote write.
 * @param {string} apiUrl
 * @param {string} layerId
 * @param {string} markerId
 * @param {string} actorId
 * @returns {Promise<void>}
 */
export async function deleteMarker(apiUrl, layerId, markerId, actorId) {
    if (!apiUrl || !layerId || !markerId) return;

    // Optimistic local update
    const cached = loadCachedLayer(layerId);
    if (cached && Array.isArray(cached.markers)) {
        cached.markers = cached.markers.filter((m) => m.id !== markerId);
        saveCachedLayer(layerId, cached);
    }

    try {
        const url = `${LAMBDA_BASE}/${encodeURIComponent(layerId)}/features/${encodeURIComponent(markerId)}` +
            `?apiUrl=${encodeURIComponent(apiUrl)}&actorId=${encodeURIComponent(actorId)}`;
        await fetch(url, { method: 'DELETE' });
    } catch (err) {
        console.warn('[collabLayerSync] deleteMarker error:', err);
    }
}
