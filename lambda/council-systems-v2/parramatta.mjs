/**
 * City of Parramatta FloodSmart, run on the Lizard platform (Nelen &
 * Schuurmans).
 *
 *   warning-areas       the council's 10 flood warning areas (GeoServer WFS),
 *                       each with its FloodSmart forecast alert: whether the
 *                       flood model forecasts the area's Minor/Moderate/Major
 *                       level (Lizard raster alarms, needs the Lizard key)
 *   flood-hazard        Australian flood hazard categories H1-H6 (hazard.mjs) worked
 *                       out from the flood model's FORECAST maximum depth and
 *                       velocity, on a ~25 m grid (Lizard raster data, needs the key)
 *   flood-impacts       the council's FloodSmart impact assets (roads and crossings,
 *                       healthcare, houses, landmarks, levees) and whether its
 *                       12-hour model run FORECASTS each one flooded (GeoServer WFS,
 *                       public; the run's currency is checked with the key)
 *   water-levels        the latest reading of each water-level gauge (Lizard API, public)
 *   catchment-rainfall  rainfall totals per catchment, measured and forecast
 *                       (GeoServer WFS, the FloodSmart dashboard's rainfall map)
 *
 * The key (secrets.mjs) is only sent to parramatta.lizard.net. The FloodSmart
 * dashboard's own config (https://parramatta.lizard.net/api/v4/clientconfigs/8/)
 * lists every layer and station the dashboard uses, if anything here moves.
 */

import { simplifyGeometry, pointInGeometry } from './geometry.mjs';
import { catchmentRainfallDataset } from './floodsmart.mjs';
import { lizardAuthHeaders } from './secrets.mjs';
import { makeGrid, combineHazard, encodeHazardGrid, MIN_DEPTH } from './hazard.mjs';

// All 10 warning areas (the older parramatta:fwa layer has only the first 7).
const WARNING_AREAS_URL =
  'https://geoserver9.lizard.net/geoserver/parramatta/ows?service=WFS&version=1.0.0&request=GetFeature' +
  '&typeName=parramatta:v0227_parramatta_warning_areas&outputFormat=application/json&srsName=EPSG:4326';
const AREAS_TTL_MS = 6 * 60 * 60 * 1000; // the shapes rarely change; the alerts are fetched every time

const PORTAL = 'parramatta.lizard.net';
const LIZARD_API = `https://${PORTAL}/api/v4`;
const ORGANISATION = '33b32fe8-0317-4390-9ef9-259744c32cc1'; // City of Parramatta
const WATER_LEVEL_CODE = 'Waterlevel(mAHD)';
const MAX_PAGES = 10;

// Some of Lizard's modelled forecasts are filed as water levels too; their
// last value is hours ahead. Readings a little ahead are clock skew.
const FUTURE_SLACK_MS = 10 * 60 * 1000;

/** Every page of a Lizard API list. */
async function lizardList(url, fetchJson) {
  const results = [];
  let next = url;
  for (let i = 0; next && i < MAX_PAGES; i++) {
    const page = await fetchJson(next);
    results.push(...(page.results || []));
    next = page.next;
  }
  return results;
}

// Forecast alert levels, lowest first. Lizard's threshold names vary in case
// and spelling between alarms.
export const FORECAST_LEVELS = ['pim', 'minor', 'moderate', 'major'];
const LEVEL_NAMES = { 'public information message': 'pim', pim: 'pim', minor: 'minor', moderate: 'moderate', major: 'major' };
const levelOf = (name) => LEVEL_NAMES[String(name || '').trim().toLowerCase()] || null;

// "6 Parramatta CBD WA" -> "Parramatta CBD"
const areaName = (name) => String(name || '').replace(/^\s*\d+\s+/, '').replace(/\s+WA\s*$/i, '').trim() || 'Flood warning area';

// How far ahead the warning areas look. The flood model forecasts further
// (about 11 hours), but further ahead is less certain.
export const WARNING_FORECAST_HOURS = 5;

