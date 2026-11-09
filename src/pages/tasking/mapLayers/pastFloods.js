import L from "leaflet";
import { clearImageBorder } from "../utils/floodTile.js";

// Aerial imagery flown during past floods, by NSW Spatial Services. The areas
// are small and scattered, so each one is its own tile layer that only asks
// for tiles inside its footprint. These are dynamic map services, so a tile is
// an export of its web mercator bounds.
const SERVICE_URL = "https://portal.spatial.nsw.gov.au/server/rest/services";
const WORLD_METRES = 40075016.68557849;
const TILE_SIZE = 256;
// The server sometimes returns a blank image for a good tile, then the real one
// when asked again. Tiles really are blank where the photos have gaps, so the
// retries are capped.
const BLANK_ATTEMPTS = 5;
const BLANK_RETRY_MS = 300;

/** One toggle per flood; areas are [layer id, south, west, north, east]. */
const FLOODS = [
  { key: "floodMar2012", label: "March 2012 (Forbes)", service: "Floods_Historical", areas: [[0, -33.6, 147.8, -33.2, 148.2]] },
  { key: "floodOct2016", label: "October 2016 (Forbes)", service: "Floods_Historical", areas: [[1, -33.6, 147.8, -33.2, 148.2]] },
  {
    key: "floodMar2021",
    label: "March 2021 (Hawkesbury-Nepean, Lower Clarence)",
    service: "Floods_2021",
    areas: [
      [5, -29.55, 153.08, -29.35, 153.39],
      [6, -33.72, 150.73, -33.47, 150.86],
      [7, -33.72, 150.64, -33.53, 150.75],
      [8, -33.91, 150.82, -33.22, 151.14],
      [9, -34, 150.57, -33.63, 150.82],
    ],
  },
  {
    key: "floodApr2021",
    label: "April 2021 (Bourke, Walgett, Brewarrina, Mogil Mogil, Mungindi)",
    service: "Floods_2021",
    areas: [
      [0, -30.15, 145.85, -30.01, 146.01],
      [1, -30.14, 147.99, -29.89, 148.24],
      [2, -30, 146.81, -29.92, 146.92],
      [3, -29.41, 148.67, -29.31, 148.76],
      [4, -29.05, 148.88, -28.93, 149.05],
    ],
  },
  {
    key: "floodMar2022",
    label: "March 2022 (Lismore, Grafton, Ulmarra, Hawkesbury-Nepean, Singleton, Wisemans Ferry)",
    service: "Floods_Mar_2022",
    areas: [
      [0, -33.44, 150.93, -33.28, 151.05],
      [1, -32.59, 151.11, -32.53, 151.21],
      [2, -33.71, 150.68, -33.45, 150.97],
      [3, -29.68, 152.97, -29.62, 153.06],
      [4, -29.75, 152.89, -29.61, 152.99],
      [5, -28.84, 153.25, -28.78, 153.31],
    ],
  },
  {
    key: "floodNov2022",
    label: "November-December 2022 (Forbes, Condobolin, Bathurst, Lake Cargelligo, Murray and Murrumbidgee towns)",
    service: "Floods_Nov_2022",
    areas: [
      [0, -34.22, 141.71, -33.98, 142.27],
      [1, -35.35, 143.22, -34.83, 143.7],
      [2, -34.78, 143.07, -34.57, 143.71],
      [3, -35.65, 145.98, -35.28, 146.66],
      [4, -34.98, 143.02, -34.54, 143.57],
      [5, -36.13, 145.86, -35.9, 146.46],
      [6, -33.4, 146.32, -32.99, 146.52],
      [7, -35.52, 143.42, -35.21, 143.86],
      [8, -33.15, 147.11, -33.06, 147.25],
      [9, -33.15, 147.29, -33.08, 147.39],
      [10, -35.69, 146.26, -35.6, 146.58],
      [11, -33.49, 149.5, -33.37, 149.64],
      [12, -33.52, 147.95, -33.32, 148.11],
    ],
  },
];

const FloodImageryLayer = L.GridLayer.extend({
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

    this._load(coords, tile, abort.signal)
      .then(() => done(null, tile))
      .catch((err) => {
        if (!abort.signal.aborted) done(err, tile);
      });

    return tile;
  },

  /** Draw the tile, asking again when the server hands back a blank image. */
  async _load(coords, tile, signal) {
    const ctx = tile.getContext("2d", { willReadFrequently: true });
    for (let attempt = 1; attempt <= BLANK_ATTEMPTS; attempt++) {
      const res = await fetch(this._url(coords), { credentials: "omit", signal });
      if (!res.ok) throw new Error(`Flood imagery HTTP ${res.status}`);
      const bitmap = await createImageBitmap(await res.blob());
      ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      const image = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
      const visible = clearImageBorder(image.data);
      ctx.putImageData(image, 0, 0);
      if (visible || attempt === BLANK_ATTEMPTS) return;
      await new Promise((resolve) => setTimeout(resolve, BLANK_RETRY_MS));
      signal.throwIfAborted();
    }
  },

  _url(coords) {
    const size = WORLD_METRES / 2 ** coords.z;
    const west = -WORLD_METRES / 2 + coords.x * size;
    const north = WORLD_METRES / 2 - coords.y * size;
    const params = new URLSearchParams({
      bbox: `${west},${north - size},${west + size},${north}`,
      bboxSR: "3857",
      imageSR: "3857",
      size: `${TILE_SIZE},${TILE_SIZE}`,
      format: "png32",
      transparent: "true",
      layers: `show:${this.options.imageLayer}`,
      f: "image",
    });
    return `${SERVICE_URL}/${this.options.service}/MapServer/export?${params}`;
  },
});

export function registerPastFloodLayers(vm) {
  for (const { key, label, service, areas } of FLOODS) {
    vm.mapVM.registerPollingLayer(key, {
      label,
      menuGroup: "Historical Imagery",
      stack: "ground",
      defaultOpacity: 70,
      refreshMs: 0, // archived imagery
      visibleByDefault: localStorage.getItem(`ov.${key}`) || false,
      fetchFn: async () => ({}),
      drawFn: (layerGroup) => {
        for (const [imageLayer, south, west, north, east] of areas) {
          layerGroup.addLayer(
            new FloodImageryLayer({
              service,
              imageLayer,
              bounds: L.latLngBounds([south, west], [north, east]),
              attribution: "NSW Spatial Services",
            })
          );
        }
      },
    });
  }
}
