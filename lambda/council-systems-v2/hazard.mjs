/**
 * Australian flood hazard categories H1-H6 from flood depth and velocity:
 * AIDR "Technical flood risk management guideline: Flood hazard" (Australian
 * Disaster Resilience Guideline 7-3), Table 2, "Combined hazard curves -
 * vulnerability thresholds classification limits". A cell is the lowest
 * category whose depth, velocity and depth x velocity limits it's within;
 * beyond H5 it's H6.
 *
 *   H1  generally safe for vehicles, people and buildings
 *   H2  unsafe for small vehicles
 *   H3  unsafe for vehicles, children and the elderly
 *   H4  unsafe for vehicles and people
 *   H5  unsafe for vehicles and people; all buildings vulnerable to structural
 *       damage, some less robust buildings vulnerable to failure
 *   H6  unsafe for vehicles and people; all buildings vulnerable to failure
 */

export const HAZARD_LIMITS = [
  { h: 1, dv: 0.3, d: 0.3, v: 2.0 },
  { h: 2, dv: 0.6, d: 0.5, v: 2.0 },
  { h: 3, dv: 0.6, d: 1.2, v: 2.0 },
  { h: 4, dv: 1.0, d: 2.0, v: 2.0 },
  { h: 5, dv: 4.0, d: 4.0, v: 4.0 },
];

// Shallower than this is treated as dry (model noise). Not a guideline
// limit: shallow fast water can still be H5 (over 2 m/s), so it stays low.
export const MIN_DEPTH = 0.02;

/** 0 (dry) or 1-6 for depth (m) and velocity (m/s). A missing velocity counts as still water. */
export function hazardCategory(depth, velocity) {
  if (!(depth > MIN_DEPTH)) return 0;
  const v = Number.isFinite(velocity) && velocity > 0 ? velocity : 0;
  for (const lim of HAZARD_LIMITS) {
    if (depth <= lim.d && v <= lim.v && depth * v <= lim.dv) return lim.h;
  }
  return 6;
}

/**
 * A regular lon/lat grid with `cellMetres` cells covering `bounds`
 * ({ west, east, south, north }), and the sub-grid (rows/columns, and the
 * exact bbox of those cells) covering `inner`, so rasters fetched for
 * different model areas line up cell for cell.
 */
export function makeGrid(bounds, cellMetres) {
  const midLat = ((bounds.north + bounds.south) / 2) * (Math.PI / 180);
  const cellLon = cellMetres / (111320 * Math.cos(midLat));
  const cellLat = cellMetres / 110574;
  const width = Math.ceil((bounds.east - bounds.west) / cellLon);
  const height = Math.ceil((bounds.north - bounds.south) / cellLat);
  const grid = { west: bounds.west, north: bounds.north, cellLon, cellLat, width, height };
  grid.window = (inner) => {
    const c0 = Math.max(0, Math.floor((inner.west - grid.west) / cellLon));
    const c1 = Math.min(width, Math.ceil((inner.east - grid.west) / cellLon));
    const r0 = Math.max(0, Math.floor((grid.north - inner.north) / cellLat));
    const r1 = Math.min(height, Math.ceil((grid.north - inner.south) / cellLat));
    return {
      col: c0, row: r0, width: c1 - c0, height: r1 - r0,
      bbox: [grid.west + c0 * cellLon, grid.north - r1 * cellLat, grid.west + c1 * cellLon, grid.north - r0 * cellLat],
    };
  };
  return grid;
}

/**
 * Combines model areas into hazard / depth / velocity arrays on `grid`.
 * Each area is { window, depth, velocity } where depth and velocity are row
 * arrays (north first, as Lizard's raster data returns them) for the window.
 * Where areas overlap, the higher hazard wins.
 */
export function combineHazard(grid, areas) {
  const n = grid.width * grid.height;
  const hazard = new Uint8Array(n);
  const depth = new Uint16Array(n); // cm
  const velocity = new Uint16Array(n); // cm/s
  for (const { window: w, depth: D, velocity: V } of areas) {
    for (let r = 0; r < w.height; r++) {
      for (let c = 0; c < w.width; c++) {
        const d = D?.[r]?.[c];
        const v = V?.[r]?.[c];
        const h = hazardCategory(d, v);
        if (!h) continue;
        const i = (w.row + r) * grid.width + (w.col + c);
        if (h < hazard[i]) continue;
        hazard[i] = h;
        depth[i] = Math.min(65535, Math.round(d * 100));
        velocity[i] = Math.min(65535, Math.round((Number.isFinite(v) ? v : 0) * 100));
      }
    }
  }
  return { hazard, depth, velocity };
}

const b64 = (typed) => Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength).toString('base64');

/** The grid as JSON: cell arrays base64, little-endian, row 0 = north. */
export function encodeHazardGrid(grid, { hazard, depth, velocity }) {
  return {
    west: grid.west,
    north: grid.north,
    cellLon: grid.cellLon,
    cellLat: grid.cellLat,
    width: grid.width,
    height: grid.height,
    hazard: b64(hazard), // uint8: 0 dry, 1-6 = H1-H6
    depth: b64(depth), // uint16 cm
    velocity: b64(velocity), // uint16 cm/s
  };
}
