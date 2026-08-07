import L from "leaflet";
import { MARKER_ICON_GROUPS, DEFAULT_MARKER_ICON_KEY, MARKER_COLOR_SWATCHES, buildMarkerBadgeIcon, faClassForIconKey } from "../components/collab_marker_icons.js";
import {
    listLayers,
    createLayer,
    deleteLayer,
    updateLayerModerators,
    updateLayerPermissions,
    fetchLayerMarkers,
    upsertMarker,
    deleteMarker,
    addMarkerComment,
    getSubscribedLayerIds,
    subscribeLayer,
    unsubscribeLayer,
    migrateLegacyVisibleLayersToSubscriptions,
} from "../utils/collabLayerSync.js";

const REFRESH_MS = 10000; // polling only fires while the layer is visible (registerPollingLayer's hasLayer gate)
const DEFAULT_FILL = MARKER_COLOR_SWATCHES[5]; // blue -- also the first swatch highlighted as "active" for a new marker

// Purely an aesthetic guardrail, not a backend one (the Lambda/Ops Log
// don't enforce a length at all) -- keeps a description or comment from
// growing into an unreadable wall of text that blows out the map popup's
// bounded width. Enforced client-side only, via maxlength on the textareas.
const TEXT_CHAR_LIMIT = 300;

// Unlike Text, Beacon's Ops Log Subject is capped at 50 chars *server-side*
// -- this one's real. The old "Lighthouse LAD - Collaborative marker
// <action> - " lead-in was 47-50 chars on its own, leaving zero room for an
// actual title. "LAD" is short enough to still read as this feature's mark
// at a glance among an entity's other Ops Log entries, without eating the
// whole budget.
const OPSLOG_SUBJECT_LIMIT = 50;
const SUBJECT_PREFIX = "LAD";

const layerKeyFor = (layerId) => `collab-${layerId}`;

// Layer keys with an interactive popup (a marker's view popup, or the
// create/edit form) currently open. The polling refresh's drawFn rebuilds
// every marker on the layer from scratch each tick (layerGroup.clearLayers()
// + redraw), which would otherwise silently close whatever popup the user
// has open -- e.g. fading it out mid-keystroke while typing a comment or
// editing a description. registerLayerPolling's skipIfBusy checks this.
const busyLayerKeys = new Set();

