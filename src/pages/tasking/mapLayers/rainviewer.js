import L from "leaflet";



/* ══════════════════════════════════════════════════════════════
 *  RainViewer Radar Overlay  (animated, past ~2 h)
 *  API docs: https://www.rainviewer.com/api/weather-maps-api.html
 * ══════════════════════════════════════════════════════════════ */

const RAINVIEWER_API = "https://api.rainviewer.com/public/weather-maps.json";
const FRAME_INTERVAL_MS = 500;   // default playback speed
const DATA_REFRESH_MS   = 300000; // re-fetch frame list every 5 min

// Universal Blue color scale (dBZ values to hex colors) - from RainViewer API
// Key thresholds from meteorological standards:
// <10 dBZ: Overcast/No Precipitation, 10: Drizzle, 20: Light Rain, 30: Moderate Rain,
// 40: Shower, 50: Small hail possible, 55: Hail possible, 60+: Hail likely
const COLOR_SCALE = [
  { dBZ: -10, color: "#63615914", label: "Overcast" },
  { dBZ: -5, color: "#6c685d24", label: "Overcast" },
  { dBZ: 0, color: "#827b6949", label: "Overcast" },
  { dBZ: 5, color: "#92887164", label: "Overcast" },
  { dBZ: 10, color: "#d2c48ba0", label: "Drizzle" },
  { dBZ: 13, color: "#d8ddeeff", label: "Drizzle" },
  { dBZ: 16, color: "#51c5e8ff", label: "Light Rain" },
  { dBZ: 19, color: "#00a3e0ff", label: "Light Rain" },
  { dBZ: 20, color: "#00a3e0ff", label: "Light Rain" },
  { dBZ: 25, color: "#0088bfff", label: "Moderate Rain" },
  { dBZ: 30, color: "#005588ff", label: "Moderate Rain" },
  { dBZ: 35, color: "#ffee00ff", label: "Shower" },
  { dBZ: 40, color: "#ffaa00ff", label: "Shower" },
  { dBZ: 45, color: "#ff6600ff", label: "Shower" },
  { dBZ: 50, color: "#c10000ff", label: "Small Hail Possible" },
  { dBZ: 52, color: "#d6000dff", label: "Small Hail Possible" },
  { dBZ: 54, color: "#d70013ff", label: "Hail Possible" },
  { dBZ: 55, color: "#ff4fffff", label: "Hail Possible" },
  { dBZ: 57, color: "#ff5fffff", label: "Hail Possible" },
  { dBZ: 59, color: "#ff6fffff", label: "Hail Likely" },
  { dBZ: 60, color: "#ff62ffff", label: "Hail Likely" },
  { dBZ: 63, color: "#ff58ffff", label: "Hail Likely" },
  { dBZ: 66, color: "#f5e7fbff", label: "Hail Likely" },
  { dBZ: 70, color: "#ffffffff", label: "Hail Likely" },
];

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    if (!Number.isInteger(idx) || tileLayers.length === 0 || idx < 0 || idx >= tileLayers.length) return;

    // hide previous
    if (frameIdx >= 0 && frameIdx < tileLayers.length) {
      tileLayers[frameIdx].setOpacity(0);
    }
    frameIdx = idx;
    
    // Get current opacity from control, default to 0.6
    let opacity = 0.6;
    if (control && control._container) {
      const opacitySlider = control._container.querySelector(".rv-opacity");
      if (opacitySlider) {
        opacity = parseInt(opacitySlider.value, 10) / 100;
      }
    }
    
    if (tileLayers[frameIdx]) {
      tileLayers[frameIdx].setOpacity(opacity);
    }

    // update control UI
    if (control) {
      const ts = control._container.querySelector(".rv-timestamp");
      const slider = control._container.querySelector(".rv-slider");
      const frame = frames[frameIdx];
      if (ts) ts.textContent = frame?.time ? fmtTime(frame.time) : "--:--";
      if (slider) slider.value = frameIdx;
    }
  }

  function stepForward() {
    if (tileLayers.length === 0) return;
    showFrame((frameIdx + 1) % tileLayers.length);
  }

  function stepBack() {
    if (tileLayers.length === 0) return;
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
      const res = await fetch(`${RAINVIEWER_API}?_cb=${Date.now()}`, {
        cache: "no-store",
      });
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

  /* ── Radar playback bar (bottom-center of map) with legend ──────── */
  class RadarControl {
    constructor() { this._container = null; this._map = null; this._legendContainer = null; }

    addTo(m) {
      this._map = m;
      const wrapper = document.createElement("div");
      wrapper.className = "rv-wrapper";

      // Legend above the controls
      const legendDiv = document.createElement("div");
      legendDiv.className = "rv-legend-container";
      legendDiv.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 12px; background: #fff; border-radius: 4px 4px 0 0; border-bottom: 1px solid #eee; box-shadow: 0 -1px 3px rgba(0,0,0,.15);">
          <span style="font-size: 10px; font-weight: 600; color: #666;">Rainfall Intensity (dBZ)</span>
          <div class="rv-legend-bar" style="display: flex; height: 16px; border: 1px solid rgba(0,0,0,0.2); border-radius: 2px; overflow: visible; width: 100%; max-width: 320px; position: relative;"></div>
        </div>`;
      
      const legendBar = legendDiv.querySelector(".rv-legend-bar");
      COLOR_SCALE.forEach((item) => {
        const swatch = document.createElement("div");
        swatch.style.flex = "1";
        swatch.style.backgroundColor = item.color;
        swatch.style.cursor = "help";
        swatch.style.pointerEvents = "auto";
        swatch.style.position = "relative";
        
        // Fast custom tooltip
        const tooltip = document.createElement("div");
        tooltip.style.position = "absolute";
        tooltip.style.bottom = "100%";
        tooltip.style.left = "50%";
        tooltip.style.transform = "translateX(-50%)";
        tooltip.style.marginBottom = "6px";
        tooltip.style.padding = "6px 8px";
        tooltip.style.backgroundColor = "#333";
        tooltip.style.color = "#fff";
        tooltip.style.fontSize = "11px";
        tooltip.style.fontWeight = "500";
        tooltip.style.whiteSpace = "nowrap";
        tooltip.style.borderRadius = "3px";
        tooltip.style.pointerEvents = "none";
        tooltip.style.zIndex = "1001";
        tooltip.style.opacity = "0";
        tooltip.style.transition = "opacity 0.1s ease";
        tooltip.textContent = `${item.dBZ} dBZ: ${item.label}`;
        swatch.appendChild(tooltip);
        
        swatch.addEventListener("mouseenter", () => {
          tooltip.style.opacity = "1";
        });
        swatch.addEventListener("mouseleave", () => {
          tooltip.style.opacity = "0";
        });
        
        legendBar.appendChild(swatch);
      });
      
      this._legendContainer = legendDiv;
      wrapper.appendChild(legendDiv);

      // Control bar below legend
      const c = document.createElement("div");
      c.className = "rv-control";
      L.DomEvent.disableClickPropagation(c);
      L.DomEvent.disableScrollPropagation(c);

      c.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="display: flex; gap: 2px; align-items: center;">
            <button class="rv-step-back" title="Previous frame">⏮</button>
            <button class="rv-play" title="Play / Pause">▶</button>
            <button class="rv-step-fwd" title="Next frame">⏭</button>
          </div>
          
          <input class="rv-slider" type="range" min="0" max="0" value="0" title="Scrub through frames" style="width: 140px;" />
          <span class="rv-timestamp" style="font-size: 12px; min-width: 45px; font-weight: 500;">--:--</span>
          
          <select class="rv-speed" title="Playback speed" style="min-width: 58px;">
            <option value="1000">0.5×</option>
            <option value="500" selected>1×</option>
            <option value="250">2×</option>
            <option value="125">4×</option>
          </select>
          
          <div style="border-left: 1px solid #ddd; height: 20px;"></div>
          
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="font-size: 11px; font-weight: 500; margin: 0; white-space: nowrap;">Opacity:</label>
            <input class="rv-opacity" type="range" min="0" max="100" value="60" title="Radar layer opacity" style="width: 70px;" />
            <span class="rv-opacity-val" style="font-size: 11px; min-width: 25px;">60%</span>
          </div>
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

      // Opacity control
      c.querySelector(".rv-opacity").addEventListener("input", (e) => {
        const opacityVal = parseInt(e.target.value, 10) / 100;
        c.querySelector(".rv-opacity-val").textContent = e.target.value + "%";
        if (frameIdx >= 0 && frameIdx < tileLayers.length && tileLayers[frameIdx]) {
          tileLayers[frameIdx].setOpacity(opacityVal);
        }
      });

      wrapper.appendChild(c);
      m.getContainer().appendChild(wrapper);
      this._container = c;
      return this;
    }

    remove() {
      const wrapper = this._container?.parentNode;
      if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
      this._container = null;
      this._legendContainer = null;
      this._map = null;
    }
  }

  /* ── layer registration ────────────────────────────────────── */
  vm.mapVM.registerPollingLayer("rainRadar", {
    label: "RainViewer Animated Rainfall Radar",
    menuGroup: "RainViewer",
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
      if (control) { control.remove(); control = null; }
      tileLayers = [];
      frames = [];
      frameIdx = -1;
      activeGroup = layerGroup;

      // Add playback control to the map
      control = new RadarControl();
      control.addTo(map);

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
    if (control) { control.remove(); control = null; }
    tileLayers = [];
    frames = [];
    frameIdx = -1;
    activeGroup = null;
  }
}