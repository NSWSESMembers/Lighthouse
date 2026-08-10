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

const LAMBDA_BASE = 'https://lambda.lighthouse-extension.com/lad_v2/map-layers';

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

// ── Subscriptions ────────────────────────────────────────────────────
//
// Which collaborative layers a user tracks (shown in Config's "My layers"
// list, and registered for polling/LayersDrawer) is a client-side
// preference, not org data -- never sent to the Lambda. Kept independent
// of HQ so a subscribed layer stays manageable (visible in the list,
// unsubscribe-able) no matter which HQ the separate "Find a layer" search
// is currently scoped to -- that's the whole point: unsubscribing from a
// layer shouldn't require first knowing/re-selecting the HQ it came from.
const LS_SUBSCRIPTIONS_KEY = 'lh_collabLayer_subscriptions';

/** @returns {Set<string>} */
export function getSubscribedLayerIds() {
    try {
        return new Set(JSON.parse(localStorage.getItem(LS_SUBSCRIPTIONS_KEY)) || []);
    } catch {
        return new Set();
    }
}

function saveSubscribedLayerIds(ids) {
    localStorage.setItem(LS_SUBSCRIPTIONS_KEY, JSON.stringify([...ids]));
}

export function isSubscribed(layerId) {
    return getSubscribedLayerIds().has(String(layerId));
}

export function subscribeLayer(layerId) {
    const ids = getSubscribedLayerIds();
    ids.add(String(layerId));
    saveSubscribedLayerIds(ids);
}

export function unsubscribeLayer(layerId) {
    const ids = getSubscribedLayerIds();
    ids.delete(String(layerId));
    saveSubscribedLayerIds(ids);
}

/**
 * One-time migration from the pre-subscriptions model, where every layer
 * ever fetched got auto-registered and shown/hidden state was tracked
 * purely by per-layer `ov.online-collab-<id>` flags (see collabLayer.js /
 * Config.js). Guarded by LS_SUBSCRIPTIONS_KEY already existing (real
 * subscriptions, even an empty set, always leaves that key set) so this
 * only ever runs once per browser -- otherwise a layer someone explicitly
 * unsubscribed from would keep reappearing as long as its old `ov.*` flag
 * was still '1'.
 */
export function migrateLegacyVisibleLayersToSubscriptions() {
    if (localStorage.getItem(LS_SUBSCRIPTIONS_KEY) !== null) return;

    const ids = new Set();
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const match = key && key.match(/^ov\.online-collab-(.+)$/);
        if (match && localStorage.getItem(key) === '1') ids.add(match[1]);
    }
    saveSubscribedLayerIds(ids);
}

// ── List / create layers ────────────────────────────────────────────

/**
 * List collaborative layers for an org (layers unused for 120+ days are
 * excluded server-side, not deleted).
 * @param {string} apiUrl
 * @param {string} token  Beacon access token (Authorization: Bearer).
 * @param {string} [hqId]  If given, restricts the list to layers attached
 *   to this HQ server-side (see lambda listLayers.js) -- omit for "All HQs".
 * @returns {Promise<Array<Object>>}
 */
export async function listLayers(apiUrl, token, hqId) {
    // Only the unfiltered "All HQs" list is a complete enough picture of
    // the org's layers to serve as the offline cache -- an HQ-scoped
    // response would otherwise silently shrink it for every other HQ. So
    // an HQ-scoped call reads/writes nothing but a client-side filter over
    // that same full cache, both as its "no apiUrl yet" fallback below and
    // on a failed fetch.
    const cached = () => {
        const all = loadCachedLayerIndex();
        return hqId ? all.filter((l) => l.hqId === hqId) : all;
    };

    if (!apiUrl) return cached();

    try {
        const url = `${LAMBDA_BASE}?apiUrl=${encodeURIComponent(apiUrl)}${hqId ? `&hqId=${encodeURIComponent(hqId)}` : ''}`;
        const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
        if (!res.ok) {
            console.warn('[collabLayerSync] list failed:', res.status);
            return cached();
        }
        const { layers } = await res.json();
        if (!hqId) saveCachedLayerIndex(layers || []);
        return layers || [];
    } catch (err) {
        console.warn('[collabLayerSync] list error:', err);
        return cached();
    }
}