/**
 * One alarm's forecast level for the window: the highest warning level the
 * forecast water level at the alarm's point goes above between `now` and
 * `now` + WARNING_FORECAST_HOURS (or the end of the forecast, if sooner).
 * `series` is { points: [{ time, value }], until } from the alarm's forecast
 * raster; no current forecast is 'unknown', never an old result.
 */
export function alarmForecast(alarm, series, now = Date.now()) {
  const thresholds = (alarm.thresholds || [])
    .map((th) => ({ level: levelOf(th.warning_level), value: Number(th.value) }))
    .sort((x, y) => FORECAST_LEVELS.indexOf(x.level) - FORECAST_LEVELS.indexOf(y.level));
  const base = { thresholds, hours: WARNING_FORECAST_HOURS, from: new Date(now).toISOString() };
  const until = Date.parse(series?.until);
  if (!Number.isFinite(until) || until <= now) return { ...base, status: 'unknown', to: null };
  const end = Math.min(until, now + WARNING_FORECAST_HOURS * 3600 * 1000);
  const points = (series.points || [])
    .map((p) => ({ t: Date.parse(p.time), v: Number(p.value) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.t <= end && p.t >= now - 10 * 60 * 1000);
  if (!points.length) return { ...base, status: 'unknown', to: null };
  const to = new Date(end).toISOString();
  const above = alarm.comparison === '>=' ? (v, th) => v >= th : (v, th) => v > th;
  const peak = points.reduce((a, b) => (b.v > a.v ? b : a));
  const reached = [...thresholds].reverse().find((th) => above(peak.v, th.value));
  if (!reached) return { ...base, status: 'clear', to, value: peak.v, peakAt: new Date(peak.t).toISOString() };
  const first = points.find((p) => above(p.v, reached.value));
  return {
    ...base,
    status: reached.level,
    to,
    value: peak.v,
    peakAt: new Date(peak.t).toISOString(),
    thresholdValue: reached.value,
    expectedAt: new Date(first.t).toISOString(),
  };
}

/**
 * Warning areas + Lizard raster alarms -> simplified polygons with
 * { name, description, forecast }. An alarm belongs to the area its point is
 * in; only alarms whose thresholds are all warning levels (PIM / Minor /
 * Moderate / Major) count, not the dams' White/Amber/Red ones. `seriesOf`
 * maps an alarm uuid to its forecast series (see alarmForecast).
 *
 * forecast.status: 'clear', a FORECAST_LEVELS entry, 'unknown' or 'none' (no
 * alarm for the area). It's the flood model's forecast water level, so a
 * level means the model forecasts it in the window, not that it has been
 * observed or that a warning has been issued.
 */
export function warningAreaFeatures(fc, alarms = [], seriesOf = new Map(), now = Date.now()) {
  const warningAlarms = alarms.filter((a) => a?.active !== false && a?.thresholds?.length
    && a.thresholds.every((t) => levelOf(t.warning_level)) && Array.isArray(a.geometry?.coordinates));
  const rank = (s) => ['none', 'clear', 'unknown', ...FORECAST_LEVELS].indexOf(s);
  return (fc?.features || [])
    .filter((f) => f?.geometry)
    .map((f) => {
      let forecast = { status: 'none' };
      for (const a of warningAlarms.filter((x) => pointInGeometry(x.geometry.coordinates.slice(0, 2), f.geometry))) {
        const fcast = alarmForecast(a, seriesOf.get(a.uuid), now);
        if (rank(fcast.status) >= rank(forecast.status)) forecast = fcast;
      }
      return {
        type: 'Feature',
        geometry: simplifyGeometry(f.geometry),
        properties: {
          name: areaName(f.properties?.name || f.properties?.D),
          description: String(f.properties?.Descript || '').trim(),
          forecast,
        },
      };
    })
    .filter((f) => f.geometry);
}

/** fetchJson with the Lizard key, for this portal only. */
async function lizardFetcher(fetchJson) {
  const headers = await lizardAuthHeaders(PORTAL);
  return (url, opts = {}) => {
    if (new URL(url).host !== PORTAL) throw new Error(`Refusing to send the Lizard key to ${new URL(url).host}`);
    return fetchJson(url, { ...opts, headers });
  };
}

let areasCache = null; // { at, fc }

/** The warning areas with their forecast alerts. */
async function loadWarningAreas(fetchJson, now) {
  if (!areasCache || now - areasCache.at > AREAS_TTL_MS) areasCache = { at: now, fc: await fetchJson(WARNING_AREAS_URL) };
  const authed = await lizardFetcher(fetchJson);
  const alarms = await lizardList(`${LIZARD_API}/rasteralarms/?page_size=200`, authed);
  const warning = alarms.filter((a) => a.thresholds?.every((t) => levelOf(t.warning_level)) && a.raster && a.geometry);
  // Each warning alarm watches the flood model's forecast water level at a
  // point; its raster's last timestamp is the end of the current forecast.
  const rasters = [...new Set(warning.map((a) => a.raster))];
  const endOf = new Map(await Promise.all(rasters.map(async (u) => [u, (await authed(u)).last_value_timestamp])));
  const iso = (t) => new Date(t).toISOString().replace(/\.\d+Z$/, 'Z');
  const start = iso(now - 10 * 60 * 1000);
  const stop = iso(now + WARNING_FORECAST_HOURS * 3600 * 1000);
  const series = await Promise.all(warning.map(async (a) => {
    const [lon, lat] = a.geometry.coordinates;
    const geom = encodeURIComponent(`POINT(${lon} ${lat})`);
    const res = await authed(`${a.raster}point/?geom=${geom}&start=${start}&stop=${stop}`);
    return [a.uuid, { points: res.results || [], until: endOf.get(a.raster) }];
  }));
  return warningAreaFeatures(areasCache.fc, warning, new Map(series), now);
}

// The FloodSmart dashboard's "Show impact" assets. The council's own status
// per asset, set from its 12-hour operational model run (driven by BOM's
// STEPS rainfall nowcast). Each asset's model_id is its model area; that
// area's 12-hour run must still be forecasting ahead, or its status is
// 'unknown' rather than an old "not flooded".
const IMPACTS_URL =
  'https://geoserver9.lizard.net/geoserver/floodsmart/ows?service=WFS&version=1.0.0&request=GetFeature' +
  '&typeName=floodsmart:parramatta_impact_points_2701&outputFormat=application/json&srsName=EPSG:4326';
const IMPACT_RUNS = {
  Parramatta3: { area: 'North', search: 'operational_forecast 3-3', match: (n) => n.endsWith('Water level (timeseries)') },
  Parramatta4: { area: 'South', search: '4-2 operational forecast Water level', match: (n) => n === 'Parramatta 4-2 operational forecast Water level (timeseries)' },
};
const DISABLED_TRIGGER = 9999; // the council's "no trigger set"

// The data's asset types; "forest" is used for the levee points.
export function impactType(component, name) {
  if (component === 'forest') return /levee/i.test(name) ? 'Levee' : 'Bushland';
  return { road: 'Road or crossing', house: 'Houses', healthcare: 'Healthcare', historical_landmark: 'Historical landmark' }[component]
    || String(component || 'Asset').replace(/_/g, ' ');
}

/**
 * Impact assets -> points with { name, type, area, status, forecastFrom,
 * forecastUntil }. status: 'flooded' / 'not_flooded' from the council's
 * "<type>_flooded" / "<type>_not_flooded", or 'unknown' (anything else, or
 * the asset's 12-hour run isn't forecasting ahead). Assets with no trigger
 * set are left out: they'd always read "not flooded". `runs` maps a model_id
 * to { area, from, until }.
 */
export function impactFeatures(fc, runs = {}, now = Date.now()) {
  return (fc?.features || [])
    .filter((f) => Number(f?.properties?.trigger_le) < DISABLED_TRIGGER)
    .map((f) => {
      const p = f.properties;
      const coords = f.geometry?.coordinates || [Number(p.long), Number(p.lat)];
      const run = runs[p.model_id];
      const live = run && Date.parse(run.until) > now;
      const raw = String(p.status || '');
      const status = !live ? 'unknown' : /_not_flooded$/.test(raw) ? 'not_flooded' : /_flooded$/.test(raw) ? 'flooded' : 'unknown';
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(coords[0]), Number(coords[1])] },
        properties: {
          name: String(p.name || 'Asset').trim(),
          type: impactType(p.component, p.name),
          area: run?.area || null,
          status,
          forecastFrom: live ? run.from : null,
          forecastUntil: live ? run.until : null,
        },
      };
    })
    .filter((f) => f.geometry.coordinates.every(Number.isFinite));
}

