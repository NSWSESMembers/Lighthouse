import { describe, it, expect } from 'vitest';
import { gaugeName, warningAreaFeatures, alarmForecast, impactFeatures, impactType, waterLevelFeatures, parramatta } from './parramatta.mjs';
import { catchmentRainfallFeatures, RAINFALL_FIELDS } from './floodsmart.mjs';
import { COUNCILS } from './councils.mjs';
import { lizardAuthHeaders, resetSecretsCache } from './secrets.mjs';
import { handler, parsePath, refresh } from './index.mjs';
import { simplifyGeometry } from './geometry.mjs';
import { hazardCategory, makeGrid, combineHazard, encodeHazardGrid } from './hazard.mjs';

const NOW = Date.parse('2026-10-15T00:00:00Z');

const loc = (uuid, lng, lat) => ({ uuid, geometry: { type: 'Point', coordinates: [lng, lat, 0] } });
const series = (uuid, locUuid, name, last_value, end) => ({
  uuid,
  last_value,
  end,
  observation_type: { unit: 'm' },
  location: { uuid: locUuid, name },
});

describe('parsePath', () => {
  it('reads the council and dataset', () => {
    expect(parsePath('/lad_v2/council/parramatta/water-levels')).toEqual({ council: 'parramatta', dataset: 'water-levels' });
    expect(parsePath('/lad_v2/council/parramatta/water-levels/')).toEqual({ council: 'parramatta', dataset: 'water-levels' });
    expect(parsePath('/lad_v2/council/parramatta')).toBeNull();
    expect(parsePath('/lad_v2/council/a/b/c')).toBeNull();
    expect(parsePath('/lad_v2/council/../x/y')).toBeNull();
  });
});

describe('handler', () => {
  it('404s an unknown council or dataset without fetching', async () => {
    for (const rawPath of [
      '/lad_v2/council/nowhere/water-levels', '/lad_v2/council/parramatta/rainfall', '/lad_v2/council/parramatta/toString',
    ]) {
      const res = await handler({ rawPath, requestContext: { http: { method: 'GET' } } });
      expect(res.statusCode).toBe(404);
    }
  });
});

describe('refresh', () => {
  const dataset = { ttlSeconds: 60, load: async (fetchJson) => (await fetchJson('https://example.test/a')).features };
  const okFetch = async () => ({ ok: true, json: async () => ({ features: [{ id: 1 }] }) });
  const badFetch = async () => ({ ok: false, status: 503 });

  it('returns the features', async () => {
    const s = await refresh(dataset, null, { fetchImpl: okFetch, now: NOW });
    expect(s).toMatchObject({ ok: true, error: null, features: [{ id: 1 }], lastGoodAt: new Date(NOW).toISOString() });
  });

  it('keeps the last good features when the source fails', async () => {
    const previous = { ok: true, lastGoodAt: '2026-10-14T23:00:00.000Z', features: [{ id: 'old' }] };
    const s = await refresh(dataset, previous, { fetchImpl: badFetch, now: NOW });
    expect(s).toMatchObject({ ok: false, error: 'HTTP 503', lastGoodAt: previous.lastGoodAt, features: [{ id: 'old' }] });
  });
});

