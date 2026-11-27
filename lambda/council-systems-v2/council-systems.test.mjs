import { describe, it, expect } from 'vitest';
import { gaugeName, warningAreaFeatures, alarmForecast, impactFeatures, impactType, waterLevelFeatures, parramatta } from './parramatta.mjs';
import { catchmentRainfallFeatures, RAINFALL_FIELDS } from './floodsmart.mjs';
import { COUNCILS } from './councils.mjs';
import { lizardAuthHeaders, resetSecretsCache } from './secrets.mjs';
import { handler, parsePath, refresh } from './index.mjs';
import { simplifyGeometry } from './geometry.mjs';
import { hazardCategory, makeGrid, combineHazard, encodeHazardGrid } from './hazard.mjs';
import { imageTime, latestImage, tweed } from './tweed.mjs';
import { latestMhlImage, clarence } from './clarence.mjs';
import { webcamIoImage, bellingen } from './bellingen.mjs';
import { lastModifiedTime, coffsharbour } from './coffsharbour.mjs';
import { newestSegment, cropFirstFrame, liveStill } from './videostill.mjs';
import { spawnSync } from 'node:child_process';

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
    expect(parsePath('/lad_v2/council/tweed/flood-cameras/oaksave')).toEqual({ council: 'tweed', dataset: 'flood-cameras', item: 'oaksave' });
    expect(parsePath('/lad_v2/council/parramatta')).toBeNull();
    expect(parsePath('/lad_v2/council/a/b/c/d')).toBeNull();
    expect(parsePath('/lad_v2/council/../x/y')).toBeNull();
  });
});