async function loadImpacts(fetchJson, now) {
  const authed = await lizardFetcher(fetchJson);
  const runs = {};
  const [fc] = await Promise.all([
    fetchJson(IMPACTS_URL),
    ...Object.entries(IMPACT_RUNS).map(async ([modelId, { area, search, match }]) => {
      const list = await authed(`${LIZARD_API}/rasters/?name__icontains=${encodeURIComponent(search)}&page_size=100`);
      const latest = (list.results || []).filter((r) => !/historic/.test(r.name) && match(r.name))
        .sort((a, b) => Date.parse(b.last_value_timestamp) - Date.parse(a.last_value_timestamp))[0];
      if (latest) runs[modelId] = { area, from: latest.first_value_timestamp, until: latest.last_value_timestamp };
    }),
  ]);
  return impactFeatures(fc, runs, now);
}

// The flood model covers the council area as two model areas. Their "adfd"
// runs (by the name, driven by BOM's forecast rainfall; they run about a day
// and a half ahead) publish the maximum depth and velocity over the run; the
// shorter operational runs don't for the northern area.
const HAZARD_RUNS = [
  { area: 'North', run: 'Parramatta 3-3 adfd' },
  { area: 'South', run: 'Parramatta 4-2 adfd' },
];
const HAZARD_CELL_METRES = 25;
const RASTER_TIMEOUT_MS = 20000;

