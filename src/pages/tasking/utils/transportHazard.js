const ICONS = 'https://www.livetraffic.com/assets/icons/map/';

// Older feed items without CategoryIcon only carry the display text.
const MAIN_CATEGORY_TO_ICON_CATEGORY = {
  Hazard: 'Hazard',
  Crash: 'Crash',
  Breakdown: 'Breakdown',
  'Traffic lights blacked out': 'TrafficSignals',
  'Changed traffic conditions': 'ChangedConditions',
};

// Live Traffic's severity for incidents: busier roads get the stronger icon.
function trafficSeverity(p) {
  switch (p.roads?.[0]?.trafficVolume?.toLowerCase()) {
    case 'heavy':
      return 'heavy';
    case 'light':
      return 'low';
    default:
      return 'moderate';
  }
}

const hazardCategory = (p) => p.CategoryIcon || MAIN_CATEGORY_TO_ICON_CATEGORY[p.mainCategory] || 'Hazard';

// Council reports have no traffic volume, so Live Traffic uses whether they impact the network.
const hazardSeverity = (p, council) => (council ? (p.impactingNetwork ? 'moderate' : 'low') : trafficSeverity(p));

/**
 * Live Traffic map icon for a hazard feature from the incidents or council
 * (regional LGA) feed. Mirrors livetraffic.com: picks by
 * properties.CategoryIcon, and for council reports the severity comes from
 * whether the closure impacts the network rather than traffic volume.
 */
export function transportHazardIcon(f, { council = false } = {}) {
  const p = f?.properties || {};
  const category = hazardCategory(p);
  const severity = hazardSeverity(p, council);

  switch (category) {
    case 'Crash':
      return `${ICONS}crashes/${severity}-now.svg`;
    case 'Breakdown':
      return `${ICONS}breakdowns/${severity}-now.svg`;
    case 'TrafficSignals':
      return `${ICONS}traffic-lights/${severity}-now.svg`;
    case 'ChangedConditions':
      return `${ICONS}changed-traffic/${severity}-now.svg`;
    case 'Roadworks':
      return `${ICONS}roadworks/${severity}-now.svg`;
    case 'Flood':
      return `${ICONS}other-hazards/flood.svg`;
    case 'Fire':
      return `${ICONS}other-hazards/fire.svg`;
    case 'AdverseWeather':
      return `${ICONS}other-hazards/adverse-weather.svg`;
    case 'SnowIce':
      return `${ICONS}alpine/snow.svg`;
    case 'PublicEvent':
      return `${ICONS}events/major-now.svg`;
    case 'Hazard':
      return `${ICONS}general-hazards/${severity}-now.svg`;
    default:
      return `${ICONS}general-hazards/moderate-now.svg`;
  }
}

const SEVERITY_COLOURS = { heavy: '#9B0000', moderate: '#F17130', low: '#666666' };

/**
 * Line/area colour for a hazard, as on livetraffic.com: fire is dark red,
 * water/weather/events blue, traffic lights orange, and the rest by severity.
 */
export function transportHazardColour(f, { council = false } = {}) {
  const p = f?.properties || {};
  switch (hazardCategory(p)) {
    case 'Fire':
      return '#9B0000';
    case 'Flood':
    case 'SnowIce':
    case 'AdverseWeather':
    case 'PublicEvent':
      return '#0067A5';
    case 'TrafficSignals':
      return '#F17130';
    case 'Crash':
    case 'Breakdown':
    case 'Hazard':
    case 'ChangedConditions':
    case 'Roadworks':
      return SEVERITY_COLOURS[hazardSeverity(p, council)];
    default:
      return '#000000';
  }
}

/**
 * Decodes a Google encoded polyline (precision 5), as used by the Live
 * Traffic encodedPolylines property, into [lat, lng] pairs.
 */
export function decodePolyline(encoded) {
  const coords = [];
  if (typeof encoded !== 'string') return coords;
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < encoded.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    if (index >= encoded.length) break;
    lng += next();
    coords.push([lat * 1e-5, lng * 1e-5]);
  }
  return coords;
}

const toLatLng = ([lng, lat]) => [lat, lng];
const validLatLng = ([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng);

/**
 * Everything to draw for a hazard feature, in Leaflet [lat, lng] order:
 *  - points: marker positions (the main point plus any extra Point in geometry.collections)
 *  - lines: the affected stretch of road (properties.encodedPolylines, or LineString geometry)
 *  - areas: affected areas (Polygon geometry in geometry.collections)
 */
export function transportHazardShapes(f) {
  const points = [];
  const lines = [];
  const areas = [];

  const addGeometry = (g) => {
    if (!g?.coordinates) return;
    switch (g.type) {
      case 'Point':
        points.push(toLatLng(g.coordinates));
        break;
      case 'MultiPoint':
        g.coordinates.forEach((c) => points.push(toLatLng(c)));
        break;
      case 'LineString':
        lines.push(g.coordinates.map(toLatLng));
        break;
      case 'MultiLineString':
        g.coordinates.forEach((l) => lines.push(l.map(toLatLng)));
        break;
      case 'Polygon':
        areas.push(g.coordinates.map((ring) => ring.map(toLatLng)));
        break;
      case 'MultiPolygon':
        g.coordinates.forEach((poly) => areas.push(poly.map((ring) => ring.map(toLatLng))));
        break;
    }
  };

  addGeometry(f?.geometry);
  (f?.geometry?.collections || []).forEach(addGeometry);
  (f?.properties?.encodedPolylines || []).forEach((pl) => lines.push(decodePolyline(pl?.coords)));

  return {
    points: points.filter(validLatLng),
    lines: lines.map((l) => l.filter(validLatLng)).filter((l) => l.length >= 2),
    areas: areas.map((poly) => poly.map((ring) => ring.filter(validLatLng))).filter((poly) => poly[0]?.length >= 3),
  };
}

/**
 * The advice line, as livetraffic.com builds it: adviceA/B/C joined with
 * commas, with the speed limit only added to a "Reduced speed limit" item.
 * The feed sends speedLimit -1 when no limit is set.
 */
export function transportHazardAdvice(p) {
  const speed = Number(p?.speedLimit);
  const hasSpeed = Number.isFinite(speed) && speed > 0;
  return [p?.adviceA, p?.adviceB, p?.adviceC]
    .map((a) => (typeof a === 'string' ? a.trim() : ''))
    .filter(Boolean)
    .map((a) => (a === 'Reduced speed limit' && hasSpeed ? `${a} (${speed} km/h)` : a))
    .join(', ');
}