/**
 * Create a new named collaborative layer.
 * @param {string} apiUrl
 * @param {string} name
 * @param {string} actorId
 * @param {string} token  Beacon access token (Authorization: Bearer).
 * @param {{markerMode?: string, deleteMode?: string, commentMode?: string, moderators?: Array<{id: string, name: string}>, event?: {id: string, name: string}|null, hq: {id: string, name: string}}} permissions
 *   Each mode is one of 'anyone' | 'creator' | 'moderators' (default 'anyone')
 *   at creation, but -- like `moderators` -- can be changed later by the
 *   creator or a current moderator via updateLayerPermissions()/
 *   updateLayerModerators() below. `event`, if given, is the optional
 *   Beacon event this layer is attached to -- fixed at creation, purely for
 *   display (see Config.js's layer list). `hq` is required -- every layer
 *   must belong to an HQ (also fixed at creation); the Lambda rejects the
 *   request if it's missing.
 * @returns {Promise<Object|null>} the created layer summary, or null on failure
 */
export async function createLayer(apiUrl, name, actorId, token, permissions = {}) {
    const trimmed = (name || '').trim();
    if (!apiUrl || !trimmed || !permissions.hq?.id) return null;

    try {
        const res = await fetch(LAMBDA_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                apiUrl,
                name: trimmed,
                createdBy: String(actorId),
                markerMode: permissions.markerMode || 'anyone',
                deleteMode: permissions.deleteMode || 'anyone',
                commentMode: permissions.commentMode || 'anyone',
                moderators: Array.isArray(permissions.moderators) ? permissions.moderators : [],
                event: permissions.event || null,
                hq: permissions.hq,
            }),
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

/**
 * Delete (soft-delete) a collaborative layer. Optimistically removes it
 * from the local cached index, then fires the remote write.
 * @param {string} apiUrl
 * @param {string} layerId
 * @param {string} actorId
 * @param {string} token  Beacon access token (Authorization: Bearer).
 * @returns {Promise<boolean>} true on success
 */
export async function deleteLayer(apiUrl, layerId, actorId, token) {
    if (!apiUrl || !layerId) return false;

    const index = loadCachedLayerIndex();
    saveCachedLayerIndex(index.filter((l) => l.id !== layerId));

    try {
        const url = `${LAMBDA_BASE}/${encodeURIComponent(layerId)}` +
            `?apiUrl=${encodeURIComponent(apiUrl)}&actorId=${encodeURIComponent(actorId)}`;
        const res = await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) {
            throw new Error(`deleteLayer failed with status ${res.status}`);
        }
        localStorage.removeItem(layerCacheKey(layerId));
        return true;
    } catch (err) {
        console.warn('[collabLayerSync] deleteLayer error:', err);
        // Restore the optimistically-removed entry so a transient network
        // failure doesn't silently hide a layer that's still on the server.
        saveCachedLayerIndex(index);
        return false;
    }
}

/**
 * Replace a layer's moderator list. Only the layer's creator is authorized
 * server-side (see lambda updateLayerModerators.js) -- calling this as
 * anyone else fails with a 403 and the local cache is left untouched.
 * @param {string} apiUrl
 * @param {string} layerId
 * @param {Array<{id: string, name: string}>} moderators
 * @param {string} token  Beacon access token (Authorization: Bearer).
 * @returns {Promise<Array<{id: string, name: string}>|null>} the saved moderator list, or null on failure
 */