/**
 * Flood hazard H1-H6 from each model area's forecast maximum depth and
 * maximum velocity. The two maxima can happen at different times, so the
 * category can overstate the hazard at any one moment. A model area whose
 * forecast has run out (the model has stopped) is left out and reported as
 * unavailable, never shown from an old run.
 */
async function loadFloodHazard(fetchJson, now) {
  const authed = await lizardFetcher(fetchJson);
  const runs = await Promise.all(HAZARD_RUNS.map(async ({ area, run }) => {
    const list = await authed(`${LIZARD_API}/rasters/?name__icontains=${encodeURIComponent(run)}&page_size=50`);
    const named = (suffix) => (list.results || []).find((r) => r.name === `${run} ${suffix}`);
    const depth = named('Max water depth');
    const velocity = named('Max flow velocity');
    // The maxima are over the whole run: from its first step to its last.
    const from = Date.parse(named('Water depth (timeseries)')?.first_value_timestamp);
    const until = Date.parse(depth?.last_value_timestamp);
    const available = !!(depth && velocity && depth.spatial_bounds && Number.isFinite(until) && until > now);
    return {
      area,
      available,
      forecastFrom: Number.isFinite(from) ? new Date(from).toISOString() : null,
      forecastUntil: Number.isFinite(until) ? new Date(until).toISOString() : null,
      runUpdatedAt: depth?.last_modified || null,
      depth,
      velocity,
    };
  }));
  const live = runs.filter((r) => r.available);
  const summary = runs.map(({ area, available, forecastFrom, forecastUntil, runUpdatedAt }) => ({ area, available, forecastFrom, forecastUntil, runUpdatedAt }));
  const properties = { runs: summary, minDepth: MIN_DEPTH, cellMetres: HAZARD_CELL_METRES, method: 'AIDR Guideline 7-3, Table 2' };
  if (!live.length) return [{ type: 'Feature', geometry: null, properties: { ...properties, grid: null } }];

  const b = live.map((r) => r.depth.spatial_bounds);
  const union = {
    west: Math.min(...b.map((x) => x.west)), east: Math.max(...b.map((x) => x.east)),
    south: Math.min(...b.map((x) => x.south)), north: Math.max(...b.map((x) => x.north)),
  };
  const grid = makeGrid(union, HAZARD_CELL_METRES);
  const data = (raster, w) => authed(
    `${LIZARD_API}/rasters/${raster.uuid}/data/?bbox=${w.bbox.join(',')}&width=${w.width}&height=${w.height}`,
    { timeoutMs: RASTER_TIMEOUT_MS },
  ).then((bands) => bands?.[0] || []);
  const areas = await Promise.all(live.map(async (r) => {
    const w = grid.window(r.depth.spatial_bounds);
    const [depth, velocity] = await Promise.all([data(r.depth, w), data(r.velocity, w)]);
    return { window: w, depth, velocity };
  }));
  return [{
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[[union.west, union.south], [union.east, union.south], [union.east, union.north], [union.west, union.north], [union.west, union.south]]],
    },
    properties: { ...properties, grid: encodeHazardGrid(grid, combineHazard(grid, areas)) },
  }];
}

