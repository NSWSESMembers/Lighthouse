import { describe, it, expect } from 'vitest';
import { transportHazardIcon } from './transportHazardIcon.js';

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
