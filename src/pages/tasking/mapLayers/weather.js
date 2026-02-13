import L from "leaflet";



/* ══════════════════════════════════════════════════════════════
 *  RainViewer Radar Overlay 
 *  API docs: https://www.rainviewer.com/api/weather-maps-api.html
 * ══════════════════════════════════════════════════════════════ */

const RAINVIEWER_API = "https://api.rainviewer.com/public/weather-maps.json";

/**
 * Register a rainfall radar overlay powered by the RainViewer API.
 * Shows the most-recent composite radar frame and auto-refreshes
 * every 5 minutes.  Max native zoom is 7 (RainViewer limit) but
 * tiles are overzoomed so they remain visible at higher map zooms.
 */
export function registerRainRadarLayer(vm, _map) {
  // State kept across draw cycles so we can swap tiles in-place
  let radarTileLayer = null;
  let refreshTimer = null;
  let currentHost = null;
  let currentPath = null;

  /**
   * Fetch the latest frame list from RainViewer and return
   * { host, path } for the most-recent radar frame.
   */
  async function fetchLatestFrame() {
    const res = await fetch(RAINVIEWER_API);
    if (!res.ok) throw new Error(`RainViewer API ${res.status}`);
    const json = await res.json();
    const past = json.radar?.past;
    if (!past || past.length === 0) throw new Error("No radar frames available");
    const latest = past[past.length - 1];
    return { host: json.host, path: latest.path, time: latest.time };
  }

  /**
   * Build a Leaflet TileLayer for a given RainViewer frame.
   * Colour scheme 2 = "Original", smooth=1, snow=1.
   */
  function buildTileLayer(host, path) {
    return L.tileLayer(
      `${host}${path}/512/{z}/{x}/{y}/2/1_1.png`,
      {
        pane: "pane-lowest-plus",
        tileSize: 512,
        zoomOffset: -1,
        maxNativeZoom: 7,
        maxZoom: 18,
        opacity: 0.6,
        attribution:
          '<a href="https://www.rainviewer.com" target="_blank">RainViewer</a>',
      }
    );
  }

  /**
   * Swap the current tile layer for the newest frame.
   * Called on initial draw and then every 5 minutes.
   * @param {L.LayerGroup} layerGroup – the active group for this toggle cycle
   * @param {boolean} force – true on first draw to ensure tiles are added
   */
  async function refreshRadar(layerGroup, force = false) {
    try {
      const { host, path } = await fetchLatestFrame();

      // Skip only when the frame is unchanged AND the tile is already
      // in *this* layerGroup (not a stale one from a previous toggle).
      const sameFrame = host === currentHost && path === currentPath;
      if (sameFrame && !force && radarTileLayer && layerGroup.hasLayer(radarTileLayer)) return;

      currentHost = host;
      currentPath = path;

      // Remove the old tile layer if it's in the group
      if (radarTileLayer && layerGroup.hasLayer(radarTileLayer)) {
        layerGroup.removeLayer(radarTileLayer);
      }

      radarTileLayer = buildTileLayer(host, path);
      layerGroup.addLayer(radarTileLayer);
    } catch (err) {
      console.warn("[RainViewer Radar] Failed to refresh radar overlay:", err);
    }
  }

  vm.mapVM.registerPollingLayer("rainRadar", {
    label: "Rainfall Radar - 10min Composite",
    menuGroup: "Weather",
    refreshMs: 0, // we handle our own refresh timer
    visibleByDefault: localStorage.getItem(`ov.rainRadar`) || false,
    fetchFn: async () => {
      return {};
    },
    drawFn: (layerGroup, data) => {
      if (!data) return;

      // Clear any previous refresh timer (handles toggle off → on)
      if (refreshTimer) clearInterval(refreshTimer);

      // Reset stale references so the new layerGroup gets a fresh tile
      radarTileLayer = null;

      // Initial draw – force add even if frame hasn't changed
      refreshRadar(layerGroup, true);

      // Auto-refresh every 5 min while the layer is visible
      refreshTimer = setInterval(() => refreshRadar(layerGroup), 300000);
    },
  });
}
