import L from "leaflet";
import Lerc from "lerc";
import {
  HEIGHT_STOPS,
  STEEPNESS_BANDS,
  TILE_SIZE,
  paintHeightTile,
  paintSteepnessTile,
  tileCellMetres,
} from "../utils/heightTile.js";

// Heights, not pictures: 257 x 257 Float32 LERC grids (served as image/jpeg),
// so they're fetched and painted here. Statewide 5 m data from NSW Spatial Services.
const HEIGHT_TILE_URL = "https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Elevation/MapServer/tile";
const HILLSHADE_TILE_URL =
  "https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}";
const COVERAGE = L.latLngBounds([-37.99, 140], [-28.02, 154]);
const MIN_ZOOM = 5;
// Finer height tiles exist down to 17, but only add requests over 5 m data.
const MAX_HEIGHT_ZOOM = 16;
// Past this the hillshade service returns a "no data" placeholder.
const MAX_HILLSHADE_ZOOM = 16;
const MAX_ZOOM = 19;
const DEFAULT_OPACITY = 70;

const HeightGridLayer = L.GridLayer.extend({
  initialize(options) {
    L.GridLayer.prototype.initialize.call(this, options);
    // Stop fetching tiles that have been panned or zoomed away.
    this.on("tileunload", (e) => e.tile._abort?.abort());
  },

  createTile(coords, done) {
    const tile = L.DomUtil.create("canvas");
    tile.width = tile.height = TILE_SIZE;
    const abort = new AbortController();
    tile._abort = abort;

    fetch(`${HEIGHT_TILE_URL}/${coords.z}/${coords.y}/${coords.x}`, { credentials: "omit", signal: abort.signal })
      .then((res) => {
        if (res.status === 404) return null; // no data here, along the edge of the state
        if (!res.ok) throw new Error(`Height tile HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        if (!buffer) {
          done(null, tile);
          return;
        }
        const { pixels, width, maskData } = Lerc.decode(buffer);
        const ctx = tile.getContext("2d");
        const image = ctx.createImageData(TILE_SIZE, TILE_SIZE);
        this.options.paint(pixels[0], width, maskData, tileCellMetres(coords.y, coords.z), image.data);
        ctx.putImageData(image, 0, 0);
        done(null, tile);
      })
      .catch((err) => {
        if (!abort.signal.aborted) done(err, tile);
      });

    return tile;
  },
});

/** Colour key shown on the map while a layer is on. */
const TerrainKeyControl = L.Control.extend({
  options: { position: "bottomleft" },

  onAdd() {
    const { title, background, ticks, stepped } = this.options;
    const div = L.DomUtil.create("div", `height-key leaflet-bar${stepped ? " height-key-stepped" : ""}`);
    div.innerHTML = `
      <div class="height-key-title">${title}</div>
      <div class="height-key-bar" style="background:${background}"></div>
      <div class="height-key-ticks">${ticks.map((t) => `<span>${t}</span>`).join("")}</div>`;
    L.DomEvent.disableClickPropagation(div);
    return div;
  },
});

const rgb = (c) => `rgb(${c.join(",")})`;

const heightKey = () =>
  new TerrainKeyControl({
    title: "Height (m), indicative only",
    background: `linear-gradient(to right,${HEIGHT_STOPS.map(([, c]) => rgb(c)).join(",")})`,
    ticks: HEIGHT_STOPS.filter((_, i) => i % 2 === 0).map(([h]) => h),
  });

const steepnessKey = () => {
  const width = 100 / STEEPNESS_BANDS.length;
  const bands = STEEPNESS_BANDS.map(([, c], i) => `${rgb(c)} ${i * width}% ${(i + 1) * width}%`);
  return new TerrainKeyControl({
    title: "Steepness (degrees), indicative only",
    background: `linear-gradient(to right,${bands.join(",")})`,
    ticks: STEEPNESS_BANDS.map(([from], i) => `${from}${i === STEEPNESS_BANDS.length - 1 ? "+" : ""}`),
    stepped: true,
  });
};

function registerTerrainLayer(vm, map, key, label, makeLayer, makeControl) {
  const entry = vm.mapVM.registerPollingLayer(key, {
    label,
    menuGroup: "Terrain",
    stack: "ground",
    defaultOpacity: DEFAULT_OPACITY,
    refreshMs: 0, // the data doesn't change
    visibleByDefault: localStorage.getItem(`ov.${key}`) || false,
    fetchFn: async () => ({}),
    drawFn: (layerGroup) => layerGroup.addLayer(makeLayer()),
  });

  if (!makeControl) return;
  const control = makeControl();
  entry.layerGroup.on("add", () => control.addTo(map));
  entry.layerGroup.on("remove", () => control.remove());
  if (map.hasLayer(entry.layerGroup)) control.addTo(map);
}

const heightGrid = (paint) =>
  new HeightGridLayer({
    paint,
    bounds: COVERAGE,
    minZoom: MIN_ZOOM,
    maxNativeZoom: MAX_HEIGHT_ZOOM,
    attribution: "NSW Spatial Services",
  });

export function registerTerrainLayers(vm, map) {
  registerTerrainLayer(vm, map, "heightShading", "Elevation (Height Above Sea Level)", () => heightGrid(paintHeightTile), heightKey);
  registerTerrainLayer(vm, map, "hillshade", "Hillshade", () =>
    L.tileLayer(HILLSHADE_TILE_URL, { maxNativeZoom: MAX_HILLSHADE_ZOOM, maxZoom: MAX_ZOOM, attribution: "Esri" })
  );
  registerTerrainLayer(vm, map, "steepness", "Steepness", () => heightGrid(paintSteepnessTile), steepnessKey);
}
