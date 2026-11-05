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
 * Loops through the past ~2 hours of composite radar frames with a playback
 * control (play / pause / step / scrub) that sits above the Legend.
 * Opacity is set in the Map layers tab like any other overlay.
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
  function buildTileLayer(framePath, isLatest) {
    return L.tileLayer(
      `${host}${framePath}/512/{z}/{x}/{y}/2/1_1.png`,
      {
        pane: "pane-lowest-plus",
        // Load status (Layers drawer) follows the latest frame only -- the
        // older animation frames load in the background, and a dropped tile
        // in one of those isn't worth a "failed to load" warning.
        skipLoadStatus: !isLatest,
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
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  }

  /* ── frame display ─────────────────────────────────────────── */
  function showFrame(idx) {
    if (!Number.isInteger(idx) || tileLayers.length === 0 || idx < 0 || idx >= tileLayers.length) return;

    // hide previous
    if (frameIdx >= 0 && frameIdx < tileLayers.length) {
      tileLayers[frameIdx].setOpacity(0);
    }
    frameIdx = idx;
    // Full strength here; the layer's opacity in the Map layers tab fades
    // the whole pane.
    tileLayers[frameIdx]?.setOpacity(1);
    control?.update();
  }

  function stepForward() {
    if (tileLayers.length === 0) return;
    showFrame((frameIdx + 1) % tileLayers.length);
  }

  function stepBack() {
    if (tileLayers.length === 0) return;
    showFrame((frameIdx - 1 + tileLayers.length) % tileLayers.length);
  }

  function showLatest() {
    pause();
    showFrame(tileLayers.length - 1);
  }

  function play() {
    if (playing) return;
    playing = true;
    control?.update();
    playTimer = setInterval(stepForward, speed);
  }

  function pause() {
    playing = false;
    control?.update();
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
  }

  function togglePlay() { playing ? pause() : play(); }

  /* ── data loading ──────────────────────────────────────────── */
  async function fetchFrameList() {
    const res = await fetch(`${RAINVIEWER_API}?_cb=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`RainViewer API ${res.status}`);
    return res.json();
  }

  // New frame list (first load or the 5-minute refresh). Layers for frames
  // still in the list are kept, so only the new frame loads. The view stays
  // on the frame it was showing; if that was the latest, it moves on to the
  // new latest. Play/pause is left as it was.
  function applyFrames(layerGroup, json) {
    const past = json?.radar?.past;
    if (!past || past.length === 0) return;

    const newHost = json.host;
    const pathsMatch =
      host === newHost &&
      frames.length === past.length &&
      frames.every((f, i) => f.path === past[i].path);

    if (pathsMatch) return; // nothing changed

    const followLatest = frameIdx < 0 || frameIdx === frames.length - 1;
    const shownPath = frames[frameIdx]?.path;
    if (frameIdx >= 0) tileLayers[frameIdx]?.setOpacity(0);
    frameIdx = -1;

    // Layers worth keeping, by frame path (none if the tile host changed).
    const kept = new Map();
    if (host === newHost) frames.forEach((f, i) => kept.set(f.path, tileLayers[i]));

    host = newHost;
    frames = past;
    const lastIdx = frames.length - 1;
    tileLayers = frames.map((f, i) => {
      let tl = kept.get(f.path);
      kept.delete(f.path);
      if (!tl) {
        tl = buildTileLayer(f.path, i === lastIdx);
        layerGroup.addLayer(tl);
      } else if (i !== lastIdx && !tl.options.skipLoadStatus) {
        // The old latest frame: load status follows the latest only, and it
        // is attached when a layer is added, so add it again as an older one.
        layerGroup.removeLayer(tl);
        tl.options.skipLoadStatus = true;
        layerGroup.addLayer(tl);
      }
      return tl;
    });
    // Frames that have aged out of the list.
    kept.forEach((tl) => layerGroup.removeLayer(tl));

    let idx = lastIdx;
    if (!followLatest) {
      // Stay on the same frame, or the oldest one left if it has aged out.
      idx = Math.max(0, frames.findIndex((f) => f.path === shownPath));
    }
    showFrame(idx);
  }

  // Periodic refresh -- the frames already on the map stay if this fails.
  async function refreshFrames(layerGroup) {
    try {
      applyFrames(layerGroup, await fetchFrameList());
    } catch (err) {
      console.warn("[RainViewer Radar] Failed to load frames:", err);
    }
  }

  /* ── Radar playback control (bottom-left, above the Legend) ─────── */
  // A chip (play/pause, frame time, how old it is) that opens a panel with
  // the scrubber, step buttons, speed and colour scale. Open/closed is
  // remembered per browser.
  const EXPANDED_KEY = "lh-rainRadar.expanded";
  const NARROW_PX = 300; // map width below which the speed menu is hidden

  function readExpanded() {
    try { return localStorage.getItem(EXPANDED_KEY) === "1"; } catch { return false; }
  }
  function writeExpanded(on) {
    try { localStorage.setItem(EXPANDED_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  }

  const RadarControl = L.Control.extend({
    options: { position: "bottomleft" },

    onAdd(m) {
      const c = L.DomUtil.create("div", "rv-control leaflet-control");
      L.DomEvent.disableClickPropagation(c);
      L.DomEvent.disableScrollPropagation(c);

      const swatches = COLOR_SCALE.map((item) => `
        <div class="rv-swatch" style="background-color:${item.color}">
          <div class="rv-swatch-tip">${item.dBZ} dBZ: ${item.label}</div>
        </div>`).join("");

      c.innerHTML = `
        <div class="rv-chip">
          <button type="button" class="rv-play" title="Play / pause radar animation"><i class="fa fa-solid fa-play"></i></button>
          <button type="button" class="rv-toggle" title="Show radar playback controls" aria-expanded="false">
            <span class="rv-title">Radar</span>
            <span class="rv-timestamp">--:--</span>
            <i class="fa fa-solid fa-chevron-up rv-chevron"></i>
          </button>
          <button type="button" class="rv-age" title="Jump to the latest radar frame"></button>
        </div>
        <div class="rv-panel" hidden>
          <div class="rv-row">
            <button type="button" class="rv-step-back" title="Previous frame"><i class="fa fa-solid fa-step-backward"></i></button>
            <button type="button" class="rv-step-fwd" title="Next frame"><i class="fa fa-solid fa-step-forward"></i></button>
            <input class="rv-slider" type="range" min="0" max="0" value="0" title="Scrub through frames" aria-label="Radar frame" />
            <select class="rv-speed" title="Playback speed" aria-label="Playback speed">
              <option value="1000">0.5×</option>
              <option value="500" selected>1×</option>
              <option value="250">2×</option>
              <option value="125">4×</option>
            </select>
          </div>
          <div class="rv-legend">
            <div class="rv-legend-title">Rainfall intensity (dBZ)</div>
            <div class="rv-legend-bar">${swatches}</div>
          </div>
        </div>`;

      this._els = {
        play: c.querySelector(".rv-play"),
        toggle: c.querySelector(".rv-toggle"),
        chevron: c.querySelector(".rv-chevron"),
        ts: c.querySelector(".rv-timestamp"),
        age: c.querySelector(".rv-age"),
        panel: c.querySelector(".rv-panel"),
        slider: c.querySelector(".rv-slider"),
      };
      const { play: playBtn, toggle, age, slider } = this._els;

      playBtn.addEventListener("click", togglePlay);
      toggle.addEventListener("click", () => this.setExpanded(this._els.panel.hidden));
      age.addEventListener("click", showLatest);
      c.querySelector(".rv-step-back").addEventListener("click", () => { pause(); stepBack(); });
      c.querySelector(".rv-step-fwd").addEventListener("click", () => { pause(); stepForward(); });
      slider.addEventListener("input", (e) => {
        // Read first: pause() redraws the control, resetting the slider.
        const idx = parseInt(e.target.value, 10);
        pause();
        showFrame(idx);
      });
      c.querySelector(".rv-speed").addEventListener("change", (e) => {
        speed = parseInt(e.target.value, 10);
        if (playing) { pause(); play(); }
      });

      this._container = c;
      this._fit = () => this.fitToMap();
      m.on("resize", this._fit);
      // Keep the "min ago" in the badge tooltip current while paused.
      this._ageTimer = setInterval(() => this.update(), 30000);
      this.update();
      return c;
    },

    onRemove(m) {
      m.off("resize", this._fit);
      clearInterval(this._ageTimer);
      this._raiseCorner(false);
    },

    // Each map corner is its own stacking context, so on a narrow map the
    // minimap (bottom-right) would paint over the open panel. Lift this
    // corner above it while the panel is open.
    _raiseCorner(on) {
      const corner = this._container?.parentNode;
      if (corner) corner.classList.toggle("rv-corner-raised", on);
    },

    setExpanded(on, persist = true) {
      const { panel, toggle, chevron } = this._els;
      panel.hidden = !on;
      toggle.setAttribute("aria-expanded", String(on));
      toggle.title = on ? "Hide radar playback controls" : "Show radar playback controls";
      chevron.classList.toggle("fa-chevron-up", !on);
      chevron.classList.toggle("fa-chevron-down", on);
      if (persist) writeExpanded(on);
      this._raiseCorner(on);
      this.fitToMap();
    },

    // Fit the open panel to the map: up to 320px, never wider than the map
    // less its margins; drop the speed menu on narrow maps.
    fitToMap() {
      const c = this._container;
      if (!c || !this._map) return;
      const mapW = this._map.getSize().x;
      c.style.maxWidth = `${Math.max(120, mapW - 20)}px`;
      c.style.width = this._els.panel.hidden ? "" : `${Math.min(320, Math.max(120, mapW - 20))}px`;
      c.classList.toggle("rv-narrow", mapW < NARROW_PX);
    },

    // Sync the chip and panel with the current frame / playing state.
    update() {
      if (!this._els) return;
      const { play: playBtn, ts, age, slider } = this._els;
      const icon = playBtn.querySelector("i");
      icon.classList.toggle("fa-play", !playing);
      icon.classList.toggle("fa-pause", playing);

      const frame = frames[frameIdx];
      const latest = frames.length > 0 && frameIdx === frames.length - 1;
      ts.textContent = frame?.time ? fmtTime(frame.time) : "--:--";
      const ago = frame?.time ? Math.max(0, Math.round((Date.now() / 1000 - frame.time) / 60)) : null;
      const agoText = ago === null ? "" : ` (${ago} min ago)`;
      if (frame?.time && !latest) {
        const behind = Math.round((frames[frames.length - 1].time - frame.time) / 60);
        age.textContent = `−${behind} min`;
        age.title = `${behind} min before the latest frame${agoText}. Click to jump to it.`;
      } else {
        age.textContent = "Latest";
        age.title = `Showing the latest radar frame${agoText}`;
      }
      age.classList.toggle("is-latest", latest || !frame);
      age.disabled = latest || !frame;

      slider.max = Math.max(0, frames.length - 1);
      if (frameIdx >= 0) slider.value = frameIdx;
    },
  });

  /* ── layer registration ────────────────────────────────────── */
  vm.mapVM.registerPollingLayer("rainRadar", {
    label: "RainViewer Animated Rainfall Radar",
    menuGroup: "RainViewer",
    stack: "tiles",
    // The playback bar used to default the frames to 60%.
    defaultOpacity: 60,
    refreshMs: 0,
    visibleByDefault: localStorage.getItem(`ov.rainRadar`) || false,
    // The frame list is fetched here (not in drawFn) so the Layers drawer
    // shows loading / failed for it like any other feed.
    fetchFn: fetchFrameList,
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
      // Opened only once added -- it sizes itself to the map and lifts its corner.
      control.setExpanded(readExpanded(), false);

      // Clean up control + timers when the layerGroup is removed from the map
      layerGroup.off("remove", cleanup).on("remove", cleanup);

      // Initial frames + periodic refresh of frame list
      applyFrames(layerGroup, data);
      dataTimer = setInterval(() => refreshFrames(layerGroup), DATA_REFRESH_MS);

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