// "Marsden Weir (Parramatta River CBD Warning Area) [3.741 mAHD]" -> the
// name without the gauge datum. The datums in the names don't all match
// the readings, so they're dropped rather than passed on.
export function gaugeName(name) {
  return String(name || '').replace(/\s*\[[^\]]*mAHD\]\s*$/i, '').trim() || 'Gauge';
}

/**
 * Water-level timeseries + their locations -> one point per gauge with its
 * latest reading. Drops series without a value or a position, and modelled
 * series whose last value is in the future.
 */
export function waterLevelFeatures(timeseries, locations, now = Date.now()) {
  const byUuid = new Map(locations.map((l) => [l.uuid, l]));
  const features = [];
  for (const ts of timeseries) {
    const value = Number(ts.last_value);
    const at = Date.parse(ts.end);
    const coords = byUuid.get(ts.location?.uuid)?.geometry?.coordinates;
    if (ts.last_value == null || !Number.isFinite(value) || !Number.isFinite(at)) continue;
    if (at > now + FUTURE_SLACK_MS) continue;
    if (!Array.isArray(coords) || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [coords[0], coords[1]] },
      properties: {
        id: ts.uuid,
        name: gaugeName(ts.location.name),
        value,
        unit: ts.observation_type?.unit || 'm',
        datum: 'AHD',
        observedAt: new Date(at).toISOString(),
      },
    });
  }
  return features;
}

export const parramatta = {
  name: 'City of Parramatta',
  system: 'FloodSmart',
  datasets: {
    'warning-areas': {
      ttlSeconds: 10 * 60, // the flood model forecast reruns about every 10 minutes
      load: loadWarningAreas,
    },
    'catchment-rainfall': catchmentRainfallDataset('floodsmart:parramatta_catchments_2701_since9am', [
      'since9am', 'last1hr', 'last3hr', 'last6hr', 'last12hr', 'last24hr', 'last48hr', 'max6hr',
      'next3hr', 'next6hr', 'next12hr', 'next24hr', 'next48hr', 'next72hr',
    ]),
    'flood-impacts': {
      ttlSeconds: 10 * 60, // set from the 12-hour run, which reruns about every 10 minutes
      load: loadImpacts,
    },
    'flood-hazard': {
      ttlSeconds: 15 * 60, // the forecast runs are republished every few hours (about 3 seen)
      load: loadFloodHazard,
    },
    'water-levels': {
      ttlSeconds: 120, // gauges report every 5 minutes
      load: async (fetchJson, now) => {
        const [timeseries, locations] = await Promise.all([
          lizardList(
            `${LIZARD_API}/timeseries/?location__organisation__uuid=${ORGANISATION}` +
              `&observation_type__code=${encodeURIComponent(WATER_LEVEL_CODE)}&page_size=200`,
            fetchJson,
          ),
          lizardList(`${LIZARD_API}/locations/?organisation__uuid=${ORGANISATION}&page_size=200`, fetchJson),
        ]);
        return waterLevelFeatures(timeseries, locations, now);
      },
    },
  },
};