describe('Parramatta', () => {
  it('drops the gauge datum from names', () => {
    expect(gaugeName('Example Weir (Sample Creek Warning Area) [3.5 mAHD]')).toBe('Example Weir (Sample Creek Warning Area)');
    expect(gaugeName('Example Basin [?.?? mAHD]')).toBe('Example Basin');
    expect(gaugeName('Plain Creek')).toBe('Plain Creek');
    expect(gaugeName('')).toBe('Gauge');
  });

  describe('warning area forecasts (next 5 hours)', () => {
    const square = (x, y) => ({ type: 'Polygon', coordinates: [[[x, y], [x + 0.01, y], [x + 0.01, y + 0.01], [x, y + 0.01], [x, y]]] });
    const areas = { features: [
      { geometry: square(151, -33.8), properties: { name: '6 Sample CBD WA', Descript: 'Properties near Sample River.' } },
      { geometry: square(151.02, -33.8), properties: { name: 'Example Creek', Descript: '' } },
      { geometry: null, properties: { name: 'No shape' } },
    ] };
    const levels = [
      { value: 8.8, warning_level: 'Major' }, { value: 2.5, warning_level: 'Public Information Message' },
      { value: 3.5, warning_level: 'minor' }, { value: 7.3, warning_level: 'Moderate' },
    ];
    const alarm = (uuid, x, y, thresholds = levels) => ({ uuid, active: true, comparison: '>', geometry: { type: 'Point', coordinates: [x, y, 0] }, thresholds });
    const at = (h) => new Date(NOW + h * 3600 * 1000).toISOString();
    // Forecast water level: rising to `peak` at `peakH` hours ahead, then falling
    const series = (peak, peakH, until = at(11)) => ({
      until,
      points: Array.from({ length: 67 }, (_, k) => k / 6).map((h) => ({ time: at(h), value: 1 + (peak - 1) * Math.max(0, 1 - Math.abs(h - peakH) / 4) })),
    });

    it('gives the highest level the forecast goes above in the next 5 hours, and when', () => {
      const seriesOf = new Map([['a1', series(4.2, 3)], ['a2', series(2.0, 2)]]);
      const [cbd, creek, ...rest] = warningAreaFeatures(areas, [alarm('a1', 151.005, -33.795), alarm('a2', 151.025, -33.795)], seriesOf, NOW);
      expect(rest).toEqual([]);
      expect(cbd.properties.name).toBe('Sample CBD');
      const f = cbd.properties.forecast;
      expect(f).toMatchObject({ status: 'minor', hours: 5, from: at(0), to: at(5), value: 4.2, peakAt: at(3), thresholdValue: 3.5 });
      expect(Date.parse(f.expectedAt)).toBeGreaterThan(NOW);
      expect(Date.parse(f.expectedAt)).toBeLessThan(Date.parse(f.peakAt));
      expect(f.thresholds.map((t) => t.level)).toEqual(['pim', 'minor', 'moderate', 'major']);
      expect(creek.properties.forecast).toMatchObject({ status: 'clear', value: 2.0 });
    });

    it('ignores anything forecast after 5 hours', () => {
      const [cbd] = warningAreaFeatures(areas, [alarm('a1', 151.005, -33.795)], new Map([['a1', series(9.5, 8)]]), NOW);
      expect(cbd.properties.forecast.status).toBe('pim'); // only the rise before 5 h counts (about 3.1 m by then: above PIM, under Minor)
    });

    it('stops at the end of the forecast if it is under 5 hours, and is unknown with no current forecast', () => {
      const short = alarmForecast(alarm('a1', 0, 0), series(4.2, 3, at(2)), NOW);
      expect(short.to).toBe(at(2));
      expect(alarmForecast(alarm('a1', 0, 0), series(4.2, 3, at(-1)), NOW)).toMatchObject({ status: 'unknown', to: null });
      expect(alarmForecast(alarm('a1', 0, 0), undefined, NOW).status).toBe('unknown');
      expect(alarmForecast(alarm('a1', 0, 0), { until: at(11), points: [] }, NOW).status).toBe('unknown');
    });

    it('ignores dam alarms, and areas without an alarm have none', () => {
      const dam = alarm('d', 151.005, -33.795, [{ value: 30, warning_level: 'Red' }, { value: 29, warning_level: 'White' }]);
      const [cbd, creek] = warningAreaFeatures(areas, [dam], new Map([['d', series(40, 1)]]), NOW);
      expect(cbd.properties.forecast).toEqual({ status: 'none' });
      expect(creek.properties.forecast).toEqual({ status: 'none' });
    });
  });

  it('turns catchments into polygons with every rainfall total', () => {
    const poly = { type: 'Polygon', coordinates: [[[151, -33.8], [151.01, -33.8], [151.01, -33.79], [151, -33.8]]] };
    const props = Object.fromEntries(Object.values(RAINFALL_FIELDS).map((field, i) => [field, i * 1.5]));
    const keys = ['since9am', 'last1hr', 'max6hr', 'next3hr', 'next72hr'];
    const [f, ...rest] = catchmentRainfallFeatures({ features: [
      { geometry: poly, properties: { ...props, name: 'Sample Ck ', ner_f_72hr: null, anchorpointgeom: { type: 'Point', coordinates: [151.005, -33.795] } } },
      { geometry: null, properties: { name: 'No shape' } },
    ] }, keys);
    expect(rest).toEqual([]);
    expect(f.properties.name).toBe('Sample Ck');
    expect(f.properties.anchor).toEqual([151.005, -33.795]);
    expect(f.properties.totals).toEqual({ since9am: 0, last1hr: 1.5, max6hr: 13.5, next3hr: 18, next72hr: null });
  });

  it('joins water levels to their gauge locations', () => {
    const [f] = waterLevelFeatures([series('t1', 'l1', 'Alpha Creek [1.0 mAHD]', 2.5, '2026-10-14T23:55:00Z')], [loc('l1', 151.0, -33.8)], NOW);
    expect(f).toEqual({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [151.0, -33.8] },
      properties: { id: 't1', name: 'Alpha Creek', value: 2.5, unit: 'm', datum: 'AHD', observedAt: '2026-10-14T23:55:00.000Z' },
    });
  });

  it('drops modelled water levels in the future, and ones without a value or position', () => {
    const locations = [loc('l2', 151.1, -33.7), { uuid: 'l3', geometry: null }];
    const out = waterLevelFeatures(
      [
        series('future', 'l2', 'Beta', 0.4, '2026-10-15T06:00:00Z'),
        series('noValue', 'l2', 'Beta', null, '2026-10-14T23:55:00Z'),
        series('noGeom', 'l3', 'Gamma', 1.2, '2026-10-14T23:55:00Z'),
        series('noLoc', 'missing', 'Delta', 1.2, '2026-10-14T23:55:00Z'),
        series('ok', 'l2', 'Beta', 0, '2026-10-14T23:55:00Z'),
      ],
      locations,
      NOW,
    );
    expect(out.map((f) => f.properties.id)).toEqual(['ok']);
  });

  it('follows Lizard API pages', async () => {
    const pages = {
      timeseries: [
        { results: [series('t1', 'l1', 'Alpha', 1, '2026-10-14T23:55:00Z')], next: 'https://lizard.test/ts2' },
        { results: [series('t2', 'l1', 'Alpha 2', 2, '2026-10-14T23:55:00Z')], next: null },
      ],
    };
    const fetchJson = async (url) => {
      if (url.includes('/timeseries/')) return pages.timeseries[0];
      if (url === 'https://lizard.test/ts2') return pages.timeseries[1];
      return { results: [loc('l1', 151, -33.8)], next: null };
    };
    const out = await parramatta.datasets['water-levels'].load(fetchJson, NOW);
    expect(out.map((f) => f.properties.id)).toEqual(['t1', 't2']);
  });
});

