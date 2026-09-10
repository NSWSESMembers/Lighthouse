import BeaconClient from "../../../shared/BeaconClient";
import L from "leaflet";

const esri = require("esri-leaflet");

/**
 * Decorative NSW map tucked into the bottom-right corner of the config
 * modal's Data pane: real aerial imagery zoomed to whatever the "Only Show
 * Incidents From" filter covers, faded and masked so it reads as a
 * watermark behind the pane's controls. Fully non-interactive -- no zoom,
 * pan, controls, or pointer events -- and it never touches the filter.
 *
 * Only entries that have their own unit boundary are shaded. A region or
 * zone in the filter is NOT expanded here; once the user expands it with
 * "Load Children" the child units land in the filter as their own entries
 * and shade individually.
 *
 * @param {{
 *   config: object,                 // ConfigVM (needs incidentFilters observable)
 *   getToken: () => Promise<string>,
 *   apiHost: string,
 *   userId: string,
 *   containerId?: string,
 *   tabId?: string,
 *   modalId?: string,
 * }} opts
 */
export function initHqCoverageMap(opts) {
  const {
    config,
    getToken,
    apiHost,
    userId,
    containerId = "hqCoverageWatermark",
    tabId = "cfgTab-data",
    modalId = "configModal",
  } = opts;

  const host = document.getElementById(containerId);
  const modalEl = document.getElementById(modalId);
  if (!host || !modalEl || !config || typeof config.incidentFilters !== "function") return;

  const FILL = "#ff7a1a";
  const FILL_OPACITY = 0.32;
  const STROKE_OPACITY = 1;
  const ANIM = { animate: true, duration: 0.6, easeLinearity: 0.2 };
  const FADE_MS = 500; // slightly past the 0.45s CSS opacity transition
  const ringCache = new Map(); // entityId -> rings[] | null

  // Roughly the state extent -- what the map falls back to with nothing selected.
  const NSW_BOUNDS = L.latLngBounds([[-37.51, 140.99], [-28.15, 153.64]]);
  const NSW_FIT = { padding: [8, 8] };
  const FIT = { padding: [24, 24], maxZoom: 13 };

  let map = null;
  let boundaryLayer = null;
  let drawSeq = 0;
  let hasDrawn = false; // first paint snaps; later changes animate
  let redrawTimer = null;

  function ensureMap() {
    if (map) return;
    map = L.map(host, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
      inertia: false,
      // Animations on: the watermark re-fits whenever the filter changes and
      // a hard jump reads as a glitch behind the controls.
      fadeAnimation: true,
      zoomAnimation: true,
      markerZoomAnimation: false,
    }).setView([-32.9, 147.3], 5);

    esri.basemapLayer("Imagery", { ignoreDeprecationWarning: true }).addTo(map);

    boundaryLayer = L.layerGroup().addTo(map);
  }

  // Ease the camera to `target` -- snap on the very first paint, glide after.
  function fitTo(target, opts) {
    const settings = hasDrawn ? { ...opts, ...ANIM } : { ...opts, animate: false };
    map.fitBounds(target, settings);
    hasDrawn = true;
  }

  // Swap the shaded boundaries for `polys` with a crossfade rather than a
  // clear-then-redraw flash. Old layers fade out and are removed; new ones
  // fade up from transparent.
  function swapBoundaries(polys) {
    const stale = boundaryLayer.getLayers();
    stale.forEach((l) => {
      if (l.setStyle) l.setStyle({ fillOpacity: 0, opacity: 0 });
    });
    setTimeout(() => stale.forEach((l) => boundaryLayer.removeLayer(l)), FADE_MS);

    polys.forEach((poly) => {
      poly.setStyle({ fillOpacity: 0, opacity: 0 });
      poly.addTo(boundaryLayer);
    });
    // Two frames so the browser paints the transparent state before we bump
    // to the target -- a single rAF gets coalesced and skips the transition.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      polys.forEach((poly) =>
        poly.setStyle({ fillOpacity: FILL_OPACITY, opacity: STROKE_OPACITY }));
    }));
  }

  async function ringsFor(id, token) {
    if (ringCache.has(id)) return ringCache.get(id);
    let rings = null;
    try {
      const res = await BeaconClient.geoservices.unitBoundary(id, { host: apiHost, userId, token });
      rings = Array.isArray(res) && res.length ? res : null;
    } catch (e) {
      rings = null;
    }
    ringCache.set(id, rings);
    return rings;
  }

  function polygonsFor(rings) {
    const toLatLngs = (ring) =>
      (ring.points || [])
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        .map((p) => [p.latitude, p.longitude]);

    const outers = rings.filter((r) => !r.inner_boundary).map(toLatLngs).filter((r) => r.length >= 3);
    const holes = rings.filter((r) => r.inner_boundary).map(toLatLngs).filter((r) => r.length >= 3);
    if (!outers.length) return null;

    const latlngs = outers.length === 1 ? [outers[0], ...holes] : outers;
    return L.polygon(latlngs, {
      color: FILL,
      weight: 1.5,
      fillColor: FILL,
      fillOpacity: FILL_OPACITY,
      interactive: false,
      className: "hq-cov-poly", // CSS transitions the opacity crossfade
    });
  }

  function show(on) {
    host.classList.toggle("is-visible", on);
  }

  function frameNsw() {
    ensureMap();
    swapBoundaries([]);
    show(true);
    map.invalidateSize({ animate: false });
    fitTo(NSW_BOUNDS, NSW_FIT);
  }

  async function redraw() {
    const seq = ++drawSeq;
    const entries = (config.incidentFilters() || []).slice();

    if (!entries.length) {
      frameNsw();
      return;
    }

    let token;
    try {
      token = await getToken();
    } catch (e) {
      return;
    }

    const ringSets = await Promise.all(entries.map((e) => ringsFor(e.id, token)));
    if (seq !== drawSeq) return;

    ensureMap();
    const polys = [];
    const bounds = L.latLngBounds([]);

    ringSets.forEach((rings) => {
      if (!rings) return;
      const poly = polygonsFor(rings);
      if (!poly) return;
      polys.push(poly);
      bounds.extend(poly.getBounds());
    });

    swapBoundaries(polys);

    show(true);
    map.invalidateSize({ animate: false });
    // Nothing resolved to a boundary yet (e.g. only unexpanded regions) --
    // sit on the whole state rather than blank out.
    if (bounds.isValid()) fitTo(bounds, FIT);
    else fitTo(NSW_BOUNDS, NSW_FIT);
  }

  // Coalesce a burst of filter changes (bulk add/remove, "Load Children")
  // into a single animated re-fit.
  function scheduleRedraw() {
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(redraw, 180);
  }

  function refit() {
    if (!map) return;
    map.invalidateSize({ animate: false });
    const b = L.latLngBounds([]);
    boundaryLayer.getLayers().forEach((l) => b.extend(l.getBounds()));
    if (b.isValid()) fitTo(b, FIT);
    else fitTo(NSW_BOUNDS, NSW_FIT);
  }

  // The Data pane is the modal's default tab, so the container has a size as
  // soon as the modal is shown; refit whenever it (re)appears.
  modalEl.addEventListener("shown.bs.modal", () => {
    if (map) map.invalidateSize({ animate: false });
    redraw();
  });

  const tabBtn = document.getElementById(tabId);
  if (tabBtn) tabBtn.addEventListener("shown.bs.tab", refit);

  config.incidentFilters.subscribe(scheduleRedraw);
}