export async function updateLayerModerators(apiUrl, layerId, moderators, token) {
    if (!apiUrl || !layerId) return null;

    try {
        const res = await fetch(`${LAMBDA_BASE}/${encodeURIComponent(layerId)}/moderators`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ apiUrl, moderators: moderators || [] }),
        });
        if (!res.ok) {
            throw new Error(`updateLayerModerators failed with status ${res.status}`);
        }
        const { moderators: saved } = await res.json();

        // Reconcile the cached index entry (if present) so a page reload
        // before the next refreshCollabLayerList() still shows the update.
        const index = loadCachedLayerIndex();
        const entry = index.find((l) => l.id === layerId);
        if (entry) {
            entry.moderators = saved;
            saveCachedLayerIndex(index);
        }
        const cachedLayer = loadCachedLayer(layerId);
        if (cachedLayer) {
            cachedLayer.moderators = saved;
            saveCachedLayer(layerId, cachedLayer);
        }

        return saved;
    } catch (err) {
        console.warn('[collabLayerSync] updateLayerModerators error:', err);
        return null;
    }
}

/**
 * Update a layer's markerMode/deleteMode/commentMode. Only the creator or a
 * current moderator is authorized server-side (see lambda
 * updateLayerPermissions.js) -- calling this as anyone else fails with a
 * 403 and the local cache is left untouched. Any mode omitted from
 * `permissions` is left unchanged rather than reset to 'anyone'.
 * @param {string} apiUrl
 * @param {string} layerId
 * @param {{markerMode?: string, deleteMode?: string, commentMode?: string}} permissions
 * @param {string} token  Beacon access token (Authorization: Bearer).
 * @returns {Promise<{markerMode: string, deleteMode: string, commentMode: string}|null>} the saved modes, or null on failure
 */
export async function updateLayerPermissions(apiUrl, layerId, permissions, token) {
    if (!apiUrl || !layerId) return null;

    try {
        const res = await fetch(`${LAMBDA_BASE}/${encodeURIComponent(layerId)}/permissions`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                apiUrl,
                markerMode: permissions?.markerMode,
                deleteMode: permissions?.deleteMode,
                commentMode: permissions?.commentMode,
            }),
        });
        if (!res.ok) {
            throw new Error(`updateLayerPermissions failed with status ${res.status}`);
        }
        const saved = await res.json();

        // Reconcile the cached index entry (if present) so a page reload
        // before the next refreshCollabLayerList() still shows the update.
        const index = loadCachedLayerIndex();
        const entry = index.find((l) => l.id === layerId);
        if (entry) {
            Object.assign(entry, saved);
            saveCachedLayerIndex(index);
        }
        const cachedLayer = loadCachedLayer(layerId);
        if (cachedLayer) {
            Object.assign(cachedLayer, saved);
            saveCachedLayer(layerId, cachedLayer);
        }

        return saved;
    } catch (err) {
        console.warn('[collabLayerSync] updateLayerPermissions error:', err);
        return null;
    }
}

/**
 * Update a layer's HQ and/or event attachment. Only the creator or a
 * current moderator is authorized server-side (see lambda
 * updateLayerAttachment.js) -- calling this as anyone else fails with a
 * 403 and the local cache is left untouched. `hq` is required, same as at
 * creation; `event` given as null (or omitted) clears any existing event
 * attachment.
 * @param {string} apiUrl
 * @param {string} layerId
 * @param {{hq: {id: string, name: string}, event?: {id: string, name: string, identifier?: string}|null}} attachment
 * @param {string} token  Beacon access token (Authorization: Bearer).
 * @returns {Promise<{hqId: string, hqName: string, eventId: string|null, eventName: string|null, eventIdentifier: string|null}|null>} the saved attachment, or null on failure
 */
export async function updateLayerAttachment(apiUrl, layerId, attachment, token) {
    if (!apiUrl || !layerId || !attachment?.hq?.id) return null;

    try {
        const res = await fetch(`${LAMBDA_BASE}/${encodeURIComponent(layerId)}/attachment`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ apiUrl, hq: attachment.hq, event: attachment.event || null }),
        });
        if (!res.ok) {
            throw new Error(`updateLayerAttachment failed with status ${res.status}`);
        }
        const saved = await res.json();

        // Reconcile the cached index entry (if present) so a page reload
        // before the next refreshCollabLayerList() still shows the update.
        const index = loadCachedLayerIndex();
        const entry = index.find((l) => l.id === layerId);
        if (entry) {
            Object.assign(entry, saved);
            saveCachedLayerIndex(index);
        }
        const cachedLayer = loadCachedLayer(layerId);
        if (cachedLayer) {
            Object.assign(cachedLayer, saved);
            saveCachedLayer(layerId, cachedLayer);
        }

        return saved;
    } catch (err) {
        console.warn('[collabLayerSync] updateLayerAttachment error:', err);
        return null;
    }
}

