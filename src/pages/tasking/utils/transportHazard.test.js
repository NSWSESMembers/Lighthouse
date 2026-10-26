import { describe, it, expect } from 'vitest';
import {
  decodePolyline,
  transportHazardAdvice,
  transportHazardColour,
  transportHazardIcon,
  transportHazardLocation,
  transportHazardRows,
  transportHazardShapes,
} from './transportHazard.js';

const ICONS = 'https://www.livetraffic.com/assets/icons/map/';
const feature = (properties) => ({ properties });

describe('transportHazardIcon', () => {
  it('picks the council report icon from CategoryIcon', () => {
    expect(transportHazardIcon(feature({ CategoryIcon: 'Flood' }), { council: true })).toBe(
      `${ICONS}other-hazards/flood.svg`,
    );
    expect(transportHazardIcon(feature({ CategoryIcon: 'Fire' }), { council: true })).toBe(
      `${ICONS}other-hazards/fire.svg`,
    );
    expect(transportHazardIcon(feature({ CategoryIcon: 'SnowIce' }), { council: true })).toBe(
      `${ICONS}alpine/snow.svg`,
    );
    expect(transportHazardIcon(feature({ CategoryIcon: 'AdverseWeather' }), { council: true })).toBe(
      `${ICONS}other-hazards/adverse-weather.svg`,
    );
  });

  it('uses impactingNetwork for council report severity', () => {
    expect(
      transportHazardIcon(feature({ CategoryIcon: 'ChangedConditions', impactingNetwork: true }), { council: true }),
    ).toBe(`${ICONS}changed-traffic/moderate-now.svg`);
    expect(
      transportHazardIcon(feature({ CategoryIcon: 'ChangedConditions', impactingNetwork: false }), { council: true }),
    ).toBe(`${ICONS}changed-traffic/low-now.svg`);
  });

  it('uses traffic volume for incident severity', () => {
    const roads = (trafficVolume) => [{ trafficVolume }];
    expect(transportHazardIcon(feature({ CategoryIcon: 'Crash', roads: roads('Heavy') }))).toBe(
      `${ICONS}crashes/heavy-now.svg`,
    );
    expect(transportHazardIcon(feature({ CategoryIcon: 'Crash', roads: roads('Light') }))).toBe(
      `${ICONS}crashes/low-now.svg`,
    );
    expect(transportHazardIcon(feature({ CategoryIcon: 'Crash' }))).toBe(`${ICONS}crashes/moderate-now.svg`);
  });

  it('falls back to mainCategory text, then the general hazard icon', () => {
    expect(transportHazardIcon(feature({ mainCategory: 'Traffic lights blacked out' }))).toBe(
      `${ICONS}traffic-lights/moderate-now.svg`,
    );
    expect(transportHazardIcon(feature({ mainCategory: 'Something new' }))).toBe(
      `${ICONS}general-hazards/moderate-now.svg`,
    );
    expect(transportHazardIcon(feature({ CategoryIcon: 'Unknown' }))).toBe(`${ICONS}general-hazards/moderate-now.svg`);
    expect(transportHazardIcon({})).toBe(`${ICONS}general-hazards/moderate-now.svg`);
  });
});

const near = (actual, expected) =>
  expect(actual.map(([a, b]) => [Number(a.toFixed(5)), Number(b.toFixed(5))])).toEqual(expected);

