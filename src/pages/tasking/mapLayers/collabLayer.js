import L from "leaflet";
import { MARKER_ICON_GROUPS, DEFAULT_MARKER_ICON_KEY, MARKER_COLOR_SWATCHES, buildMarkerBadgeIcon, faClassForIconKey } from "../components/collab_marker_icons.js";
import {
    listLayers,
    createLayer,
    fetchLayerMarkers,
    upsertMarker,
    deleteMarker,
} from "../utils/collabLayerSync.js";

const REFRESH_MS = 10000; // polling only fires while the layer is visible (registerPollingLayer's hasLayer gate)
const DEFAULT_FILL = MARKER_COLOR_SWATCHES[5]; // blue -- also the first swatch highlighted as "active" for a new marker

const layerKeyFor = (layerId) => `collab-${layerId}`;

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

/** Collaborative layers currently toggled visible on the map. */
function visibleCollabLayers(vm) {
    return (vm.mapVM.collabLayers() || []).filter((layer) => {
        const entry = vm.mapVM.onlineLayers.get(layerKeyFor(layer.id));
        return entry && vm.mapVM.map.hasLayer(entry.layerGroup);
    });
}

/**
 * Register the polling Leaflet layer for a single collaborative layer.
 * Visibility is controlled entirely by the existing layers drawer /
 * `ov.<key>` mechanism already built into registerPollingLayer +
 * getOverlayDefsForControl — no separate "enabled set" is needed since
 * polling is a no-op while the layer isn't visible.
 */
function registerLayerPolling(vm, apiUrl, layer, actorId, getToken) {
    const key = layerKeyFor(layer.id);
    vm.mapVM.registerPollingLayer(key, {
        label: layer.name,
        menuGroup: "Collaborative Layers",
        refreshMs: REFRESH_MS,
        visibleByDefault: false,
        fetchFn: async () => fetchLayerMarkers(apiUrl, layer.id, await getToken()),
        drawFn: (layerGroup, data) => drawCollabMarkers(vm, layerGroup, data, apiUrl, layer.id, key, actorId, getToken),
    });
}

/**
 * Fetch the list of collaborative layers for the org, store it on the
 * MapVM for the config modal to bind to, and register/refresh polling
 * layers for any layer not already registered.
 */
export async function refreshCollabLayerList(vm, apiUrl, actorId, getToken) {
    const layers = await listLayers(apiUrl, await getToken());
    vm.mapVM.collabLayers(layers);
    layers.forEach((layer) => registerLayerPolling(vm, apiUrl, layer, actorId, getToken));
    vm.mapVM.layersDrawer?.refresh?.();
    return layers;
}

/**
 * Called once at startup (main.js), alongside the other register*Layer
 * calls. The right-click "Add marker" trigger itself is wired up
 * separately, into the app's existing map context menu (see
 * components/mapContextMenu.js + startAddMarkerFlow/getVisibleCollabLayers
 * above) rather than a second contextmenu listener here.
 */
export async function registerCollabLayers(vm, apiUrl, actorId, getToken) {
    await refreshCollabLayerList(vm, apiUrl, actorId, getToken);
}

/** Create a new named layer, register its polling layer immediately, and refresh the drawer. */
export async function createCollabLayer(vm, apiUrl, name, actorId, getToken) {
    const layer = await createLayer(apiUrl, name, actorId, await getToken());
    if (!layer) return null;
    const list = vm.mapVM.collabLayers();
    vm.mapVM.collabLayers([...list, layer]);
    registerLayerPolling(vm, apiUrl, layer, actorId, getToken);
    vm.mapVM.layersDrawer?.refresh?.();
    return layer;
}

// ── Drawing ──────────────────────────────────────────────────────────

function drawCollabMarkers(vm, layerGroup, data, apiUrl, layerId, key, actorId, getToken) {
    const markers = (data?.markers || []).filter((m) => !m.deleted);
    markers.forEach((marker) => {
        const icon = buildMarkerBadgeIcon({ icon: marker.icon, fill: marker.fill || DEFAULT_FILL });

        const leafletMarker = L.marker([marker.lat, marker.lng], { icon });
        leafletMarker.bindPopup(() => buildMarkerPopupEl(vm, apiUrl, layerId, key, marker, actorId, getToken), {
            minWidth: 240,
            maxWidth: 280,
        });
        layerGroup.addLayer(leafletMarker);
    });
}

