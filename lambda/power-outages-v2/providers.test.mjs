import { gunzipSync } from 'node:zlib';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseAusgrid,
  parseEndeavour,
  parseEssential,
  sydneyDateToIso,
  humaniseStatus,
  isRelevant,
} from './providers.mjs';
import { handler, refresh, toResponseBody } from './index.mjs';

// Shapes copied from each company's feed (November 2026); every value is invented.

const ausgridSample = [
  {
    EventId: 900001,
    OutageDisplayType: 'U',
    PowerStatus: 'InProgress',
    Cause: 'Fallen tree on powerlines',
    Reason: null,
    Area: ['Demoville', 'Demoville'],
    WhenUpdated: '2026-11-09T08:00:00Z',
    StartDateTime: '2026-11-09T07:30:00Z',
    EstRestTime: '2026-11-09T12:00:00Z',
    MarkerLocation: { lat: -33.123456, lng: 151.654321 },
    Bounds: { bottomleftlat: -33.13, bottomleftlng: 151.64, toprightlat: -33.11, toprightlng: 151.66 },
    StreetsAffected: ['Example St', 'Sample Rd'],
    AffectedCustomers: 42,
  },
  {
    EventId: 900002,
    OutageDisplayType: 'P',
    PowerStatus: 'ProceedingAsScheduled',
    Cause: 'Replacing a power pole',
    Area: ['Testford'],
    StartDateTime: '2026-11-10T21:00:00Z',
    EstRestTime: '2026-11-11T05:00:00Z',
    MarkerLocation: { lat: -33.2, lng: 151.5 },
    StreetsAffected: [],
    AffectedCustomers: 10,
  },
  { EventId: 900003, OutageDisplayType: 'P', PowerStatus: 'Cancelled', MarkerLocation: { lat: -33.3, lng: 151.4 } },
  { EventId: 900004, OutageDisplayType: 'U', PowerStatus: 'Restored', MarkerLocation: { lat: -33.3, lng: 151.4 } },
  { EventId: 900005, OutageDisplayType: 'U', PowerStatus: 'InProgress', MarkerLocation: null },
];

const square = (lng, lat, d = 0.01) => [[
  [lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat],
]];

const endeavourSample = {
  areas: [
    {
      incident_id: 'SP 0000000001',
      outage_type: 'UNPLANNED',
      incident_status: 'DESPATCHED',
      customers_affected: 120,
      center_lat: -33.81234567,
      center_lng: 150.91234567,
      polygon_geojson: { type: 'Polygon', coordinates: square(150.91, -33.81) },
      start_date_time: '2026-11-09T06:00:00+00:00',
      end_date_time: '2026-11-09T10:00:00+00:00',
      etr: '2026-11-09 10:00:00+00',
      cause: 'Equipment fault',
      cityname: 'EXAMPLETON',
      cityname_list: ['EXAMPLETON', 'SAMPLE PARK'],
      postcode: '2999',
      street_name: '1 PRIVATE ST',
      materialized_at: '2026-11-09T08:50:00+00:00',
    },
  ],
  singlePremise: [
    { incident_id: 'MMJ 000001', outage_type: 'SINGLE_PREMISE', x: 150.9, y: -33.8, street_name: '2 PRIVATE ST' },
  ],
};