describe('decodePolyline', () => {
  it('decodes the Google reference polyline', () => {
    near(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it('returns nothing for missing or truncated input', () => {
    expect(decodePolyline(undefined)).toEqual([]);
    expect(decodePolyline('')).toEqual([]);
    expect(decodePolyline('_p~iF')).toEqual([]);
  });
});

describe('transportHazardShapes', () => {
  it('collects the point, encoded polylines and collection shapes', () => {
    const shapes = transportHazardShapes({
      geometry: {
        type: 'Point',
        coordinates: [151, -33.8],
        collections: [
          { type: 'Point', coordinates: [151.1, -33.9] },
          {
            type: 'Polygon',
            coordinates: [
              [
                [151, -33],
                [151.1, -33],
                [151.1, -33.1],
                [151, -33],
              ],
            ],
          },
        ],
      },
      properties: { encodedPolylines: [{ coords: '_p~iF~ps|U_ulLnnqC' }, { coords: '' }] },
    });
    expect(shapes.points).toEqual([
      [-33.8, 151],
      [-33.9, 151.1],
    ]);
    expect(shapes.lines).toHaveLength(1);
    near(shapes.lines[0], [
      [38.5, -120.2],
      [40.7, -120.95],
    ]);
    expect(shapes.areas).toHaveLength(1);
    expect(shapes.areas[0][0][1]).toEqual([-33, 151.1]);
  });

  it('draws a LineString geometry with no point', () => {
    const shapes = transportHazardShapes({
      geometry: {
        type: 'LineString',
        coordinates: [
          [151, -33],
          [151.1, -33.1],
        ],
      },
      properties: {},
    });
    expect(shapes.points).toEqual([]);
    expect(shapes.lines).toEqual([
      [
        [-33, 151],
        [-33.1, 151.1],
      ],
    ]);
  });

  it('copes with a missing geometry', () => {
    expect(transportHazardShapes({ properties: {} })).toEqual({ points: [], lines: [], areas: [] });
  });
});

describe('transportHazardColour', () => {
  it('matches Live Traffic line colours', () => {
    expect(transportHazardColour(feature({ CategoryIcon: 'Flood' }), { council: true })).toBe('#0067A5');
    expect(transportHazardColour(feature({ CategoryIcon: 'Fire' }))).toBe('#9B0000');
    expect(transportHazardColour(feature({ CategoryIcon: 'Hazard', impactingNetwork: false }), { council: true })).toBe(
      '#666666',
    );
    expect(transportHazardColour(feature({ CategoryIcon: 'Crash', roads: [{ trafficVolume: 'Heavy' }] }))).toBe(
      '#9B0000',
    );
  });
});

describe('transportHazardAdvice', () => {
  it('adds the speed limit to a reduced speed limit item only', () => {
    expect(transportHazardAdvice({ adviceA: 'Exercise caution', adviceB: 'Reduced speed limit', speedLimit: 40 })).toBe(
      'Exercise caution, Reduced speed limit (40 km/h)',
    );
  });

  it('leaves out the -1 "no limit" speed and blank advice', () => {
    expect(transportHazardAdvice({ adviceA: 'Reduced speed limit', adviceB: ' ', adviceC: '', speedLimit: -1 })).toBe(
      'Reduced speed limit',
    );
    expect(transportHazardAdvice({ adviceA: 'Road closed', speedLimit: -1 })).toBe('Road closed');
    expect(transportHazardAdvice({})).toBe('');
  });
});

describe('transportHazardLocation', () => {
  it('builds the location like Live Traffic', () => {
    const at = (road) => transportHazardLocation({ roads: [road] });
    expect(
      at({ mainStreet: 'PACIFIC HWY', locationQualifier: 'At', crossStreet: 'BANKSIA RD', suburb: 'Demo River' }),
    ).toBe('Pacific Hwy at Banksia Rd, Demo River');
    expect(
      at({ mainStreet: 'OLD FERRY RD', locationQualifier: 'between', crossStreet: 'A ST', secondLocation: 'B ST' }),
    ).toBe('Old Ferry Rd between A St and B St');
    expect(at({ mainStreet: 'M1 NSW', startRoadName: 'Exit 5' })).toBe('M1 NSW near Exit 5');
    expect(at({ suburb: 'Demo Flats' })).toBe('Demo Flats');
    expect(transportHazardLocation({})).toBe('');
  });
});

describe('transportHazardRows', () => {
  const labels = (rows) => rows.map(([label]) => label);

  it('leaves out empty fields instead of showing Unknown', () => {
    const rows = transportHazardRows(feature({ displayName: 'Hazard', mainCategory: 'Hazard', speedLimit: -1 }));
    expect(rows).toEqual([['Reported by', 'Transport for NSW']]);
  });

  it('shows the council and its contacts for council reports', () => {
    const rows = transportHazardRows(
      feature({
        displayName: 'Flooding',
        mainCategory: 'Flooding',
        adviceA: 'Road closed',
        start: '2026-10-05T08:30:00+11:00',
        hideEndDate: true,
        attendingGroups: [' '],
        OrgName: 'Demo Shire Council',
        OrgContact: '02 0000 0000',
      }),
      { council: true },
    );
    expect(labels(rows)).toEqual(['Advice', 'From', 'Reported by', 'Council phone']);
    expect(rows[2][1]).toBe('Demo Shire Council');
  });

  it('shows a start-to-end range and attending groups', () => {
    const rows = transportHazardRows(
      feature({
        start: '2026-10-05T08:30:00+11:00',
        end: '2026-10-05T12:00:00+11:00',
        attendingGroups: ['Police', 'Tow truck'],
      }),
    );
    expect(labels(rows)).toEqual(['When', 'Attending', 'Reported by']);
    expect(rows[1][1]).toBe('Police, Tow truck');
  });

  it('marks council details as feed HTML and hides a category the title already says', () => {
    const rows = transportHazardRows(
      feature({
        displayName: 'CHANGED TRAFFIC CONDITIONS Unplanned',
        mainCategory: 'CHANGED TRAFFIC CONDITIONS',
        otherAdvice: '<p>The road is closed.</p>',
      }),
      { council: true },
    );
    expect(rows[0]).toEqual(['Details', '<p>The road is closed.</p>', { html: true }]);
    expect(labels(rows)).not.toContain('Category');
  });
});
