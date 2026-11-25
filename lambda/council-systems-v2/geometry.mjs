/**
 * Shrinks council polygons for the map. Councils' GIS layers are often
 * surveyed to well under a metre (Parramatta's warning areas are 148,000
 * points, 4 MB), far more than a map overlay needs.
 */

// About 1 m at Sydney's latitude, in degrees.
export const DEFAULT_TOLERANCE = 0.00001;

const round6 = (n) => Math.round(n * 1e6) / 1e6; // ~0.1 m

// Squared distance from p to the segment a-b.
function segDist2(p, a, b) {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx || dy) {
    const t = Math.max(0, Math.min(1, ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)));
    x += dx * t;
    y += dy * t;
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

/** Douglas-Peucker on one line of [lng, lat] points (iterative, so long rings can't overflow the stack). */
export function simplifyLine(points, tolerance = DEFAULT_TOLERANCE) {
  if (points.length <= 2) return points.map(([x, y]) => [round6(x), round6(y)]);
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const tol2 = tolerance * tolerance;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxD = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segDist2(points[i], points[first], points[last]);
      if (d > maxD) {
        maxD = d;
        index = i;
      }
    }
    if (index !== -1 && maxD > tol2) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]).map(([x, y]) => [round6(x), round6(y)]);
}

// A ring keeps at least 4 points (a closed triangle); one that collapses is dropped.
function simplifyRing(ring, tolerance) {
  const out = simplifyLine(ring, tolerance);
  return out.length >= 4 ? out : null;
}

function simplifyPolygon(rings, tolerance) {
  const outer = simplifyRing(rings[0] || [], tolerance);
  if (!outer) return null;
  return [outer, ...rings.slice(1).map((r) => simplifyRing(r, tolerance)).filter(Boolean)];
}

/** Simplifies a Polygon or MultiPolygon; other geometries are returned as they are. */
export function simplifyGeometry(geometry, tolerance = DEFAULT_TOLERANCE) {
  if (geometry?.type === 'Polygon') {
    const rings = simplifyPolygon(geometry.coordinates, tolerance);
    return rings ? { type: 'Polygon', coordinates: rings } : null;
  }
  if (geometry?.type === 'MultiPolygon') {
    const polys = geometry.coordinates.map((p) => simplifyPolygon(p, tolerance)).filter(Boolean);
    return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null;
  }
  return geometry;
}

// Ray casting on one ring of [lng, lat] points.
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether a [lng, lat] point is inside a Polygon or MultiPolygon (holes respected). */
export function pointInGeometry(point, geometry) {
  const polys = geometry?.type === 'Polygon' ? [geometry.coordinates]
    : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polys.some(([outer, ...holes]) => outer && inRing(point, outer) && !holes.some((h) => inRing(point, h)));
}