describe('simplifyGeometry', () => {
  it('drops points within the tolerance of a straight edge and rounds coordinates', () => {
    const edge = Array.from({ length: 101 }, (_, i) => [151 + i * 0.000001, -33.8 + (i % 2) * 0.0000001]);
    const ring = [...edge, [151.0001, -33.79], [151, -33.79], [151, -33.8]];
    const out = simplifyGeometry({ type: 'Polygon', coordinates: [ring] });
    expect(out.coordinates[0]).toEqual([[151, -33.8], [151.0001, -33.8], [151.0001, -33.79], [151, -33.79], [151, -33.8]]);
  });

  it('keeps detail bigger than the tolerance', () => {
    const notch = [[151, -33.8], [151.0005, -33.8], [151.0005, -33.7995], [151.001, -33.8], [151.001, -33.79], [151, -33.8]];
    expect(simplifyGeometry({ type: 'Polygon', coordinates: [notch] }).coordinates[0]).toHaveLength(6);
  });

  it('drops collapsed parts of a MultiPolygon and passes other geometry through', () => {
    const tiny = [[151, -33.8], [151.000001, -33.8], [151, -33.800001], [151, -33.8]];
    const square = [[151, -33.8], [151.001, -33.8], [151.001, -33.799], [151, -33.799], [151, -33.8]];
    expect(simplifyGeometry({ type: 'MultiPolygon', coordinates: [[tiny], [square]] }).coordinates).toEqual([[square]]);
    const point = { type: 'Point', coordinates: [151, -33.8] };
    expect(simplifyGeometry(point)).toBe(point);
  });
});

