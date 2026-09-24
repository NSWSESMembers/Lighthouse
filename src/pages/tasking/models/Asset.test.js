import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Asset } from './Asset.js';

const deps = () => ({ relativeUpdateTick: vi.fn(() => 0) });

function assetData(overrides = {}) {
  return {
    properties: { id: 'a1', name: 'RES1A', capability: 'Rescue', entity: 'HQ1', resourceType: 'Vehicle', ...overrides.properties },
    geometry: { coordinates: [151.2, -33.8] },
    lastSeen: '2026-01-01T11:00:00.000Z',
    ...overrides,
  };
}

describe('construction', () => {
  it('maps id/name/capability from properties', () => {
    const a = new Asset(assetData(), deps());
    expect(a.id()).toBe('a1');
    expect(a.name()).toBe('RES1A');
    expect(a.capability()).toBe('Rescue');
  });

  it('derives latitude/longitude from the GeoJSON [lng, lat] coordinate pair', () => {
    const a = new Asset(assetData(), deps());
    expect(a.longitude()).toBe(151.2);
    expect(a.latitude()).toBe(-33.8);
  });

  it('defaults latitude/longitude to null with no geometry', () => {
    const a = new Asset({ properties: {} }, deps());
    expect(a.latitude()).toBeNull();
    expect(a.longitude()).toBeNull();
  });

  it('defaults licensePlate to "-"', () => {
    const a = new Asset({ properties: {} }, deps());
    expect(a.licensePlate()).toBe('-');
  });
});

describe('matchingTeamsInView', () => {
  it('filters to teams currently filtered in', () => {
    const a = new Asset(assetData(), deps());
    a.matchingTeams.push({ isFilteredIn: () => true });
    a.matchingTeams.push({ isFilteredIn: () => false });
    expect(a.matchingTeamsInView()).toHaveLength(1);
  });
});

describe('latLngText', () => {
  it('formats to 5 decimal places', () => {
    const a = new Asset(assetData(), deps());
    expect(a.latLngText()).toBe('-33.80000, 151.20000');
  });

  it('is blank with no coordinates', () => {
    const a = new Asset({ properties: {} }, deps());
    expect(a.latLngText()).toBe('');
  });
});

describe('relative-time computeds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('depend on deps.relativeUpdateTick and are blank with no lastSeen', () => {
    const tick = vi.fn(() => 0);
    const a = new Asset({ properties: {} }, { relativeUpdateTick: tick });
    expect(a.lastSeenJustAgoText()).toBe('');
    expect(tick).toHaveBeenCalled();
  });

  it('formats lastSeenJustAgoText/lastSeenText from lastSeen', () => {
    const a = new Asset(assetData(), deps());
    expect(a.lastSeenJustAgoText()).toBe('1h ago');
    expect(a.lastSeenText()).toContain('1h ago —');
  });

  it('throws if constructed without a relativeUpdateTick (required, not optional)', () => {
    // sharedRelativeTick is only wired up when deps.relativeUpdateTick is a
    // function; otherwise it's null, and lastSeenJustAgoText/lastSeenText/
    // talkgroupLastUpdatedText unconditionally call it. Every real caller
    // (main.js) passes one, so this is a construction contract to be aware
    // of rather than a live bug.
    const a = new Asset(assetData());
    expect(() => a.lastSeenJustAgoText()).toThrow();
  });
});

describe('updateFromJson', () => {
  it('patches direction/talkgroup fields from properties', () => {
    const a = new Asset(assetData(), deps());
    a.updateFromJson({ properties: { direction: 90, talkgroup: 'TG1' } });
    expect(a.direction()).toBe(90);
    expect(a.talkgroup()).toBe('TG1');
  });

  it('updates markerLabel', () => {
    const a = new Asset(assetData(), deps());
    a.updateFromJson({ markerLabel: 'New Label' });
    expect(a.markerLabel()).toBe('New Label');
  });

  it('merges a partial coordinate update, preserving the other axis', () => {
    const a = new Asset(assetData(), deps());
    a.updateFromJson({ geometry: { coordinates: [999, undefined] } });
    expect(a.longitude()).toBe(999);
    expect(a.latitude()).toBe(-33.8); // preserved from construction
  });

  it('updates lastSeen', () => {
    const a = new Asset(assetData(), deps());
    a.updateFromJson({ lastSeen: '2026-02-01T00:00:00.000Z' });
    expect(a.lastSeen()).toBe('2026-02-01T00:00:00.000Z');
  });

  it('is a no-op for a null/undefined patch', () => {
    const a = new Asset(assetData(), deps());
    expect(() => a.updateFromJson(null)).not.toThrow();
    expect(a.name()).toBe('RES1A');
  });
});