const essentialSample = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.1">
<Document>
<Placemark id="INCD-000001-r">
<Snippet><![CDATA[INCD-000001-r]]></Snippet>
<styleUrl>#sw_1_normal_unplanned</styleUrl>
<description><![CDATA[<h2>INCD-000001-r</h2><div style="overflow: hidden;"><div><span>Time Off:</span>06/11/2026 08:39:51</div><div><span>Est. Time On:</span></div></div><div><span>No. of Customers affected:</span>3</div><div><span>Reason:</span>Damaged equipment</div><div><span>Last Updated:</span>09/11/2026 13:17:08</div>]]></description><MultiGeometry>
<Polygon id="a"><outerBoundaryIs><LinearRing><coordinates>
151.60,-31.00 151.61,-31.00 151.61,-31.01 151.60,-31.01 151.60,-31.00</coordinates></LinearRing></outerBoundaryIs></Polygon>
<Point id="cp_a"><coordinates>
151.605,-31.005</coordinates></Point>
</MultiGeometry>
</Placemark>
<Placemark id="INCD-000002-r">
<styleUrl>#sw_2_normal_planned</styleUrl>
<description><![CDATA[<div><span>Time Off:</span>15/07/2026 09:00:00</div><div><span>Est. Time On:</span>15/07/2026 15:30:00</div><div><span>No. of Customers affected:</span>12</div><div><span>Reason:</span>General network maintenance</div>]]></description><MultiGeometry>
<Polygon id="b"><outerBoundaryIs><LinearRing><coordinates>153.20,-28.80 153.21,-28.80 153.21,-28.81 153.20,-28.81 153.20,-28.80</coordinates></LinearRing></outerBoundaryIs></Polygon>
<Polygon id="c"><outerBoundaryIs><LinearRing><coordinates>153.30,-28.80 153.31,-28.80 153.31,-28.81 153.30,-28.81 153.30,-28.80</coordinates></LinearRing></outerBoundaryIs></Polygon>
</MultiGeometry>
</Placemark>
</Document>
</kml>`;

describe('parseAusgrid', () => {
  const out = parseAusgrid(ausgridSample);

  it('drops finished outages and ones with no location', () => {
    expect(out.map((f) => f.properties.id)).toEqual(['900001', '900002']);
  });

  it('normalises an unplanned outage to a point', () => {
    expect(out[0]).toEqual({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [151.65432, -33.12346] },
      properties: {
        provider: 'ausgrid',
        id: '900001',
        type: 'unplanned',
        status: 'In progress',
        customers: 42,
        cause: 'Fallen tree on powerlines',
        suburbs: 'Demoville',
        streets: 'Example St, Sample Rd',
        start: '2026-11-09T07:30:00.000Z',
        estRestore: '2026-11-09T12:00:00.000Z',
        updated: '2026-11-09T08:00:00.000Z',
        lat: -33.12346,
        lng: 151.65432,
      },
    });
    expect(out[1].properties.type).toBe('planned');
  });

  it('rejects an unexpected shape', () => {
    expect(() => parseAusgrid({ error: 'nope' })).toThrow(/Ausgrid/);
  });
});

describe('parseEndeavour', () => {
  const out = parseEndeavour(endeavourSample);

  it('uses only outage areas, never single premises', () => {
    expect(out).toHaveLength(1);
    expect(JSON.stringify(out)).not.toMatch(/PRIVATE ST/);
  });

  it('keeps the outage polygon and centre', () => {
    const f = out[0];
    expect(f.geometry.type).toBe('Polygon');
    expect(f.geometry.coordinates[0][0]).toEqual([150.91, -33.81]);
    expect(f.properties).toMatchObject({
      provider: 'endeavour',
      id: 'SP 0000000001',
      type: 'unplanned',
      status: 'Despatched',
      customers: 120,
      suburbs: 'EXAMPLETON, SAMPLE PARK',
      streets: '',
      start: '2026-11-09T06:00:00.000Z',
      estRestore: '2026-11-09T10:00:00.000Z',
      lat: -33.81235,
      lng: 150.91235,
    });
  });

  it('rejects the web page the old URL now redirects to', () => {
    expect(() => parseEndeavour([])).toThrow(/Endeavour/);
  });
});

describe('parseEssential', () => {
  const out = parseEssential(essentialSample);

  it('reads each placemark', () => {
    expect(out.map((f) => [f.properties.id, f.properties.type])).toEqual([
      ['INCD-000001-r', 'unplanned'],
      ['INCD-000002-r', 'planned'],
    ]);
  });

  it('reads the description fields, converting Sydney time', () => {
    expect(out[0].properties).toMatchObject({
      customers: 3,
      cause: 'Damaged equipment',
      start: '2026-11-05T21:39:51.000Z', // AEDT, UTC+11
      estRestore: null,
      updated: '2026-11-09T02:17:08.000Z',
      lat: -31.005,
      lng: 151.605,
    });
    expect(out[1].properties.start).toBe('2026-07-14T23:00:00.000Z'); // AEST, UTC+10
  });

  it('keeps one area as a Polygon and several as a MultiPolygon', () => {
    expect(out[0].geometry.type).toBe('Polygon');
    expect(out[1].geometry.type).toBe('MultiPolygon');
    expect(out[1].geometry.coordinates).toHaveLength(2);
    // No centre point in the feed: the middle of the first area
    expect(out[1].properties.lat).toBeCloseTo(-28.805, 5);
    expect(out[1].properties.lng).toBeCloseTo(153.205, 5);
  });

  it('rejects something that is not KML', () => {
    expect(() => parseEssential('<!DOCTYPE html><html></html>')).toThrow(/Essential/);
  });
});

describe('helpers', () => {
  it('humanises statuses', () => {
    expect(humaniseStatus('ProceedingAsScheduled')).toBe('Proceeding as scheduled');
    expect(humaniseStatus('REPAIR')).toBe('Repair');
    expect(humaniseStatus(null)).toBe('');
  });

  it('converts Sydney dates either side of daylight saving', () => {
    expect(sydneyDateToIso('01/01/2026 12:00:00')).toBe('2026-01-01T01:00:00.000Z');
    expect(sydneyDateToIso('01/06/2026 12:00')).toBe('2026-06-01T02:00:00.000Z');
    expect(sydneyDateToIso('')).toBeNull();
  });

  it('keeps unplanned outages and planned ones in the next 48 hours', () => {
    const now = Date.parse('2026-11-09T00:00:00Z');
    const p = (start, estRestore) => ({ type: 'planned', start, estRestore });
    expect(isRelevant({ type: 'unplanned' }, now)).toBe(true);
    expect(isRelevant(p('2026-11-10T00:00:00Z', '2026-11-10T06:00:00Z'), now)).toBe(true);
    expect(isRelevant(p('2026-11-08T22:00:00Z', '2026-11-09T04:00:00Z'), now)).toBe(true); // under way
    expect(isRelevant(p('2026-11-08T00:00:00Z', '2026-11-08T06:00:00Z'), now)).toBe(false); // finished
    expect(isRelevant(p('2026-11-12T00:00:00Z', '2026-11-12T06:00:00Z'), now)).toBe(false); // too far ahead
  });
});

describe('refresh', () => {
  const now = Date.parse('2026-11-09T09:00:00Z');
  const ok = (body) => ({ ok: true, status: 200, text: async () => body });
  const fakeFetch = (overrides = {}) => async (url) => {
    for (const [match, res] of Object.entries(overrides)) if (url.includes(match)) return res();
    if (url.includes('ausgrid')) return ok(JSON.stringify(ausgridSample));
    if (url.includes('endeavour')) return ok(JSON.stringify(endeavourSample));
    return ok(essentialSample);
  };

  it('combines all three companies', async () => {
    const body = toResponseBody(await refresh(null, { fetchImpl: fakeFetch(), now }), now);
    expect(body.type).toBe('FeatureCollection');
    expect(body.meta.providers).toMatchObject({
      ausgrid: { ok: true, count: 2 },
      endeavour: { ok: true, count: 1 },
      // the planned July outage has finished
      essential: { ok: true, count: 1 },
    });
    expect(body.features).toHaveLength(4);
  });

  it("keeps a failed company's last good outages", async () => {
    const first = await refresh(null, { fetchImpl: fakeFetch(), now });
    const second = await refresh(first, {
      now: now + 120e3,
      fetchImpl: fakeFetch({
        endeavour: () => ({ ok: true, status: 301, text: async () => '' }),
        ausgrid: () => { throw new Error('fetch failed'); },
      }),
    });
    const body = toResponseBody(second, now + 120e3);
    expect(body.meta.providers.endeavour).toMatchObject({
      ok: false,
      count: 1,
      lastGoodAt: new Date(now).toISOString(),
      error: 'HTTP 301 redirect, feed has moved',
    });
    expect(body.meta.providers.ausgrid).toMatchObject({ ok: false, count: 2, error: 'fetch failed' });
    expect(body.meta.providers.essential.ok).toBe(true);
    expect(body.features).toHaveLength(4);
  });

  it('reports an error with nothing to fall back on', async () => {
    const state = await refresh(null, { now, fetchImpl: fakeFetch({ essential: () => ok('<html></html>') }) });
    expect(toResponseBody(state, now).meta.providers.essential).toMatchObject({
      ok: false,
      count: 0,
      lastGoodAt: null,
      error: 'Essential: expected KML',
    });
  });
});

describe('handler', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gzips only for callers that accept it', async () => {
    vi.stubGlobal('fetch', async (url) => ({
      ok: true,
      status: 200,
      text: async () => {
        if (url.includes('ausgrid')) return JSON.stringify(ausgridSample);
        if (url.includes('endeavour')) return JSON.stringify(endeavourSample);
        return essentialSample;
      },
    }));
    const plain = await handler({ headers: {} });
    expect(plain.isBase64Encoded).toBeUndefined();
    expect(plain.headers['content-encoding']).toBeUndefined();

    const zipped = await handler({ headers: { 'accept-encoding': 'gzip, deflate, br' } });
    expect(zipped.isBase64Encoded).toBe(true);
    expect(zipped.headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(Buffer.from(zipped.body, 'base64')).toString()).toBe(plain.body);
  });
});