describe('councils', () => {
  it('asks each FloodSmart catchments table only for columns we know', async () => {
    for (const [name, council] of Object.entries(COUNCILS)) {
      const ds = council.datasets['catchment-rainfall'];
      if (!ds) continue;
      let url;
      await ds.load(async (u) => { url = new URL(u); return { features: [] }; });
      const cols = url.searchParams.get('propertyName').split(',').slice(3);
      expect(cols.length, name).toBeGreaterThan(0);
      expect(cols.every((c) => Object.values(RAINFALL_FIELDS).includes(c)), name).toBe(true);
      expect(url.searchParams.get('typeName'), name).toBe(`floodsmart:${name}_catchments_2701_since9am`);
    }
  });
});

describe('lizardAuthHeaders', () => {
  it('uses the key for that portal only, as HTTP Basic with __key__', async () => {
    resetSecretsCache();
    const load = async () => ({ 'a.lizard.test': 'k1' });
    expect(await lizardAuthHeaders('a.lizard.test', { load, now: 1 })).toEqual({ authorization: `Basic ${Buffer.from('__key__:k1').toString('base64')}` });
    await expect(lizardAuthHeaders('b.lizard.test', { load, now: 2 })).rejects.toThrow('No Lizard key for b.lizard.test');
    resetSecretsCache();
  });
});

