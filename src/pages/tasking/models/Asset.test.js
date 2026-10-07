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

describe('satellite tracker fields', () => {
  it('is not a satellite asset without a satelliteId', () => {
    const a = new Asset(assetData(), deps());
    expect(a.isSatellite()).toBe(false);
    expect(a.satelliteBattery()).toBe('');
  });

  it('maps satellite fields from properties and flags isSatellite', () => {
    const a = new Asset(assetData({ properties: {
      satelliteId: '0-1234567', satelliteBattery: 'OK', satelliteClass: 'Class 4 Punt',
      satelliteClassType: 'Class 4 Punt', satelliteEquipmentId: '10000001', satelliteStatus: 'ACTIVE',
    } }), deps());
    expect(a.isSatellite()).toBe(true);
    expect(a.satelliteId()).toBe('0-1234567');
    expect(a.satelliteClass()).toBe('Class 4 Punt');
    expect(a.satelliteEquipmentId()).toBe('10000001');
    expect(a.satelliteStatus()).toBe('ACTIVE');
  });

  it('updateFromJson refreshes satellite battery/status', () => {
    const a = new Asset(assetData({ properties: { satelliteId: '0-1234567', satelliteBattery: 'OK' } }), deps());
    a.updateFromJson({ properties: { satelliteBattery: 'Replace', satelliteStatus: 'INACTIVE' } });
    expect(a.satelliteBattery()).toBe('Replace');
    expect(a.satelliteStatus()).toBe('INACTIVE');
    expect(a.isSatellite()).toBe(true);
  });
});

describe('satelliteBatteryText', () => {
  it('shows "Replace" as "Low" and passes other values through', () => {
    const a = new Asset(assetData({ properties: { satelliteId: '0-1', satelliteBattery: 'Replace' } }), deps());
    expect(a.satelliteBatteryText()).toBe('Low');
    a.satelliteBattery('OK');
    expect(a.satelliteBatteryText()).toBe('OK');
    a.satelliteBattery('');
    expect(a.satelliteBatteryText()).toBe('');
  });
});

describe('satelliteSummary', () => {
  it('joins class, status and battery, skipping a duplicate class type and blanks', () => {
    const a = new Asset(assetData({ properties: {
      satelliteId: '0-1', satelliteClass: 'Class 4 Punt', satelliteClassType: 'Class 4 Punt',
      satelliteStatus: 'ACTIVE', satelliteBattery: 'Replace',
    } }), deps());
    expect(a.satelliteSummary()).toBe('Class 4 Punt · ACTIVE · Battery Low');
    a.satelliteBattery('');
    expect(a.satelliteSummary()).toBe('Class 4 Punt · ACTIVE');
  });
});

describe('satelliteActive', () => {
  it('is true only for an ACTIVE status (case-insensitive)', () => {
    const a = new Asset(assetData({ properties: { satelliteId: '0-1', satelliteStatus: 'ACTIVE' } }), deps());
    expect(a.satelliteActive()).toBe(true);
    a.satelliteStatus('active');
    expect(a.satelliteActive()).toBe(true);
    a.satelliteStatus('INACTIVE');
    expect(a.satelliteActive()).toBe(false);
    expect(a.satelliteIconTitle()).toContain('INACTIVE');
    a.satelliteStatus('');
    expect(a.satelliteActive()).toBe(false);
  });
});
