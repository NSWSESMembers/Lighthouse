import { describe, it, expect } from 'vitest';
import { suggestTeamIndices } from './TeamSuggestionEngine.js';

const RESCUE = 1;
const OTHER = 2;

describe('suggestTeamIndices -- gating', () => {
  it('returns [] when disabled', () => {
    const teams = [{ distanceMeters: 100, taskingCount: 0 }];
    expect(suggestTeamIndices(teams, OTHER, { enabled: false })).toEqual([]);
  });

  it('returns [] for an empty/missing team list', () => {
    expect(suggestTeamIndices([], OTHER, {})).toEqual([]);
    expect(suggestTeamIndices(null, OTHER, {})).toEqual([]);
  });

  it('returns [] when every team lacks a usable distance', () => {
    const teams = [{ distanceMeters: null, taskingCount: 0 }, { distanceMeters: NaN, taskingCount: 1 }];
    expect(suggestTeamIndices(teams, OTHER, {})).toEqual([]);
  });
});

describe('rescue strategy', () => {
  it('prefers the nearest idle (0-tasking) team over a closer busy one', () => {
    const teams = [
      { distanceMeters: 100, taskingCount: 2 },  // closer but busy
      { distanceMeters: 500, taskingCount: 0 },  // farther but idle
    ];
    const result = suggestTeamIndices(teams, RESCUE, {}, 1);
    expect(result[0].index).toBe(1);
    expect(result[0].reason).toContain('idle team');
  });

  it('ranks multiple idle teams by proximity, nearest first', () => {
    const teams = [
      { distanceMeters: 500, taskingCount: 0 },
      { distanceMeters: 100, taskingCount: 0 },
      { distanceMeters: 300, taskingCount: 0 },
    ];
    const result = suggestTeamIndices(teams, RESCUE, {}, 3);
    expect(result.map((r) => r.index)).toEqual([1, 2, 0]);
    expect(result[0].reason).toContain('Nearest idle');
    expect(result[1].reason).toContain('#2 nearest idle');
  });

  it('falls back to nearest team overall when every team is busy and taskingWeight is 0', () => {
    const teams = [
      { distanceMeters: 500, taskingCount: 1 },
      { distanceMeters: 100, taskingCount: 3 },
    ];
    const result = suggestTeamIndices(teams, RESCUE, { rescueTaskingWeight: 0 }, 1);
    expect(result[0].index).toBe(1);
    expect(result[0].reason).toContain('all busy');
  });

  it('uses weighted scoring when every team is busy but taskingWeight > 0', () => {
    const teams = [
      { distanceMeters: 100, taskingCount: 5 },  // very close but very busy
      { distanceMeters: 200, taskingCount: 1 },  // a bit farther but far less busy
    ];
    const result = suggestTeamIndices(teams, RESCUE, { rescueDistanceWeight: 10, rescueTaskingWeight: 90 }, 1);
    expect(result[0].index).toBe(1); // tasking-count dominates with a 90% weight
    expect(result[0].reason).toContain('rescue, all teams busy');
  });

  it('prefers travelTimeSeconds over distanceMeters for proximity when available', () => {
    const teams = [
      { distanceMeters: 100, travelTimeSeconds: 900, taskingCount: 0 },  // close but slow road route
      { distanceMeters: 500, travelTimeSeconds: 120, taskingCount: 0 }, // far but fast road route
    ];
    const result = suggestTeamIndices(teams, RESCUE, {}, 1);
    expect(result[0].index).toBe(1);
    expect(result[0].reason).toContain('min');
  });

  it('ignores teams without a usable distance even for rescue', () => {
    const teams = [
      { distanceMeters: null, taskingCount: 0 },
      { distanceMeters: 100, taskingCount: 0 },
    ];
    const result = suggestTeamIndices(teams, RESCUE, {}, 2);
    expect(result).toHaveLength(1);
    expect(result[0].index).toBe(1);
  });
});

describe('general (non-rescue) strategy', () => {
  it('returns [] when both distance and tasking weights are zeroed', () => {
    const teams = [{ distanceMeters: 100, taskingCount: 0 }];
    const result = suggestTeamIndices(teams, OTHER, { normalDistanceWeight: 0, normalTaskingWeight: 0 });
    expect(result).toEqual([]);
  });

  it('scores the closest, least-busy team highest with equal weights', () => {
    const teams = [
      { distanceMeters: 5000, taskingCount: 3 },
      { distanceMeters: 100, taskingCount: 0 },
    ];
    const result = suggestTeamIndices(teams, OTHER, { normalDistanceWeight: 50, normalTaskingWeight: 50 }, 1);
    expect(result[0].index).toBe(1);
    expect(result[0].score).toBeUndefined(); // score isn't part of the public shape
    expect(result[0].reason).toContain('Best match');
  });

  it('a distance-only weighting ignores tasking count entirely', () => {
    const teams = [
      { distanceMeters: 100, taskingCount: 10 }, // closer but very busy
      { distanceMeters: 5000, taskingCount: 0 }, // farther but idle
    ];
    const result = suggestTeamIndices(teams, OTHER, { normalDistanceWeight: 100, normalTaskingWeight: 0 }, 1);
    expect(result[0].index).toBe(0);
    expect(result[0].reason).toContain('dist 100%');
    // the trailing "N tasking(s)" summary always appears regardless of
    // weighting -- only the "task X%" weight descriptor should be absent.
    expect(result[0].reason).not.toMatch(/task \d+%/);
  });

  it('a tasking-only weighting ignores distance entirely', () => {
    const teams = [
      { distanceMeters: 100, taskingCount: 10 },
      { distanceMeters: 5000, taskingCount: 0 },
    ];
    const result = suggestTeamIndices(teams, OTHER, { normalDistanceWeight: 0, normalTaskingWeight: 100 }, 1);
    expect(result[0].index).toBe(1);
    expect(result[0].reason).toContain('task 100%');
  });

  it('ranks the top N by descending score', () => {
    const teams = [
      { distanceMeters: 5000, taskingCount: 5 }, // worst
      { distanceMeters: 100, taskingCount: 0 },  // best
      { distanceMeters: 2000, taskingCount: 2 }, // middle
    ];
    const result = suggestTeamIndices(teams, OTHER, {}, 3);
    expect(result.map((r) => r.index)).toEqual([1, 2, 0]);
    expect(result[0].reason).toContain('Best match');
    expect(result[1].reason).toContain('#2 match');
  });

  it('does not divide by zero when every remaining team has the identical distance and tasking count', () => {
    const teams = [
      { distanceMeters: 100, taskingCount: 1 },
      { distanceMeters: 100, taskingCount: 1 },
    ];
    expect(() => suggestTeamIndices(teams, OTHER, {}, 2)).not.toThrow();
    const result = suggestTeamIndices(teams, OTHER, {}, 2);
    expect(result).toHaveLength(2);
  });

  it('caps the result at `count` even with more candidates available', () => {
    const teams = Array.from({ length: 5 }, (_, i) => ({ distanceMeters: 100 * (i + 1), taskingCount: 0 }));
    const result = suggestTeamIndices(teams, OTHER, {}, 2);
    expect(result).toHaveLength(2);
  });

  it('defaults count to 2 when omitted', () => {
    const teams = Array.from({ length: 5 }, (_, i) => ({ distanceMeters: 100 * (i + 1), taskingCount: 0 }));
    const result = suggestTeamIndices(teams, OTHER, {});
    expect(result).toHaveLength(2);
  });
});