function timeAgo(iso) {
    if (!iso) return "";
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return "";
    const mins = Math.round(ms / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
}

const escHtml = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

/**
 * Wires a live "n/limit" counter to an input/textarea's sibling `.collab-
 * char-counter` element (must immediately follow it in the markup),
 * colouring it up as the limit approaches/hits so the limit reads as
 * guidance rather than a hard wall -- for the description/comment fields
 * there's nothing on the backend enforcing it and `maxlength` is what
 * actually stops typing past it; for the title, `limit` is chosen so that
 * title + Subject prefix never exceeds Beacon's real 50-char server-side
 * cap (see markerTitleMaxLength).
 */
function wireCharCounter(inputEl, limit) {
    const counterEl = inputEl.nextElementSibling;
    if (!counterEl || !counterEl.classList.contains("collab-char-counter")) return;

    const update = () => {
        const len = inputEl.value.length;
        counterEl.textContent = `${len}/${limit}`;
        counterEl.classList.toggle("collab-char-counter-warn", len >= limit * 0.9 && len < limit);
        counterEl.classList.toggle("collab-char-counter-limit", len >= limit);
    };
    inputEl.addEventListener("input", update);
    update();
}

// ── Permissions ──────────────────────────────────────────────────────
//
// A layer's markerMode / deleteMode / commentMode default to 'anyone' at
// creation time (see Config.js's createCollabLayer form) but, like
// `moderators`, can be changed later by the creator or a current moderator
// (see Config.js's per-row "Manage permissions" and
// updateCollabLayerPermissions below). Both are read straight off whatever
// layer object is already in hand rather than re-fetched on every check --
// registerLayerPolling's drawFn keeps that object's mode/moderator fields
// synced from each poll response (syncLayerPermissionFields below), so a
// stale read here just means the UI is briefly out of date until the next
// poll tick, not a security gap (the Lambda enforces authoritatively, see
// lambda/map-layers-v2). This client-side gating only decides what to
// show/hide so a user isn't invited to attempt something that will just
// come back as a 403.
//
// Each mode is one of 'anyone' | 'creator' | 'moderators'. Layers created
// before this feature only carry the old readOnly / allowDeleteByOthers /
// disableComments booleans -- the effective*Mode() helpers below derive the
// equivalent mode from those so old layers keep behaving as they did.
//
// `getMemberId` is a sync () => string|null, the current user's Beacon
// member id decoded from their own access token (main.js) -- the same
// identity the Lambda authorizes against via the token's verified `sub`
// claim, which is why it's what's compared to a layer's
// `createdByMemberId`/`moderators` rather than the actorId/personId used
// for createdBy/updatedBy bookkeeping elsewhere in this feature.

function effectiveMarkerMode(layer) {
    return layer.markerMode || (layer.readOnly ? 'creator' : 'anyone');
}

function effectiveCommentMode(layer) {
    return layer.commentMode || (layer.disableComments ? 'creator' : 'anyone');
}

/** Is `memberId` the creator or a listed moderator of `layer`? */
function isCreatorOrModerator(layer, memberId) {
    if (!memberId) return false;
    if (memberId === layer.createdByMemberId) return true;
    return Array.isArray(layer.moderators) && layer.moderators.some((m) => m?.id === memberId);
}

function isAuthorizedForMode(mode, layer, getMemberId) {
    if (mode === 'anyone') return true;
    const memberId = getMemberId?.();
    if (mode === 'creator') return !!memberId && memberId === layer.createdByMemberId;
    if (mode === 'moderators') return isCreatorOrModerator(layer, memberId);
    return false;
}

/** Whether the current user may create/edit/delete markers on `layer`. */
function canWriteMarkers(layer, getMemberId) {
    return isAuthorizedForMode(effectiveMarkerMode(layer), layer, getMemberId);
}

/** Whether the current user may comment on `layer`'s markers. */
function canCommentOnLayer(layer, getMemberId) {
    return isAuthorizedForMode(effectiveCommentMode(layer), layer, getMemberId);
}

/**
 * Copy the permission-relevant fields (markerMode/deleteMode/commentMode/
 * moderators) from a freshly-fetched layer (`data`, the full layer response
 * from fetchLayerMarkers/getLayer.js) onto the long-lived `layer` object a
 * subscribed user's session is holding. This is what lets someone else's
 * "Manage permissions" or "Manage moderators" change (see
 * updateCollabLayerPermissions/updateCollabLayerModerators) show up for
 * every other subscriber -- not just the person who made it -- within one
 * polling interval: `layer` is the same object reference closed over by
 * this layer's drawFn (below) and held in vm.mapVM.collabLayers(), so
 * mutating it here is immediately visible to both the next popup render
 * and Config.js's per-row permission/moderator display.
 */
function syncLayerPermissionFields(vm, layer, data) {
    if (!data) return;
    const changed = layer.markerMode !== data.markerMode
        || layer.deleteMode !== data.deleteMode
        || layer.commentMode !== data.commentMode
        || JSON.stringify(layer.moderators) !== JSON.stringify(data.moderators);
    if (!changed) return;

    layer.markerMode = data.markerMode;
    layer.deleteMode = data.deleteMode;
    layer.commentMode = data.commentMode;
    layer.moderators = data.moderators;
    // Config.js's collabLayerRows is a pureComputed over collabLayers() --
    // mutating a field on an object already inside that observableArray
    // doesn't itself trigger a recompute, same as updateCollabLayerModerators
    // requiring Config.js's saveRowModerators to call this explicitly.
    vm.mapVM.collabLayers.valueHasMutated?.();
}

/**
 * Register the polling Leaflet layer for a single collaborative layer.
 * Visibility is controlled entirely by the existing layers drawer /
 * `ov.<key>` mechanism already built into registerPollingLayer +
 * getOverlayDefsForControl — no separate "enabled set" is needed since
 * polling is a no-op while the layer isn't visible.
 */
function registerLayerPolling(vm, apiUrl, layer, actorId, getToken, getMemberId) {
    const key = layerKeyFor(layer.id);
    // No stored preference yet (brand new subscription) defaults to shown;
    // an explicit prior '0'/'1' from the layers drawer toggle always wins,
    // so a layer someone has deliberately hidden stays hidden across reloads.
    const stored = localStorage.getItem(`ov.online-${key}`);
    vm.mapVM.registerPollingLayer(key, {
        label: layer.name,
        menuGroup: "Collaborative Layers",
        refreshMs: REFRESH_MS,
        visibleByDefault: stored === null ? true : stored === "1",
        fetchFn: async () => fetchLayerMarkers(apiUrl, layer.id, await getToken()),
        drawFn: (layerGroup, data) => {
            syncLayerPermissionFields(vm, layer, data);
            drawCollabMarkers(vm, layerGroup, data, apiUrl, layer, key, actorId, getToken, getMemberId);
        },
        skipIfBusy: () => busyLayerKeys.has(key),
    });
}

/**
 * Fetch every layer for the org (unfiltered -- subscriptions can span any
 * HQ, so there's no single hqId to scope this fetch to) and narrow it down
 * client-side to the ones the user is subscribed to. This -- not any HQ
 * filter -- is what populates vm.mapVM.collabLayers()/Config.js's "My
 * layers" list, so a subscribed layer stays listed (and unsubscribe-able)
 * regardless of whatever HQ the separate "Find a layer" search is scoped
 * to. Registers/refreshes polling for any subscribed layer not already
 * registered.
 */
export async function refreshSubscribedLayers(vm, apiUrl, actorId, getToken, getMemberId) {
    const subscribedIds = getSubscribedLayerIds();
    const all = await listLayers(apiUrl, await getToken());
    const layers = all.filter((layer) => subscribedIds.has(String(layer.id)));
    vm.mapVM.collabLayers(layers);
    // Only register layers we haven't seen yet -- re-registering an already
    // visible layer would hand it a brand new (empty) layerGroup that never
    // gets added to the map, silently blanking it out until its View switch
    // is toggled off and back on.
    layers
        .filter((layer) => !vm.mapVM.onlineLayers.has(layerKeyFor(layer.id)))
        .forEach((layer) => registerLayerPolling(vm, apiUrl, layer, actorId, getToken, getMemberId));
    vm.mapVM.layersDrawer?.refresh?.();
    return layers;
}

/**
 * Fetch layers for a single HQ -- backs Config.js's "Find a layer" search
 * (browsing to discover/subscribe to a layer), never touches
 * vm.mapVM.collabLayers or registers anything. Thin pass-through kept here
 * (rather than Config.js importing collabLayerSync.js's listLayers
 * directly) so every org-layer fetch funnels through one module.
 */
export async function searchLayersForHq(apiUrl, getToken, hqId) {
    return listLayers(apiUrl, await getToken(), hqId);
}

/**
 * Called once at startup (main.js), alongside the other register*Layer
 * calls. The right-click "Add marker" trigger itself is wired up
 * separately, into the app's existing map context menu (see
 * components/mapContextMenu.js + startAddMarkerFlow/getWritableCollabLayers
 * above) rather than a second contextmenu listener here.
 */
export async function registerCollabLayers(vm, apiUrl, actorId, getToken, getMemberId) {
    migrateLegacyVisibleLayersToSubscriptions();
    await refreshSubscribedLayers(vm, apiUrl, actorId, getToken, getMemberId);
}

/**
 * Create a new named layer, subscribe its creator to it, register its
 * polling layer immediately, and refresh the drawer.
 */
export async function createCollabLayer(vm, apiUrl, name, actorId, getToken, permissions, getMemberId) {
    const layer = await createLayer(apiUrl, name, actorId, await getToken(), permissions);
    if (!layer) return null;
    subscribeLayer(layer.id);
    const list = vm.mapVM.collabLayers();
    vm.mapVM.collabLayers([...list, layer]);
    const key = layerKeyFor(layer.id);
    registerLayerPolling(vm, apiUrl, layer, actorId, getToken, getMemberId);
    // Auto-show layers the user just created -- matches the 'ov.<drawerKey>'
    // flag the layers drawer (main.js) reads to decide initial visibility
    // (see subscribeToLayer below, which does the same for an existing
    // layer someone subscribes to).
    localStorage.setItem(`ov.online-${key}`, '1');
    vm.mapVM.layersDrawer?.refresh?.();
    vm.mapVM.refreshPollingLayer(key);
    return layer;
}

/**
 * Delete a collaborative layer: fires the remote (soft-)delete, then tears
 * down its polling registration/map presence, drops the subscription, and
 * drops it from the list the config modal binds to. No-op (returns false)
 * if the delete itself failed, e.g. a 403 from a since-changed deleteMode
 * -- Config.js's row stays in place in that case rather than disappearing
 * client-side while still existing server-side.
 */
export async function deleteCollabLayer(vm, apiUrl, layerId, actorId, getToken) {
    const ok = await deleteLayer(apiUrl, layerId, actorId, await getToken());
    if (!ok) return false;

    const key = layerKeyFor(layerId);
    vm.mapVM.unregisterPollingLayer(key);
    localStorage.removeItem(`ov.online-${key}`);
    unsubscribeLayer(layerId);
    vm.mapVM.collabLayers(vm.mapVM.collabLayers().filter((l) => l.id !== layerId));
    vm.mapVM.layersDrawer?.refresh?.();
    return true;
}

/**
 * Subscribe to an already-existing layer (found via Config.js's "Find a
 * layer" search) -- adds it to "My layers", registers it for
 * polling/LayersDrawer, and shows it immediately (same as createCollabLayer
 * -- whoever just subscribed almost certainly wants to see it right away,
 * without a second trip to the Layers control).
 */
export function subscribeToLayer(vm, apiUrl, layer, actorId, getToken, getMemberId) {
    subscribeLayer(layer.id);
    const list = vm.mapVM.collabLayers();
    if (!list.some((l) => l.id === layer.id)) {
        vm.mapVM.collabLayers([...list, layer]);
    }
    const key = layerKeyFor(layer.id);
    if (!vm.mapVM.onlineLayers.has(key)) {
        registerLayerPolling(vm, apiUrl, layer, actorId, getToken, getMemberId);
    }
    localStorage.setItem(`ov.online-${key}`, '1');
    vm.mapVM.layersDrawer?.refresh?.();
    vm.mapVM.refreshPollingLayer(key);
}

/**
 * Unsubscribe from a layer: drops it from "My layers" and tears down its
 * polling/map presence entirely (unlike hiding it, which leaves it
 * registered -- see registerPollingLayer's doc comment). Local-only, no
 * remote call -- subscriptions aren't org data (see collabLayerSync.js).
 */
export function unsubscribeFromLayer(vm, layerId) {
    const key = layerKeyFor(layerId);
    vm.mapVM.unregisterPollingLayer(key);
    localStorage.removeItem(`ov.online-${key}`);
    unsubscribeLayer(layerId);
    vm.mapVM.collabLayers(vm.mapVM.collabLayers().filter((l) => l.id !== layerId));
    vm.mapVM.layersDrawer?.refresh?.();
}

/**
 * Replace a layer's moderator list (creator-only, enforced server-side --
 * see lambda updateLayerModerators.js). Updates the in-memory layer object
 * (shared by reference with vm.mapVM.collabLayers()'s entry, same as every
 * other layer field) on success so Config.js's row immediately reflects the
 * new list without waiting for the next poll/refresh.
 */
export async function updateCollabLayerModerators(vm, apiUrl, layerId, moderators, getToken) {
    const saved = await updateLayerModerators(apiUrl, layerId, moderators, await getToken());
    if (saved == null) return null;

    const layer = vm.mapVM.collabLayers().find((l) => l.id === layerId);
    if (layer) layer.moderators = saved;
    return saved;
}

/**
 * Update a layer's markerMode/deleteMode/commentMode (creator-or-moderator
 * only, enforced server-side -- see lambda updateLayerPermissions.js).
 * Updates the in-memory layer object (shared by reference with
 * vm.mapVM.collabLayers()'s entry, same as updateCollabLayerModerators
 * above) on success so Config.js's row immediately reflects the new modes
 * without waiting for the next poll/refresh -- and so this session's own
 * marker popups (canWriteMarkers/canCommentOnLayer, read straight off this
 * same object) pick up the change on their next open. Other sessions
 * subscribed to this layer pick it up via syncLayerPermissionFields, once
 * their own polling next ticks.
 */
export async function updateCollabLayerPermissions(vm, apiUrl, layerId, permissions, getToken) {
    const saved = await updateLayerPermissions(apiUrl, layerId, permissions, await getToken());
    if (saved == null) return null;

    const layer = vm.mapVM.collabLayers().find((l) => l.id === layerId);
    if (layer) {
        layer.markerMode = saved.markerMode;
        layer.deleteMode = saved.deleteMode;
        layer.commentMode = saved.commentMode;
    }
    return saved;
}

// ── Drawing ──────────────────────────────────────────────────────────

function drawCollabMarkers(vm, layerGroup, data, apiUrl, layer, key, actorId, getToken, getMemberId) {
    const markers = (data?.markers || []).filter((m) => !m.deleted);
    markers.forEach((marker) => {
        const icon = buildMarkerBadgeIcon({ icon: marker.icon, fill: marker.fill || DEFAULT_FILL });

        const leafletMarker = L.marker([marker.lat, marker.lng], { icon, pane: "pane-collab" });

        // Bind a concrete, already-built element rather than Leaflet's
        // "content factory function" form of bindPopup -- that form gets
        // re-invoked on every popup.update() call, not just on open, and
        // loadMarkerContent() below calls update() after each async Ops
        // Log fetch. A function-content popup would rebuild itself (and
        // re-fetch, and re-update(), ...) in an unbounded loop. Fetching is
        // instead deferred to the "popupopen" event so a marker's Ops Log
        // entry is only pulled once the user actually clicks it.
        const { el, state } = buildMarkerPopupEl(vm, apiUrl, layer, key, marker, actorId, getToken, leafletMarker, getMemberId);
        leafletMarker.bindPopup(el, { minWidth: 260, maxWidth: 320, pane: "pane-popup-top" });
        leafletMarker.on("popupopen", () => {
            busyLayerKeys.add(key);
            loadMarkerContent(vm, marker, el, leafletMarker, state);
        });
        leafletMarker.on("popupclose", () => busyLayerKeys.delete(key));

        layerGroup.addLayer(leafletMarker);
    });
}

// Any marker on a visible layer can be edited/deleted -- protection against
// accidental changes comes from requiring an explicit Edit/Delete button
// click (and a confirm step for delete), not from a separate "edit mode".
//
// The marker record only carries GPS/style + Ops Log entry ids -- title,
// description and comment text are all resolved live from the Ops Log
// (source of truth), fetched lazily on "popupopen" (see drawCollabMarkers).
function buildMarkerPopupEl(vm, apiUrl, layer, key, marker, actorId, getToken, leafletMarker, getMemberId) {
    const layerId = layer.id;
    const canWrite = canWriteMarkers(layer, getMemberId);
    const canComment = canCommentOnLayer(layer, getMemberId);
    const commentMode = effectiveCommentMode(layer);
    const commentsRestrictedMessage = commentMode === 'moderators'
        ? "Only the layer creator and moderators can comment on this layer"
        : "Only the layer creator can comment on this layer";

    const el = document.createElement("div");
    el.className = "collab-marker-popup";

    el.innerHTML = `
        <div class="collab-marker-title">Loading…</div>
        <div class="collab-marker-desc"></div>
        <div class="collab-marker-meta"></div>
        <div class="collab-marker-comments"></div>
        ${canComment ? `
        <div class="collab-marker-comment-form">
            <textarea class="collab-comment-input" placeholder="Add a comment…" rows="2" maxlength="${TEXT_CHAR_LIMIT}"></textarea>
            <div class="collab-char-counter"></div>
            <button type="button" class="btn btn-sm btn-outline-primary collab-add-comment-btn">Comment</button>
        </div>
        ` : `<div class="collab-marker-comments-disabled"><i class="fas fa-comment-slash"></i> ${escHtml(commentsRestrictedMessage)}</div>`}
        ${canWrite ? `
        <div class="collab-marker-actions">
            <button type="button" class="btn btn-sm btn-outline-secondary collab-edit-marker-btn">Edit</button>
            <button type="button" class="btn btn-sm btn-outline-danger collab-delete-marker-btn">Delete</button>
        </div>
        <div class="collab-marker-confirm d-none">
            <span>Delete this marker?</span>
            <button type="button" class="btn btn-sm btn-danger collab-confirm-delete-btn">Confirm Delete</button>
            <button type="button" class="btn btn-sm btn-secondary collab-cancel-delete-btn">Cancel</button>
        </div>
        ` : ""}
    `;

    // Populated on "popupopen" (see drawCollabMarkers) via loadMarkerContent,
    // which fetches the marker's title/description/comments from the Ops
    // Log. `state.mainEntry` is stashed there so the Edit/Delete handlers
    // below can read whatever title and description are currently showing.
    const state = { mainEntry: null };

    if (canComment) {
        const commentInput = el.querySelector(".collab-comment-input");
        const addCommentBtn = el.querySelector(".collab-add-comment-btn");
        wireCharCounter(commentInput, TEXT_CHAR_LIMIT);

        addCommentBtn.addEventListener("click", async () => {
            const text = commentInput.value.trim();
            if (!text) return;
            addCommentBtn.disabled = true;
            try {
                const opsLogId = await logMarkerComment(vm, layerId, marker, text);
                if (opsLogId == null) return;
                await addMarkerComment(apiUrl, layerId, marker.id, opsLogId, actorId, await getToken());
                marker.commentOpsLogIds = Array.isArray(marker.commentOpsLogIds) ? [...marker.commentOpsLogIds, opsLogId] : [opsLogId];
                commentInput.value = "";
                await renderComments(vm, el.querySelector(".collab-marker-comments"), marker, leafletMarker);
            } finally {
                addCommentBtn.disabled = false;
            }
        });
    }

    if (canWrite) {
        const editBtn = el.querySelector(".collab-edit-marker-btn");
        const deleteBtn = el.querySelector(".collab-delete-marker-btn");
        const confirmBox = el.querySelector(".collab-marker-confirm");
        const actionsBox = el.querySelector(".collab-marker-actions");
        const confirmDeleteBtn = el.querySelector(".collab-confirm-delete-btn");
        const cancelDeleteBtn = el.querySelector(".collab-cancel-delete-btn");

        editBtn.addEventListener("click", () => {
            vm.mapVM.map.closePopup();
            openMarkerForm(vm, apiUrl, layerId, key, actorId, marker, L.latLng(marker.lat, marker.lng), getToken, state.mainEntry);
        });

        deleteBtn.addEventListener("click", () => {
            actionsBox.classList.add("d-none");
            confirmBox.classList.remove("d-none");
        });
        cancelDeleteBtn.addEventListener("click", () => {
            confirmBox.classList.add("d-none");
            actionsBox.classList.remove("d-none");
        });
        confirmDeleteBtn.addEventListener("click", async () => {
            // Whatever title/description the marker currently resolves to (or
            // blank, if the Ops Log lookup above hasn't landed yet) becomes the
            // deletion audit entry's content -- there's nothing left to stamp
            // an opsLogId onto afterwards, so it only lives in the Ops Log.
            const title = stripSubjectPrefix(state.mainEntry?.Subject);
            const description = stripAuditFooter(state.mainEntry?.Text);
            vm.mapVM.map.closePopup(); // clears busyLayerKeys (via "popupclose") before the refresh below
            await logMarkerAudit(vm, "deleted", layerId, marker, title, description);
            await deleteMarker(apiUrl, layerId, marker.id, actorId, await getToken());
            vm.mapVM.refreshPollingLayer(key);
        });
    }

    return { el, state };
}

function loadMarkerContent(vm, marker, el, leafletMarker, state) {
    const titleEl = el.querySelector(".collab-marker-title");
    const descEl = el.querySelector(".collab-marker-desc");
    const metaEl = el.querySelector(".collab-marker-meta");

    return fetchOpsLogEntry(vm, marker.opsLogId).then((entry) => {
        state.mainEntry = entry;
        if (entry) {
            titleEl.textContent = stripSubjectPrefix(entry.Subject) || "Untitled marker";
            descEl.textContent = stripAuditFooter(entry.Text);
            const author = entry.CreatedBy?.FullName || (marker.createdBy ? `user ${marker.createdBy}` : "Unknown");
            metaEl.textContent = `Added by ${author}${marker.updatedAt ? ` · updated ${timeAgo(marker.updatedAt)}` : ""}`;
        } else {
            titleEl.textContent = "Untitled marker";
            descEl.innerHTML = "<em>Ops Log entry unavailable</em>";
            metaEl.textContent = marker.createdBy ? `Added by user ${marker.createdBy}` : "";
        }
        leafletMarker.getPopup()?.update();
        return renderComments(vm, el.querySelector(".collab-marker-comments"), marker, leafletMarker);
    });
}

function renderComments(vm, commentsEl, marker, leafletMarker) {
    const ids = Array.isArray(marker.commentOpsLogIds) ? marker.commentOpsLogIds : [];
    if (!ids.length) {
        commentsEl.innerHTML = "";
        return Promise.resolve();
    }

    commentsEl.innerHTML = `<div class="collab-marker-comments-loading">Loading comments…</div>`;
    leafletMarker.getPopup()?.update();

    return Promise.all(ids.map((id) => fetchOpsLogEntry(vm, id))).then((entries) => {
        commentsEl.innerHTML = entries
            .filter(Boolean)
            .sort((a, b) => new Date(a.TimeLogged || 0) - new Date(b.TimeLogged || 0))
            .map((c) => `
                <div class="collab-marker-comment">
                    <div class="collab-marker-comment-text">${escHtml(stripAuditFooter(c.Text))}</div>
                    <div class="collab-marker-comment-meta">${escHtml(c.CreatedBy?.FullName || "Unknown")} · ${timeAgo(c.TimeLogged)}</div>
                </div>
            `).join("");
        leafletMarker.getPopup()?.update();
    });
}

// ── Ops Log audit trail ──────────────────────────────────────────────
//
// Every marker create/edit/delete/comment is logged to Beacon's Operations
// Log, and the Ops Log is the source of truth for the marker's title,
// description and comment thread -- the marker record itself only stores
// GPS/style plus the entry ids (opsLogId, commentOpsLogIds), resolved back
// via BeaconClient.operationslog.get() (loadMarkerContent/renderComments
// above). A Beacon Ops Log entry can only be edited by its author, so
// editing a marker always creates a *new* entry and re-points opsLogId at
// it rather than mutating the old one -- comments work the same way, each
// one just its own entry appended to commentOpsLogIds. Tag 4 is a
// known-good TagIds value confirmed to work against the live API -- there
// isn't a dedicated "map marker" tag to select instead.
const MARKER_AUDIT_TAG_ID = 4;

// The full audit detail (coords/icon/colour/layer/action) is appended to
// Text after this marker so it's captured in the Ops Log entry itself, but
// the marker popup only ever shows what's *before* it -- just the user's
// own title/description/comment, not the surrounding metadata. Deliberately
// distinctive so it'll never collide with anything a user actually types.
const AUDIT_FOOTER_MARKER = "\n\n————— Lighthouse LAD marker details —————\n";

function buildMarkerAuditFooter(action, layerName, marker) {
    const coords = `${marker.lat.toFixed(5)}, ${marker.lng.toFixed(5)}`;
    return `${AUDIT_FOOTER_MARKER}Collaborative marker ${action} on layer "${layerName}" at ${coords}. Icon: ${marker.icon}, colour: ${marker.fill}.`;
}

/** Strips the audit-detail footer back off an Ops Log entry's Text for display. */
function stripAuditFooter(text) {
    const idx = (text || "").indexOf(AUDIT_FOOTER_MARKER);
    return idx === -1 ? (text || "") : text.slice(0, idx);
}

/** The fixed "LAD <action>" lead-in every titled Subject starts with. */
function markerSubjectLead(action) {
    return `${SUBJECT_PREFIX} ${action}`;
}

/**
 * How many characters are left for the user's own title once the "LAD
 * <action> - " lead-in is accounted for, so title + lead-in never exceeds
 * Beacon's 50-char server-side Subject cap. Depends on `action` since
 * "edited" is a character shorter than "created"/"deleted".
 */
function markerTitleMaxLength(action) {
    return OPSLOG_SUBJECT_LIMIT - markerSubjectLead(action).length - " - ".length;
}

/** Strips the "LAD <action> - " lead-in back off an Ops Log entry's Subject for display. */
function stripSubjectPrefix(subject) {
    if (!subject || !subject.startsWith(`${SUBJECT_PREFIX} `)) return subject || "";
    const sepIdx = subject.indexOf(" - ");
    return sepIdx === -1 ? "" : subject.slice(sepIdx + 3);
}

/**
 * `eventId`, when the marker's layer has one attached (see Config.js's
 * "attach to event" picker), is threaded through as the Ops Log entry's own
 * EventId -- ties every marker/comment logged against that layer back to
 * the same Beacon event, same as logging it by hand from that event's own
 * Ops Log tab would. Omitted entirely (not sent as a blank field) for
 * layers with no event attached, same as before this existed.
 */
function createOpsLogAuditEntry(vm, subject, text, eventId) {
    if (typeof vm.createOpsLogEntry !== "function") return Promise.resolve(null);

    const payload = {
        Subject: subject,
        Text: text,
        Important: false,
        Restricted: false,
        ActionRequired: false,
        TagIds: [MARKER_AUDIT_TAG_ID],
        TimeLogged: new Date().toISOString(),
    };
    if (eventId) payload.EventId = eventId;

    return new Promise((resolve) => {
        vm.createOpsLogEntry(payload, (result) => resolve(result?.Id ?? null));
    });
}

/**
 * Log a marker create/edit/delete to the Operations Log and resolve with
 * the new entry's id (or null if unavailable/failed) so it can be attached
 * to the marker as its opsLogId.
 *
 * The Subject always leads with "LAD <action>" -- same as a comment's fixed
 * "LAD comment" -- so what happened is clear at a glance in Beacon's Ops
 * Log list without opening the entry; the user's own title (if any) is
 * appended for extra context, but never stands in for it alone the way it
 * used to. Kept within markerTitleMaxLength by the title input's maxlength,
 * so this never needs to truncate.
 */
function logMarkerAudit(vm, action, layerId, marker, title, description) {
    const layer = vm.mapVM.collabLayers().find((l) => l.id === layerId);
    const layerName = layer?.name || layerId;
    const subject = title ? `${markerSubjectLead(action)} - ${title}` : markerSubjectLead(action);
    const text = `${description || ""}${buildMarkerAuditFooter(action, layerName, marker)}`;
    return createOpsLogAuditEntry(vm, subject, text, layer?.eventId);
}

/**
 * Log a comment on a marker to the Operations Log and resolve with the new
 * entry's id (or null if unavailable/failed) so it can be appended to the
 * marker's commentOpsLogIds.
 */
function logMarkerComment(vm, layerId, marker, commentText) {
    const layer = vm.mapVM.collabLayers().find((l) => l.id === layerId);
    const layerName = layer?.name || layerId;
    const text = `${commentText}${buildMarkerAuditFooter("commented on", layerName, marker)}`;
    return createOpsLogAuditEntry(vm, `${SUBJECT_PREFIX} comment`, text, layer?.eventId);
}

/** Fetch a single Ops Log entry by id, resolving null if unavailable/failed. */
function fetchOpsLogEntry(vm, entryId) {
    if (entryId == null || typeof vm.getOpsLogEntry !== "function") return Promise.resolve(null);
    return new Promise((resolve) => {
        vm.getOpsLogEntry(entryId, (result) => resolve(result || null));
    });
}

// ── Marker create/edit form (inline popup) ──────────────────────────

function buildIconPickerHtml(selectedIcon) {
    return MARKER_ICON_GROUPS.map((group) => `
        <div class="collab-icon-group-label">${group.group}</div>
        <div class="collab-icon-grid">
            ${group.icons.map((i) => `
                <button type="button" class="collab-icon-btn ${i.key === selectedIcon ? "active" : ""}"
                    data-icon="${i.key}" title="${i.label}">
                    <i class="fas ${i.fa}"></i>
                </button>
            `).join("")}
        </div>
    `).join("");
}

function buildColorSwatchesHtml(selectedFill) {
    return MARKER_COLOR_SWATCHES.map((color) => `
        <button type="button" class="collab-color-swatch ${color === selectedFill ? "active" : ""}"
            data-color="${color}" style="background:${color}" title="${color}"></button>
    `).join("");
}

/**
 * Open an inline popup form (create if `marker` is null, edit otherwise)
 * at the given latlng. Only an explicit Save click writes data.
 *
 * `currentEntry` is the marker's currently-resolved Ops Log entry (from
 * loadMarkerContent, via the popup's Edit button) so the title/description
 * fields can be prefilled without a second fetch -- it's undefined for a
 * brand new marker, or if the lookup hadn't landed yet when Edit was
 * clicked, in which case the fields just start blank.
 *
 * Icon and color are each picked from a small dropdown toggle button, with
 * a live preview badge showing the combined result. Both dropdowns render
 * as floating panels appended to the map container -- outside the Leaflet
 * popup's own content -- so opening/closing either one never changes the
 * popup's size or makes it reposition itself.
 */
function openMarkerForm(vm, apiUrl, layerId, key, actorId, marker, latlng, getToken, currentEntry) {
    let icon = marker?.icon || DEFAULT_MARKER_ICON_KEY;
    let fill = marker?.fill || DEFAULT_FILL;

    // Save always logs this same action (see the save handler below), so
    // the title's maxlength can be pinned to it up front.
    const action = marker ? "edited" : "created";
    const titleMaxLength = markerTitleMaxLength(action);

    const el = document.createElement("div");
    el.className = "collab-marker-form";
    el.innerHTML = `
        <div class="collab-style-preview-row">
            <span class="collab-style-preview"></span>
            <span class="collab-style-preview-label">Preview</span>
        </div>
        <div class="collab-picker-row">
            <button type="button" class="collab-picker-toggle collab-icon-toggle" title="Choose icon">
                <i class="fas collab-toggle-icon"></i>
                <span>Icon</span>
                <i class="fas fa-caret-down ms-auto"></i>
            </button>
            <button type="button" class="collab-picker-toggle collab-color-toggle" title="Choose color">
                <span class="collab-toggle-swatch"></span>
                <span>Color</span>
                <i class="fas fa-caret-down ms-auto"></i>
            </button>
        </div>
        <input type="text" class="collab-title-input" placeholder="Title" maxlength="${titleMaxLength}" value="${escHtml(stripSubjectPrefix(currentEntry?.Subject))}">
        <div class="collab-char-counter"></div>
        <textarea class="collab-desc-input" placeholder="Description" rows="2" maxlength="${TEXT_CHAR_LIMIT}">${escHtml(stripAuditFooter(currentEntry?.Text))}</textarea>
        <div class="collab-char-counter"></div>
        <div class="collab-marker-audit-notice"><i class="fas fa-info-circle"></i> All marker actions -- create, edit, delete, and comments -- create an Ops Log entries.</div>
        <div class="collab-form-actions">
            <button type="button" class="btn btn-sm btn-secondary collab-cancel-btn">Cancel</button>
            <button type="button" class="btn btn-sm btn-primary collab-save-btn">Save</button>
        </div>
    `;

    const previewEl = el.querySelector(".collab-style-preview");
    const iconToggle = el.querySelector(".collab-icon-toggle");
    const colorToggle = el.querySelector(".collab-color-toggle");

    wireCharCounter(el.querySelector(".collab-title-input"), titleMaxLength);
    wireCharCounter(el.querySelector(".collab-desc-input"), TEXT_CHAR_LIMIT);

    const renderPreview = () => {
        previewEl.innerHTML = `<span class="collab-marker-badge"><i class="fas ${faClassForIconKey(icon)}"></i></span>`;
        previewEl.querySelector(".collab-marker-badge").style.background = fill;
        iconToggle.querySelector(".collab-toggle-icon").className = `fas ${faClassForIconKey(icon)} collab-toggle-icon`;
        colorToggle.querySelector(".collab-toggle-swatch").style.background = fill;
    };
    renderPreview();

    iconToggle.addEventListener("click", () => {
        if (iconToggle.classList.contains("open")) { closeFloatingDropdown(); return; }
        openFloatingDropdown(vm, iconToggle, "collab-icon-dropdown", (panel) => {
            const render = () => { panel.innerHTML = buildIconPickerHtml(icon); };
            render();
            panel.addEventListener("click", (e) => {
                const btn = e.target.closest(".collab-icon-btn");
                if (!btn) return;
                icon = btn.dataset.icon;
                renderPreview();
                render(); // keep the dropdown open so multiple icons can be browsed
            });
        });
    });

    colorToggle.addEventListener("click", () => {
        if (colorToggle.classList.contains("open")) { closeFloatingDropdown(); return; }
        openFloatingDropdown(vm, colorToggle, "collab-color-dropdown", (panel) => {
            panel.innerHTML = `<div class="collab-color-swatches"></div>`;
            const swatches = panel.querySelector(".collab-color-swatches");
            swatches.innerHTML = buildColorSwatchesHtml(fill);
            swatches.addEventListener("click", (e) => {
                const btn = e.target.closest(".collab-color-swatch");
                if (!btn) return;
                fill = btn.dataset.color;
                renderPreview();
                closeFloatingDropdown(); // color is a single quick pick, close straight away
            });
        });
    });

    const popup = L.popup({ minWidth: 220, maxWidth: 260, closeOnClick: false, autoPanPadding: [16, 16], pane: "pane-popup-top" })
        .setLatLng(latlng)
        .setContent(el)
        .openOn(vm.mapVM.map);

    // Keeps the layer's poll-driven redraw (registerLayerPolling's
    // skipIfBusy) from clearing+rebuilding every marker -- and closing this
    // form -- out from under whatever the user is mid-typing.
    busyLayerKeys.add(key);
    popup.on("remove", () => {
        busyLayerKeys.delete(key);
        closeFloatingDropdown();
    });

    el.querySelector(".collab-cancel-btn").addEventListener("click", () => {
        vm.mapVM.map.closePopup(popup);
    });

    el.querySelector(".collab-save-btn").addEventListener("click", async () => {
        const title = el.querySelector(".collab-title-input").value.trim();
        const description = el.querySelector(".collab-desc-input").value.trim();
        const payload = {
            id: marker?.id,
            lat: latlng.lat,
            lng: latlng.lng,
            icon,
            fill,
        };
        vm.mapVM.map.closePopup(popup);

        const opsLogId = await logMarkerAudit(vm, action, layerId, payload, title, description);
        if (opsLogId != null) payload.opsLogId = opsLogId;

        await upsertMarker(apiUrl, layerId, payload, actorId, await getToken());
        vm.mapVM.refreshPollingLayer(key);
    });
}

// Singleton so only one dropdown (icon or color, across any open marker
// form) is ever on screen at once.
let dropdownCloser = null;

function closeFloatingDropdown() {
    if (dropdownCloser) {
        dropdownCloser();
        dropdownCloser = null;
    }
}

/**
 * Shared plumbing for a floating panel anchored below `anchorEl`, appended
 * to the map container rather than any Leaflet popup's content. `populate`
 * is called once with the empty panel element to fill it in and wire its
 * own interactions.
 */
function openFloatingDropdown(vm, anchorEl, className, populate) {
    closeFloatingDropdown();

    const map = vm.mapVM.map;
    const mapContainer = map.getContainer();
    const anchorRect = anchorEl.getBoundingClientRect();
    const containerRect = mapContainer.getBoundingClientRect();

    const panel = document.createElement("div");
    panel.className = className;
    panel.style.left = `${anchorRect.left - containerRect.left}px`;
    panel.style.top = `${anchorRect.bottom - containerRect.top + 4}px`;

    populate(panel);

    mapContainer.appendChild(panel);
    anchorEl.classList.add("open");
    L.DomEvent.disableClickPropagation(panel);
    L.DomEvent.disableScrollPropagation(panel);

    const onMapInteract = () => closeFloatingDropdown();
    const onDocClick = (e) => {
        if (!panel.contains(e.target) && !anchorEl.contains(e.target)) closeFloatingDropdown();
    };
    const onKeyDown = (e) => { if (e.key === "Escape") closeFloatingDropdown(); };

    map.on("zoomstart dragstart", onMapInteract);
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onKeyDown);

    dropdownCloser = () => {
        panel.remove();
        anchorEl.classList.remove("open");
        map.off("zoomstart dragstart", onMapInteract);
        document.removeEventListener("click", onDocClick, true);
        document.removeEventListener("keydown", onKeyDown);
    };
}

