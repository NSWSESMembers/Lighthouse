/**
 * Power outage feeds of the three NSW electricity distributors, normalised
 * to one GeoJSON shape.
 *
 * None of these are documented APIs: they are the JSON/KML files each
 * company's own public outage map loads, found by watching those pages'
 * network requests (November 2026). If one breaks, open the company's outage
 * map with the browser dev tools Network tab and look for the new URL.
 *
 *   Ausgrid    https://www.ausgrid.com.au/Outages/Current-Outages
 *   Endeavour  https://www.endeavourenergy.com.au/power-outages/outage-map
 *   Essential  https://www.essentialenergy.com.au/outages-and-faults/power-outages
 *
 * Every normalised feature has the same properties (see normaliseFeature):
 *   provider, id, type ('unplanned' | 'planned'), status, customers, cause,
 *   suburbs, streets, start, estRestore, updated (ISO strings or null),
 *   lat, lng (the marker position).
 * Its geometry is the outage area (Polygon / MultiPolygon) where the feed
 * has one, else the marker Point.
 */

export const PROVIDERS = {
  ausgrid: {
    name: 'Ausgrid',
    url: 'https://www.ausgrid.com.au/api/outages-map/outages/list?futureDayLimit=2',
    parse: (text) => parseAusgrid(JSON.parse(text)),
  },
  endeavour: {
    name: 'Endeavour Energy',
    url: 'https://www.endeavourenergy.com.au/api/public/outage-list',
    parse: (text) => parseEndeavour(JSON.parse(text)),
  },
  essential: {
    name: 'Essential Energy',
    url: 'https://www.essentialenergy.com.au/Assets/kmz/current.kml',
    parse: (text) => parseEssential(text),
  },
};

/** Planned outages further ahead than this are left out. */
export const PLANNED_WINDOW_HOURS = 48;

// ── Shared helpers ──────────────────────────────────────────────────

const round = (n) => Math.round(n * 1e5) / 1e5; // ~1 m; keeps the payload small

function roundCoords(coords) {
  if (typeof coords[0] === 'number') return [round(coords[0]), round(coords[1])];
  return coords.map(roundCoords);
}

const str = (v) => (v == null ? '' : String(v).trim());

function isoOrNull(v) {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function joinList(v) {
  if (Array.isArray(v)) return [...new Set(v.map(str).filter(Boolean))].join(', ');
  return str(v);
}

/** "ProceedingAsScheduled" / "REPAIR" -> "Proceeding as scheduled" / "Repair" */
export function humaniseStatus(s) {
  const t = str(s)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
}

function normaliseFeature(provider, f) {
  if (!Number.isFinite(f.lat) || !Number.isFinite(f.lng)) return null;
  const geometry =
    f.area && /^(Multi)?Polygon$/.test(f.area.type) && Array.isArray(f.area.coordinates)
      ? { type: f.area.type, coordinates: roundCoords(f.area.coordinates) }
      : { type: 'Point', coordinates: [round(f.lng), round(f.lat)] };
  return {
    type: 'Feature',
    geometry,
    properties: {
      provider,
      id: str(f.id),
      type: f.type === 'planned' ? 'planned' : 'unplanned',
      status: humaniseStatus(f.status),
      customers: Number.isFinite(Number(f.customers)) && f.customers !== '' && f.customers != null
        ? Number(f.customers)
        : null,
      cause: str(f.cause),
      suburbs: str(f.suburbs),
      streets: str(f.streets),
      start: isoOrNull(f.start),
      estRestore: isoOrNull(f.estRestore),
      updated: isoOrNull(f.updated),
      lat: round(f.lat),
      lng: round(f.lng),
    },
  };
}

/**
 * Keep unplanned outages, and planned ones that haven't finished and start
 * within PLANNED_WINDOW_HOURS.
 */
export function isRelevant(props, now = Date.now()) {
  if (props.type !== 'planned') return true;
  const start = props.start ? Date.parse(props.start) : NaN;
  const end = props.estRestore ? Date.parse(props.estRestore) : NaN;
  if (Number.isFinite(end) && end < now) return false;
  if (Number.isFinite(start) && start > now + PLANNED_WINDOW_HOURS * 3600e3) return false;
  return true;
}

// ── Ausgrid ─────────────────────────────────────────────────────────
// A JSON array. OutageDisplayType 'U' is unplanned, 'P' planned. No outage
// areas, only a marker and a bounding box.

const AUSGRID_FINISHED = new Set(['completed', 'cancelled', 'restored']);

export function parseAusgrid(json) {
  if (!Array.isArray(json)) throw new Error('Ausgrid: expected an array');
  return json
    .filter((o) => !AUSGRID_FINISHED.has(str(o.PowerStatus).toLowerCase()))
    .map((o) =>
      normaliseFeature('ausgrid', {
        id: o.EventId,
        type: o.OutageDisplayType === 'P' ? 'planned' : 'unplanned',
        status: o.PowerStatus,
        customers: o.AffectedCustomers,
        cause: o.Cause || o.Reason,
        suburbs: joinList(o.Area),
        streets: joinList(o.StreetsAffected),
        start: o.StartDateTime,
        estRestore: o.EstRestTime,
        updated: o.WhenUpdated,
        lat: Number(o.MarkerLocation?.lat),
        lng: Number(o.MarkerLocation?.lng),
      }),
    )
    .filter(Boolean);
}

// ── Endeavour Energy ────────────────────────────────────────────────
// { areas: [...], singlePremise: [...] }. Only `areas` is used:
// `singlePremise` is individual homes with their street address.

export function parseEndeavour(json) {
  if (!json || !Array.isArray(json.areas)) throw new Error('Endeavour: expected { areas: [] }');
  return json.areas
    .map((o) =>
      normaliseFeature('endeavour', {
        id: o.incident_id,
        type: str(o.outage_type).toUpperCase() === 'PLANNED' ? 'planned' : 'unplanned',
        status: o.incident_status,
        customers: o.customers_affected,
        cause: o.cause || o.sub_cause,
        suburbs: joinList(o.cityname_list?.length ? o.cityname_list : o.cityname),
        // street_name is one premise's address, so it is left out.
        streets: '',
        start: o.start_date_time,
        estRestore: o.end_date_time || o.etr,
        updated: o.materialized_at,
        lat: Number(o.center_lat),
        lng: Number(o.center_lng),
        area: o.polygon_geojson,
      }),
    )
    .filter(Boolean);
}

// ── Essential Energy ────────────────────────────────────────────────
// KML. Each Placemark has an id (the incident), a styleUrl ending in
// _planned or _unplanned, an HTML description with the details, and a
// MultiGeometry of outage area Polygons plus one centre Point. Dates in the
// description are Sydney local time, dd/mm/yyyy HH:MM:SS.

const unCdata = (s) => s.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '');