// ── Layer markers ────────────────────────────────────────────────────

/**
 * Fetch a layer's markers (also counts as "use" server-side, so this
 * layer won't age out of listLayers()).
 * @param {string} apiUrl
 * @param {string} layerId
 * @param {string} token  Beacon access token (Authorization: Bearer).
 * @returns {Promise<Object|null>} the layer, including its markers array
 */
export async function fetchLayerMarkers(apiUrl, layerId, token) {
    if (!apiUrl || !layerId) return loadCachedLayer(layerId);

    try {
        const url = `${LAMBDA_BASE}/${encodeURIComponent(layerId)}?apiUrl=${encodeURIComponent(apiUrl)}`;
        const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
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
 * @param {{id?: string, lat: number, lng: number, icon: string, fill: string, opsLogId?: number}} marker
 *   Title/description aren't stored here -- they live in the Ops Log entry
 *   `opsLogId` points at (see mapLayers/collabLayer.js).
 * @param {string} actorId
 * @param {string} token  Beacon access token (Authorization: Bearer).
 * @returns {Promise<Object|null>} the saved marker (with server-assigned id/timestamps), or null on failure
 */
export async function upsertMarker(apiUrl, layerId, marker, actorId, token) {
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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
 * @param {string} token  Beacon access token (Authorization: Bearer).
 * @returns {Promise<void>}
 */
export async function deleteMarker(apiUrl, layerId, markerId, actorId, token) {
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
        await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    } catch (err) {
        console.warn('[collabLayerSync] deleteMarker error:', err);
    }
}

/**
 * Attach a comment -- an Ops Log entry id already created client-side --
 * to a marker's comment thread. Applies an optimistic local update to the
 * cached layer before firing the remote write.
 * @param {string} apiUrl
 * @param {string} layerId
 * @param {string} markerId
 * @param {number} opsLogId  Id of the comment's Ops Log entry.
 * @param {string} actorId
 * @param {string} token  Beacon access token (Authorization: Bearer).
 * @returns {Promise<Object|null>} the updated marker, or null on failure
 */
export async function addMarkerComment(apiUrl, layerId, markerId, opsLogId, actorId, token) {
    if (!apiUrl || !layerId || !markerId || opsLogId == null) return null;

    // Optimistic local update
    const cached = loadCachedLayer(layerId);
    if (cached && Array.isArray(cached.markers)) {
        const m = cached.markers.find((mk) => mk.id === markerId);
        if (m) {
            m.commentOpsLogIds = Array.isArray(m.commentOpsLogIds) ? [...m.commentOpsLogIds, opsLogId] : [opsLogId];
            saveCachedLayer(layerId, cached);
        }
    }

    try {
        const url = `${LAMBDA_BASE}/${encodeURIComponent(layerId)}/features/${encodeURIComponent(markerId)}/comments`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ apiUrl, opsLogId, actorId: String(actorId) }),
        });
        if (!res.ok) {
            throw new Error(`addMarkerComment failed with status ${res.status}`);
        }
        const saved = await res.json();

        // Reconcile with server-confirmed state
        const latest = loadCachedLayer(layerId) || cached;
        if (latest && Array.isArray(latest.markers)) {
            const i = latest.markers.findIndex((mk) => mk.id === markerId);
            if (i >= 0) latest.markers[i] = saved;
            saveCachedLayer(layerId, latest);
        }

        return saved;
    } catch (err) {
        console.warn('[collabLayerSync] addMarkerComment error:', err);
        return null;
    }
}