// ── Right-click "add marker" ─────────────────────────────────────────
//
// Enabled whenever the user is subscribed to at least one collaborative
// layer they can write markers to -- independent of whether that layer's
// map overlay is currently toggled on, since most layers default to
// hidden (registerLayerPolling's visibleByDefault: false) and requiring
// visibility here would leave the item permanently disabled for anyone
// who hasn't also flipped the layers-drawer checkbox. With exactly one
// writable layer, right-click opens the marker form immediately. With
// more than one, right-click shows a small picker so the user chooses
// which layer receives the new marker.

let openContextMenu = null; // cleanup for a currently-open picker menu, if any

function closeContextMenu() {
    if (openContextMenu) {
        openContextMenu();
        openContextMenu = null;
    }
}

function showLayerPickerMenu(vm, apiUrl, actorId, layers, containerPoint, latlng, getToken) {
    closeContextMenu();

    const map = vm.mapVM.map;
    const mapContainer = map.getContainer();

    const menu = document.createElement("div");
    menu.className = "collab-context-menu";
    menu.style.left = `${containerPoint.x}px`;
    menu.style.top = `${containerPoint.y}px`;

    const header = document.createElement("div");
    header.className = "collab-context-menu-header";
    header.textContent = "Add marker to…";
    menu.appendChild(header);

    // Items scroll independently so the header stays put and the menu
    // never runs off-screen when many layers are visible at once.
    const itemsBox = document.createElement("div");
    itemsBox.className = "collab-context-menu-items";
    menu.appendChild(itemsBox);

    const sortedLayers = layers.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    sortedLayers.forEach((layer) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "collab-context-menu-item";
        item.textContent = layer.name;
        item.title = layer.name;
        item.addEventListener("click", () => {
            closeContextMenu();
            openMarkerForm(vm, apiUrl, layer.id, layerKeyFor(layer.id), actorId, null, latlng, getToken);
        });
        itemsBox.appendChild(item);
    });

    mapContainer.appendChild(menu);
    L.DomEvent.disableClickPropagation(menu);

    const onMapInteract = () => closeContextMenu();
    const onKeyDown = (e) => { if (e.key === "Escape") closeContextMenu(); };
    map.on("click zoomstart dragstart", onMapInteract);
    document.addEventListener("keydown", onKeyDown);

    openContextMenu = () => {
        menu.remove();
        map.off("click zoomstart dragstart", onMapInteract);
        document.removeEventListener("keydown", onKeyDown);
    };
}