describe('flood hazard (AIDR Guideline 7-3, Table 2)', () => {
  it('puts depth/velocity pairs in the lowest category whose limits they are within', () => {
    expect(hazardCategory(0, 1)).toBe(0); // dry
    expect(hazardCategory(0.01, 0)).toBe(0); // under MIN_DEPTH
    expect(hazardCategory(0.3, 1.0)).toBe(1); // D 0.3, V 1, DV 0.3
    expect(hazardCategory(0.3, 1.1)).toBe(2); // DV 0.33 > 0.3
    expect(hazardCategory(0.5, 0.5)).toBe(2);
    expect(hazardCategory(0.6, 0.5)).toBe(3); // D > 0.5
    expect(hazardCategory(1.2, 0.5)).toBe(3); // DV 0.6
    expect(hazardCategory(1.2, 0.6)).toBe(4); // DV 0.72 > 0.6
    expect(hazardCategory(2.0, 0.5)).toBe(4); // DV 1.0
    expect(hazardCategory(2.1, 0.1)).toBe(5); // D > 2.0
    expect(hazardCategory(4.0, 1.0)).toBe(5); // DV 4.0
    expect(hazardCategory(4.1, 0)).toBe(6); // D > 4.0
    expect(hazardCategory(1.5, 3.0)).toBe(6); // DV 4.5 > 4.0
  });

  it('treats shallow fast water by velocity, and a missing velocity as still water', () => {
    expect(hazardCategory(0.05, 2.5)).toBe(5); // V > 2.0 for H1-H4
    expect(hazardCategory(0.05, 4.5)).toBe(6); // V > 4.0
    expect(hazardCategory(0.4, null)).toBe(2);
  });

  it('lines model areas up on one grid and keeps the higher hazard where they overlap', () => {
    const grid = makeGrid({ west: 151, east: 151.001, south: -33.801, north: -33.8 }, 25);
    expect(grid.width).toBe(4); // ~92.6 m wide at this latitude: 3.7 cells, rounded up
    expect(grid.height).toBe(5); // ~110.6 m tall: 4.4 cells
    const w = grid.window({ west: 151, east: 151.001, south: -33.801, north: -33.8 });
    expect(w).toMatchObject({ col: 0, row: 0, width: 4, height: 5 });
    const east = grid.window({ west: 151.0006, east: 151.001, south: -33.801, north: -33.8 });
    expect(east).toMatchObject({ col: 2, width: 2 }); // 0.0006 deg = 2.2 cells in
    const rows = (v) => Array.from({ length: 5 }, () => Array(5).fill(v));
    const a = { window: w, depth: rows(0.4), velocity: rows(0.5) }; // H2
    const b = { window: east, depth: rows(1.0), velocity: rows(0.5) }; // H3
    const out = combineHazard(grid, [a, b]);
    expect([...out.hazard.slice(0, 4)]).toEqual([2, 2, 3, 3]);
    expect(out.depth[3]).toBe(100);
    expect(out.velocity[3]).toBe(50);
    const enc = encodeHazardGrid(grid, out);
    expect([...Buffer.from(enc.hazard, 'base64')].slice(0, 4)).toEqual([2, 2, 3, 3]);
    expect(new Uint16Array(new Uint8Array(Buffer.from(enc.depth, 'base64')).buffer)[3]).toBe(100);
  });
});

describe('flood impacts', () => {
  const at = (h) => new Date(NOW + h * 3600 * 1000).toISOString();
  const asset = (name, component, status, model_id = 'M3', trigger_le = 0.1) => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [151, -33.8] },
    properties: { name, component, status, model_id, trigger_le },
  });
  const runs = { M3: { area: 'North', from: at(-2), until: at(10) }, M4: { area: 'South', from: at(-14), until: at(-1) } };

  it('gives flooded / not flooded from the council status, with the run window', () => {
    const out = impactFeatures({ features: [
      asset('Sample Bridge', 'road', 'road_flooded'),
      asset('Example Hospital', 'healthcare', 'healthcare_not_flooded'),
      asset('Odd', 'road', 'something_else'),
    ] }, runs, NOW);
    expect(out.map((f) => f.properties.status)).toEqual(['flooded', 'not_flooded', 'unknown']);
    expect(out[0].properties).toEqual({ name: 'Sample Bridge', type: 'Road or crossing', area: 'North', status: 'flooded', forecastFrom: at(-2), forecastUntil: at(10) });
  });

  it('is unknown when its 12-hour run has stopped or is missing, and leaves out assets with no trigger', () => {
    const out = impactFeatures({ features: [
      asset('South Rd', 'road', 'road_not_flooded', 'M4'),
      asset('Nowhere Rd', 'road', 'road_not_flooded', 'M9'),
      asset('Switched off', 'house', 'house_not_flooded', 'M3', 9999),
    ] }, runs, NOW);
    expect(out.map((f) => [f.properties.name, f.properties.status, f.properties.forecastUntil])).toEqual([['South Rd', 'unknown', null], ['Nowhere Rd', 'unknown', null]]);
  });

  it('names the asset types, calling the levee points levees', () => {
    expect(impactType('forest', 'Sample Pde Levee U/S')).toBe('Levee');
    expect(impactType('forest', 'Bush Reserve')).toBe('Bushland');
    expect(impactType('historical_landmark', 'x')).toBe('Historical landmark');
  });
});