function descField(html, label) {
  const re = new RegExp(`<span>\\s*${label}\\s*:?\\s*</span>([^<]*)`, 'i');
  const m = re.exec(html);
  return m ? m[1].trim() : '';
}

function parseCoordList(text) {
  return text
    .trim()
    .split(/\s+/)
    .map((t) => t.split(',').map(Number))
    .filter((c) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map(([lng, lat]) => [lng, lat]);
}

/** UTC offset of Australia/Sydney (minutes) at the given instant. */
function sydneyOffsetMinutes(utcMs) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney',
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - utcMs) / 60000);
}

/** "06/11/2026 08:39:51" (Sydney time) -> ISO string, or null. */
export function sydneyDateToIso(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(str(s));
  if (!m) return null;
  const [, d, mo, y, h, mi, sec] = m.map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi, sec || 0);
  // Two passes so times either side of a daylight saving change land right.
  let utc = wallAsUtc - sydneyOffsetMinutes(wallAsUtc) * 60000;
  utc = wallAsUtc - sydneyOffsetMinutes(utc) * 60000;
  return new Date(utc).toISOString();
}

export function parseEssential(kml) {
  if (typeof kml !== 'string' || !/<kml[\s>]/i.test(kml)) throw new Error('Essential: expected KML');
  const out = [];
  for (const [, attrs, body] of kml.matchAll(/<Placemark\b([^>]*)>([\s\S]*?)<\/Placemark>/g)) {
    const id = /\bid\s*=\s*["']([^"']*)["']/.exec(attrs)?.[1] || unCdata(/<Snippet>([\s\S]*?)<\/Snippet>/.exec(body)?.[1] || '');
    const style = /<styleUrl>([\s\S]*?)<\/styleUrl>/.exec(body)?.[1] || '';
    const desc = unCdata(/<description>([\s\S]*?)<\/description>/.exec(body)?.[1] || '');

    const polygons = [...body.matchAll(/<Polygon\b[\s\S]*?<\/Polygon>/g)]
      .map(([poly]) => {
        const outer = /<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/.exec(poly);
        if (!outer) return null;
        const holes = [...poly.matchAll(/<innerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g)].map((h) =>
          parseCoordList(h[1]),
        );
        const ring = parseCoordList(outer[1]);
        return ring.length >= 4 ? [ring, ...holes.filter((h) => h.length >= 4)] : null;
      })
      .filter(Boolean);
    const point = /<Point\b[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/.exec(body);
    let [lng, lat] = point ? parseCoordList(point[1])[0] || [] : [];
    if (!Number.isFinite(lat) && polygons.length) {
      // No centre point: use the middle of the first ring's bounding box.
      const ring = polygons[0][0];
      const xs = ring.map((c) => c[0]);
      const ys = ring.map((c) => c[1]);
      lng = (Math.min(...xs) + Math.max(...xs)) / 2;
      lat = (Math.min(...ys) + Math.max(...ys)) / 2;
    }

    const area =
      polygons.length === 1
        ? { type: 'Polygon', coordinates: polygons[0] }
        : polygons.length > 1
          ? { type: 'MultiPolygon', coordinates: polygons }
          : null;

    out.push(
      normaliseFeature('essential', {
        id,
        type: /_planned$/i.test(style.trim()) ? 'planned' : 'unplanned',
        status: descField(desc, 'Status'),
        customers: descField(desc, 'No\\. of Customers affected') || null,
        cause: descField(desc, 'Reason'),
        suburbs: '',
        streets: '',
        start: sydneyDateToIso(descField(desc, 'Time Off')),
        estRestore: sydneyDateToIso(descField(desc, 'Est\\. Time On')),
        updated: sydneyDateToIso(descField(desc, 'Last Updated')),
        lat,
        lng,
        area,
      }),
    );
  }
  return out.filter(Boolean);
}