/**
 * Subscribed collaborative layers the current user may add a marker to --
 * excludes read-only layers they didn't create/moderate. Drives whether
 * the "Add marker" item in the map's right-click context menu is enabled
 * (it always shows, but is disabled when this comes back empty -- see
 * components/mapContextMenu.js).
 */
export function getWritableCollabLayers(vm, getMemberId) {
    return (vm.mapVM.collabLayers() || []).filter((layer) => canWriteMarkers(layer, getMemberId));
}

/**
 * Entry point for the "Add marker to collaborative layer" item in the app's
 * existing right-click context menu (components/mapContextMenu.js). With
 * exactly one writable subscribed layer, opens the marker form immediately;
 * with more than one, shows a small picker so the user chooses which layer
 * receives the new marker.
 */
export function startAddMarkerFlow(vm, apiUrl, actorId, latlng, getToken, getMemberId) {
    closeContextMenu();

    const writable = getWritableCollabLayers(vm, getMemberId);
    if (writable.length === 0) return;

    if (writable.length === 1) {
        openMarkerForm(vm, apiUrl, writable[0].id, layerKeyFor(writable[0].id), actorId, null, latlng, getToken);
        return;
    }

    const containerPoint = vm.mapVM.map.latLngToContainerPoint(latlng);
    showLayerPickerMenu(vm, apiUrl, actorId, writable, containerPoint, latlng, getToken);
}