describe('handler', () => {
  it('404s an unknown council or dataset without fetching', async () => {
    for (const rawPath of [
      '/lad_v2/council/nowhere/water-levels', '/lad_v2/council/parramatta/rainfall', '/lad_v2/council/parramatta/toString',
      // an item of a dataset without items, an unknown camera
      '/lad_v2/council/parramatta/water-levels/x', '/lad_v2/council/tweed/flood-cameras/nowhere', '/lad_v2/council/tweed/flood-cameras/constructor',
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

// Every council camera list: from the module's own list, never fetched.
const NO_FETCH = { fetchText: async () => { throw new Error('fetched'); }, fetchHead: async () => { throw new Error('fetched'); } };
const cameraList = (council) => COUNCILS[council].datasets['flood-cameras'].load(NO_FETCH.fetchText, NOW, NO_FETCH);
const headers = (h) => ({ headers: new Headers(h) });

describe('council flood cameras', () => {
  it('list each council\'s cameras, with where to ask for the latest image', async () => {
    for (const [council, count] of [['tweed', 13], ['clarence', 9], ['bellingen', 6], ['coffsharbour', 1]]) {
      const features = await cameraList(council);
      expect(features).toHaveLength(count);
      const { item } = COUNCILS[council].datasets['flood-cameras'];
      for (const f of features) {
        const [lng, lat] = f.geometry.coordinates;
        expect(lat).toBeGreaterThan(-31);
        expect(lat).toBeLessThan(-28);
        expect(lng).toBeGreaterThan(152.4);
        expect(lng).toBeLessThan(153.7);
        expect(f.properties.latestPath).toBe(`${council}/flood-cameras/${f.properties.id}`);
        expect(parsePath(`/lad_v2/council/${f.properties.latestPath}`)).toMatchObject({ council, item: f.properties.id });
        expect(item.has(f.properties.id)).toBe(true);
      }
    }
  });
});

describe('Tweed flood cameras', () => {
  const PAGE = `<form><div class="container-fluid">
    <a id="btnViewLatestImage" href='/CameraImages.aspx?folder=samplecam&viewmode=latest'><img src='/Images/Icons/image.png' /></a>
    <img id="LatestImageViewer1_imgLatest" class="img-responsive" src="/ImageProxy.ashx?container=samplecam&amp;blob=SampleCam_XX123_20261124173038387_TIMING.jpg" style="border: none" />
    <span id="LatestImageViewer1_lblTimestamp">24 November 2026 5:30 pm</span></div></form>`;

  it("reads the image's Sydney time from its file name", () => {
    expect(imageTime('SampleCam_XX123_20261124173038387_TIMING.jpg')).toBe('2026-11-24T06:30:38.387Z'); // AEDT
    expect(imageTime('SampleCam_XX123_20260624173038000_TIMING.jpg')).toBe('2026-06-24T07:30:38.000Z'); // AEST
    expect(imageTime('SampleCam_XX123_20261004030000000_TIMING.jpg')).toBe('2026-10-03T16:00:00.000Z'); // just after DST starts
    expect(imageTime('SampleCam.jpg')).toBeNull();
    expect(imageTime(null)).toBeNull();
  });

  it('reads the latest image from a camera page', () => {
    expect(latestImage(PAGE, 'samplecam')).toEqual({
      imageUrl: 'https://floodcam.tweed.nsw.gov.au/ImageProxy.ashx?container=samplecam&blob=SampleCam_XX123_20261124173038387_TIMING.jpg',
      takenAt: '2026-11-24T06:30:38.387Z',
    });
  });

  it("refuses a page without its camera's image, or an image from somewhere else", () => {
    expect(() => latestImage('<html>Down for maintenance</html>', 'samplecam')).toThrow('No latest image');
    expect(() => latestImage(PAGE, 'othercam')).toThrow('No latest image');
    const elsewhere = PAGE.replace('src="/ImageProxy', 'src="https://example.test/ImageProxy');
    expect(() => latestImage(elsewhere, 'samplecam')).toThrow('No latest image');
  });

  it("serves one camera's latest image, fetching only that camera's page", async () => {
    const [{ properties: { id } }] = await cameraList('tweed');
    const seen = [];
    const html = PAGE.replaceAll('samplecam', id);
    const features = await tweed.datasets['flood-cameras'].item.load(id, { fetchText: async (url) => { seen.push(url); return html; } });
    expect(seen).toEqual([`https://floodcam.tweed.nsw.gov.au/flood-cameras/${id}`]);
    expect(features).toHaveLength(1);
    expect(features[0].properties).toMatchObject({ id, takenAt: '2026-11-24T06:30:38.387Z' });
    expect(features[0].properties.imageUrl).toContain(`container=${id}&`);
  });
});

describe('Clarence Valley flood cameras', () => {
  const MHL_PAGE = `<div class="frames">
    <img src="/s3/www/media/webcams/samplestn/20261124_16114064_samplestn.jpg">
    <img src="https://www.mhl.nsw.gov.au/s3/www/media/webcams/samplestn/20261124_17114068_samplestn.jpg">
    <img src="/s3/www/media/webcams/samplestn/20261124_15114064_samplestn.jpg"></div>`;

  it("reads MHL's newest image, its time AEST all year", () => {
    expect(latestMhlImage(MHL_PAGE, 'samplestn')).toEqual({
      imageUrl: 'https://www.mhl.nsw.gov.au/s3/www/media/webcams/samplestn/20261124_17114068_samplestn.jpg',
      takenAt: '2026-11-24T07:11:40.000Z', // 17:11 AEST, 18:11 AEDT
    });
    expect(() => latestMhlImage('<html></html>', 'samplestn')).toThrow('No image');
    expect(() => latestMhlImage(MHL_PAGE, 'otherstn')).toThrow('No image');
  });

  it("asks MHL for Grafton's latest image only", async () => {
    const seen = [];
    const html = MHL_PAGE.replaceAll('samplestn', 'grafton');
    const [f] = await clarence.datasets['flood-cameras'].item.load('princestreet', { fetchText: async (url) => { seen.push(url); return html; } });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('page=animation&n=1&');
    expect(seen[0]).toContain('stn=67726166746F6E'); // "grafton"
    expect(f.properties).toMatchObject({ id: 'princestreet', takenAt: '2026-11-24T07:11:40.000Z' });
  });

  it("serves Bluff Bridge's fixed latest-image URL without fetching", async () => {
    const [f] = await clarence.datasets['flood-cameras'].item.load('bluffbridge', NO_FETCH);
    expect(f.properties).toMatchObject({ id: 'bluffbridge', takenAt: null });
    expect(f.properties.imageUrl).toMatch(/^https:\/\/www\.envault\.com\.au\/api\?contentUrl=/);
  });
});

describe('stills cut from a live video', () => {
  const PLAYLIST_URL = 'http://192.0.2.10:5080/LiveApp/streams/samplegrid.m3u8';
  const PLAYLIST = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:25
#EXT-X-MEDIA-SEQUENCE:78407
#EXTINF:25.000000,
samplegrid000078407.ts
#EXTINF:24.500000,
samplegrid000078408.ts
`;
  // A 1920x1080 grid: black, with one grey "camera" where Sandy Crossing is.
  const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
  const video = hasFfmpeg
    ? spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=1920x1080:r=10:d=1',
      '-vf', 'drawbox=x=637:y=397:w=628:h=345:color=gray:t=fill', '-c:v', 'mpeg2video', '-f', 'mpegts', 'pipe:1'],
    { maxBuffer: 64 * 1024 * 1024 }).stdout
    : null;
  const LIVE = { x: 637, y: 397, w: 628, h: 345 };
  const BLANK = { x: 0, y: 0, w: 613, h: 314 };

  it("finds the playlist's newest segment, on its own server only", () => {
    expect(newestSegment(PLAYLIST, PLAYLIST_URL)).toEqual({ url: 'http://192.0.2.10:5080/LiveApp/streams/samplegrid000078408.ts', seconds: 24.5 });
    expect(() => newestSegment('#EXTM3U\n', PLAYLIST_URL)).toThrow('No video segment');
    expect(() => newestSegment(`${PLAYLIST}#EXTINF:25,\nhttp://example.test/x.ts\n`, PLAYLIST_URL)).toThrow('No video segment');
    expect(() => newestSegment(`${PLAYLIST}#EXTINF:25,\nother.m3u8\n`, PLAYLIST_URL)).toThrow('No video segment');
  });

  it.skipIf(!hasFfmpeg)("cuts a camera's box out of the first frame, with its brightness", async () => {
    const live = await cropFirstFrame(video, LIVE, { ffmpeg: 'ffmpeg' });
    expect(live.jpeg.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8])); // a JPEG
    expect(live.brightness).toBeGreaterThan(100);
    const blank = await cropFirstFrame(video, BLANK, { ffmpeg: 'ffmpeg' });
    expect(blank.brightness).toBeLessThan(8);
    await expect(cropFirstFrame(Buffer.from('not a video'), LIVE, { ffmpeg: 'ffmpeg' })).rejects.toThrow('No frame');
  });

  it.skipIf(!hasFfmpeg)('serves the still as a JPEG data URL, or a blank camera as offline, fetching only the start of a segment', async () => {
    const seen = [];
    const fetchers = {
      now: NOW,
      fetchText: async (url) => { seen.push(url); return PLAYLIST; },
      fetchBytes: async (url, { headers }) => { seen.push(`${url} ${headers.range}`); return video; },
    };
    const live = await liveStill(PLAYLIST_URL, LIVE, fetchers, { ffmpeg: 'ffmpeg' });
    expect(seen).toEqual([PLAYLIST_URL, 'http://192.0.2.10:5080/LiveApp/streams/samplegrid000078408.ts bytes=0-393215']);
    expect(live.imageUrl).toMatch(/^data:image\/jpeg;base64,\/9j\//);
    expect(live.takenAt).toBe(new Date(NOW - 24500).toISOString());
    expect(await liveStill(PLAYLIST_URL, BLANK, fetchers, { ffmpeg: 'ffmpeg' }))
      .toEqual({ imageUrl: null, takenAt: new Date(NOW - 24500).toISOString(), offline: true });
  });

  it("lists Clarence's grid cameras with the live video, without fetching", async () => {
    const features = await cameraList('clarence');
    const grid = features.filter((f) => f.properties.liveUrl);
    expect(grid.map((f) => f.properties.id)).toEqual(['harwood', 'lilydale', 'palmersisland', 'rogans', 'sandycrossing', 'maclean', 'boothbys']);
    for (const f of grid) expect(f.properties.liveUrl).toMatch(/^http:\/\/180\.150\.8\.170:5080\/LiveApp\/play\.html\?name=/);
    // Only Palmer's Island (off) has no bearing yet, so only it is approximate.
    expect(features.filter((f) => f.properties.approximate).map((f) => f.properties.id)).toEqual(['palmersisland']);
    expect(features.find((f) => f.properties.id === 'rogans').properties).toMatchObject({ bearing: 31.83, fov: null });
  });
});

describe('Bellingen bridge flood cameras', () => {
  it("reads webcam.io's latest-image redirect, its time UTC", () => {
    expect(webcamIoImage('https://assets11.webcam.io/w11/AbC123/20261124/074157-5781b1.jpg', 'AbC123')).toEqual({
      imageUrl: 'https://assets11.webcam.io/w11/AbC123/20261124/074157-5781b1.jpg',
      takenAt: '2026-11-24T07:41:57.000Z',
    });
    expect(() => webcamIoImage(null, 'AbC123')).toThrow('No latest image');
    expect(() => webcamIoImage('https://assets11.webcam.io/w11/Other1/20261124/074157-5781b1.jpg', 'AbC123')).toThrow('No latest image');
    expect(() => webcamIoImage('https://example.test/w11/AbC123/20261124/074157-5781b1.jpg', 'AbC123')).toThrow('No latest image');
  });

  it('asks webcam.io where the latest image is, without downloading it', async () => {
    const seen = [];
    const fetchHead = async (url) => { seen.push(url); return headers({ location: 'https://assets11.webcam.io/w11/z71j19/20261124/074157-5781b1.jpg' }); };
    const [f] = await bellingen.datasets['flood-cameras'].item.load('lavenders', { fetchHead });
    expect(seen).toEqual(['https://webcam.io/webcams/z71j19/latest.jpg']);
    expect(f.properties).toMatchObject({ id: 'lavenders', takenAt: '2026-11-24T07:41:57.000Z', timelapseUrl: 'https://webcam.io/webcams/z71j19' });
  });

  it('lists which way each camera looks, for the map', async () => {
    const features = await cameraList('bellingen');
    for (const f of features) {
      expect(f.properties.bearing).toBeGreaterThanOrEqual(0);
      expect(f.properties.bearing).toBeLessThan(360);
      expect(f.properties.approximate).toBeUndefined();
    }
    expect(features.find((f) => f.properties.id === 'lavenders').properties).toMatchObject({ bearing: 50, fov: null });
  });
});

describe('Coffs Harbour bridge cameras', () => {
  it("reads the image's time from its Last-Modified", async () => {
    expect(lastModifiedTime('Tue, 24 Nov 2026 07:41:26 GMT')).toBe('2026-11-24T07:41:26.000Z');
    expect(lastModifiedTime(null)).toBeNull();
    const fetchHead = async () => headers({ 'last-modified': 'Tue, 24 Nov 2026 07:41:26 GMT' });
    const [f] = await coffsharbour.datasets['flood-cameras'].item.load('edwardsharp', { fetchHead });
    expect(f.properties).toMatchObject({ id: 'edwardsharp', takenAt: '2026-11-24T07:41:26.000Z' });
    expect(f.properties.imageUrl).toMatch(/^https:\/\/public\.disasterwatch-iotp\.com\.au\//);
  });
});
