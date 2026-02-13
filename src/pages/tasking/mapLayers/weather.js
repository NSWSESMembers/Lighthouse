import L from "leaflet";



/* ══════════════════════════════════════════════════════════════
 *  RainViewer Radar Overlay  (animated, past ~2 h)
 *  API docs: https://www.rainviewer.com/api/weather-maps-api.html
 * ══════════════════════════════════════════════════════════════ */

const RAINVIEWER_API = "https://api.rainviewer.com/public/weather-maps.json";
const FRAME_INTERVAL_MS = 500;   // default playback speed
const DATA_REFRESH_MS   = 300000; // re-fetch frame list every 5 min

/**
 * Register an animated rainfall radar overlay powered by the RainViewer API.
 * Loops through the past ~2 hours of composite radar frames with on-map
 * playback controls (play / pause / step / scrub).
 */
export function registerRainRadarLayer(vm, map) {
  /* ── state ─────────────────────────────────────────────────── */
  let frames       = [];       // [{ time, path }]
  let host         = null;
  let tileLayers   = [];       // parallel to `frames`
  let frameIdx     = -1;
  let playing      = false;
  let playTimer    = null;
  let dataTimer    = null;
  let activeGroup  = null;
  let control      = null;
  let speed        = FRAME_INTERVAL_MS;

  /* ── helpers ───────────────────────────────────────────────── */
  function buildTileLayer(framePath) {
    return L.tileLayer(
      `${host}${framePath}/512/{z}/{x}/{y}/2/1_1.png`,
      {
        pane: "pane-lowest-plus",
        tileSize: 512,
        zoomOffset: -1,
        maxNativeZoom: 7,
        maxZoom: 18,
        opacity: 0,  // start invisible; showFrame will reveal the active one
        attribution:
          '<a href="https://www.rainviewer.com" target="_blank">RainViewer</a>',
      }
    );
  }

  function fmtTime(unix) {
    const d = new Date(unix * 1000);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  /* ── frame display ─────────────────────────────────────────── */
  function showFrame(idx) {
    if (idx < 0 || idx >= tileLayers.length) return;

    // hide previous
    if (frameIdx >= 0 && frameIdx < tileLayers.length) {
      tileLayers[frameIdx].setOpacity(0);
    }
    frameIdx = idx;
    tileLayers[frameIdx].setOpacity(0.6);

    // update control UI
    if (control) {
      const ts = control._container.querySelector(".rv-timestamp");
      const slider = control._container.querySelector(".rv-slider");
      if (ts) ts.textContent = fmtTime(frames[frameIdx].time);
      if (slider) slider.value = frameIdx;
    }
  }

  function stepForward() {
    showFrame((frameIdx + 1) % tileLayers.length);
  }

  function stepBack() {
    showFrame((frameIdx - 1 + tileLayers.length) % tileLayers.length);
  }

  function play() {
    if (playing) return;
    playing = true;
    updatePlayBtn();
    playTimer = setInterval(stepForward, speed);
  }

  function pause() {
    playing = false;
    updatePlayBtn();
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
  }

  function togglePlay() { playing ? pause() : play(); }

  function updatePlayBtn() {
    if (!control) return;
    const btn = control._container.querySelector(".rv-play");
    if (btn) btn.textContent = playing ? "⏸" : "▶";
  }

  /* ── data loading ──────────────────────────────────────────── */
  async function loadFrames(layerGroup) {
    try {
      const res = await fetch(RAINVIEWER_API);
      if (!res.ok) throw new Error(`RainViewer API ${res.status}`);
      const json = await res.json();
      const past = json.radar?.past;
      if (!past || past.length === 0) return;

      const newHost = json.host;
      const pathsMatch =
        host === newHost &&
        frames.length === past.length &&
        frames.every((f, i) => f.path === past[i].path);

      if (pathsMatch) return; // nothing changed

      // tear down old tile layers
      tileLayers.forEach((tl) => {
        if (layerGroup.hasLayer(tl)) layerGroup.removeLayer(tl);
      });

      host = newHost;
      frames = past;
      tileLayers = frames.map((f) => {
        const tl = buildTileLayer(f.path);
        layerGroup.addLayer(tl);
        return tl;
      });

      // update slider range
      if (control) {
        const slider = control._container.querySelector(".rv-slider");
        if (slider) { slider.max = frames.length - 1; slider.value = frames.length - 1; }
      }

      // show latest frame
      frameIdx = -1;
      showFrame(frames.length - 1);
    } catch (err) {
      console.warn("[RainViewer Radar] Failed to load frames:", err);
    }
  }

  /* ── Leaflet control for playback ──────────────────────────── */
  const RadarControl = L.Control.extend({
    options: { position: "bottomleft" },
    onAdd() {
      const c = L.DomUtil.create("div", "leaflet-bar rv-control");
      L.DomEvent.disableClickPropagation(c);
      L.DomEvent.disableScrollPropagation(c);

      c.innerHTML = `
        <div style="
          display:flex; align-items:center; gap:6px;
          background:#fff; padding:4px 8px; border-radius:4px;
          font-size:12px; font-family:monospace; box-shadow:0 1px 4px rgba(0,0,0,.3);
          user-select:none;
        ">
          <button class="rv-step-back" title="Previous frame"
            style="border:none;background:none;cursor:pointer;font-size:14px;padding:2px;">⏮</button>
          <button class="rv-play" title="Play / Pause"
            style="border:none;background:none;cursor:pointer;font-size:14px;padding:2px;">▶</button>
          <button class="rv-step-fwd" title="Next frame"
            style="border:none;background:none;cursor:pointer;font-size:14px;padding:2px;">⏭</button>
          <input class="rv-slider" type="range" min="0" max="0" value="0"
            style="width:120px;cursor:pointer;" title="Scrub through frames" />
          <span class="rv-timestamp" style="min-width:48px;text-align:center;">--:--</span>
          <select class="rv-speed" title="Playback speed"
            style="border:1px solid #ccc;border-radius:3px;font-size:11px;padding:1px 2px;cursor:pointer;">
            <option value="1000">0.5×</option>
            <option value="500" selected>1×</option>
            <option value="250">2×</option>
            <option value="125">4×</option>
          </select>
        </div>`;

      c.querySelector(".rv-play").addEventListener("click", togglePlay);
      c.querySelector(".rv-step-back").addEventListener("click", () => { pause(); stepBack(); });
      c.querySelector(".rv-step-fwd").addEventListener("click", () => { pause(); stepForward(); });
      c.querySelector(".rv-slider").addEventListener("input", (e) => {
        pause();
        showFrame(parseInt(e.target.value, 10));
      });
      c.querySelector(".rv-speed").addEventListener("change", (e) => {
        speed = parseInt(e.target.value, 10);
        if (playing) { pause(); play(); }
      });

      return c;
    },
  });

  /* ── layer registration ────────────────────────────────────── */
  vm.mapVM.registerPollingLayer("rainRadar", {
    label: "Rainfall Radar - Animated",
    menuGroup: "Weather",
    refreshMs: 0,
    visibleByDefault: localStorage.getItem(`ov.rainRadar`) || false,
    fetchFn: async () => {
      return {};
    },
    drawFn: (layerGroup, data) => {
      if (!data) return;

      // Clean up any previous cycle (toggle off → on)
      pause();
      if (dataTimer) { clearInterval(dataTimer); dataTimer = null; }
      if (control) { map.removeControl(control); control = null; }
      tileLayers = [];
      frames = [];
      frameIdx = -1;
      activeGroup = layerGroup;

      // Add playback control to the map
      control = new RadarControl();
      map.addControl(control);

      // Clean up control + timers when the layerGroup is removed from the map
      layerGroup.on("remove", cleanup);

      // Initial load + periodic refresh of frame list
      loadFrames(layerGroup);
      dataTimer = setInterval(() => loadFrames(layerGroup), DATA_REFRESH_MS);

      // Auto-play
      play();
    },
  });

  function cleanup() {
    pause();
    if (dataTimer) { clearInterval(dataTimer); dataTimer = null; }
    if (control) { map.removeControl(control); control = null; }
    tileLayers = [];
    frames = [];
    frameIdx = -1;
    activeGroup = null;
  }
}