// Any marker on a visible layer can be edited/deleted -- protection against
// accidental changes comes from requiring an explicit Edit/Delete button
// click (and a confirm step for delete), not from a separate "edit mode".
function buildMarkerPopupEl(vm, apiUrl, layerId, key, marker, actorId, getToken) {
    const el = document.createElement("div");
    el.className = "collab-marker-popup";

    const escHtml = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

    el.innerHTML = `
        <div class="collab-marker-desc">${escHtml(marker.description) || "<em>No description</em>"}</div>
        <div class="collab-marker-meta">Added by <span class="collab-marker-author">user ${escHtml(marker.createdBy)}</span>${marker.updatedAt ? ` · updated ${timeAgo(marker.updatedAt)}` : ""}</div>
        <div class="collab-marker-actions">
            <button type="button" class="btn btn-sm btn-outline-secondary collab-edit-marker-btn">Edit</button>
            <button type="button" class="btn btn-sm btn-outline-danger collab-delete-marker-btn">Delete</button>
        </div>
        <div class="collab-marker-confirm d-none">
            <span>Delete this marker?</span>
            <button type="button" class="btn btn-sm btn-danger collab-confirm-delete-btn">Confirm Delete</button>
            <button type="button" class="btn btn-sm btn-secondary collab-cancel-delete-btn">Cancel</button>
        </div>
    `;

    const editBtn = el.querySelector(".collab-edit-marker-btn");
    const deleteBtn = el.querySelector(".collab-delete-marker-btn");
    const confirmBox = el.querySelector(".collab-marker-confirm");
    const actionsBox = el.querySelector(".collab-marker-actions");
    const confirmDeleteBtn = el.querySelector(".collab-confirm-delete-btn");
    const cancelDeleteBtn = el.querySelector(".collab-cancel-delete-btn");

    editBtn.addEventListener("click", () => {
        vm.mapVM.map.closePopup();
        openMarkerForm(vm, apiUrl, layerId, key, actorId, marker, L.latLng(marker.lat, marker.lng), getToken);
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
        await deleteMarker(apiUrl, layerId, marker.id, actorId, await getToken());
        vm.mapVM.refreshPollingLayer(key);
    });

    // Resolve the raw user id shown above into a display name once it's
    // available (cached/deduped by vm.resolvePersonName). The placeholder
    // stays if the marker's own popup gets closed/rebuilt before this
    // resolves -- updating a detached node is a harmless no-op.
    if (marker.createdBy && vm.resolvePersonName) {
        const authorEl = el.querySelector(".collab-marker-author");
        vm.resolvePersonName(marker.createdBy).then((name) => {
            if (authorEl && name) authorEl.textContent = name;
        });
    }

    return el;
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
 * Icon and color are each picked from a small dropdown toggle button, with
 * a live preview badge showing the combined result. Both dropdowns render
 * as floating panels appended to the map container -- outside the Leaflet
 * popup's own content -- so opening/closing either one never changes the
 * popup's size or makes it reposition itself.
 */
function openMarkerForm(vm, apiUrl, layerId, key, actorId, marker, latlng, getToken) {
    let icon = marker?.icon || DEFAULT_MARKER_ICON_KEY;
    let fill = marker?.fill || DEFAULT_FILL;

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
        <textarea class="collab-desc-input" placeholder="Description" rows="2">${marker?.description || ""}</textarea>
        <div class="collab-form-actions">
            <button type="button" class="btn btn-sm btn-secondary collab-cancel-btn">Cancel</button>
            <button type="button" class="btn btn-sm btn-primary collab-save-btn">Save</button>
        </div>
    `;

    const previewEl = el.querySelector(".collab-style-preview");
    const iconToggle = el.querySelector(".collab-icon-toggle");
    const colorToggle = el.querySelector(".collab-color-toggle");

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

    const popup = L.popup({ minWidth: 220, maxWidth: 260, closeOnClick: false, autoPanPadding: [16, 16] })
        .setLatLng(latlng)
        .setContent(el)
        .openOn(vm.mapVM.map);

    popup.on("remove", closeFloatingDropdown);

    el.querySelector(".collab-cancel-btn").addEventListener("click", () => {
        vm.mapVM.map.closePopup(popup);
    });

    el.querySelector(".collab-save-btn").addEventListener("click", async () => {
        const description = el.querySelector(".collab-desc-input").value.trim();
        const payload = {
            id: marker?.id,
            lat: latlng.lat,
            lng: latlng.lng,
            icon,
            fill,
            description,
        };
        vm.mapVM.map.closePopup(popup);
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
// Only available when at least one collaborative layer is currently
// visible. With exactly one visible layer, right-click opens the marker
// form immediately. With more than one visible, right-click shows a small
// picker so the user chooses which layer receives the new marker.

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

/** Whether the "Add marker" item in the map's right-click context menu should be shown. */
export function getVisibleCollabLayers(vm) {
    return visibleCollabLayers(vm);
}

/**
 * Entry point for the "Add marker to shared layer" item in the app's
 * existing right-click context menu (components/mapContextMenu.js). With
 * exactly one visible layer, opens the marker form immediately; with more
 * than one, shows a small picker so the user chooses which layer receives
 * the new marker.
 */
export function startAddMarkerFlow(vm, apiUrl, actorId, latlng, getToken) {
    closeContextMenu();

    const visible = visibleCollabLayers(vm);
    if (visible.length === 0) return;

    if (visible.length === 1) {
        openMarkerForm(vm, apiUrl, visible[0].id, layerKeyFor(visible[0].id), actorId, null, latlng, getToken);
        return;
    }

    const containerPoint = vm.mapVM.map.latLngToContainerPoint(latlng);
    showLayerPickerMenu(vm, apiUrl, actorId, visible, containerPoint, latlng, getToken);
}
