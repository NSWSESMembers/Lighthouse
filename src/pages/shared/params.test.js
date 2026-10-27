import { describe, it, expect } from 'vitest';
import { parsePageParams, rangeForChoice, isValidRange, rangeText, scopeTitle, beaconEnvironment, RANGE_CHOICES } from './params.js';

describe('parsePageParams', () => {
  it('reads the launch params', () => {
    const p = parsePageParams('?host=https%3A%2F%2Fapi.test&source=https%3A%2F%2Fweb.test&userId=17&hq=1,2&start=2026-10-01T00%3A00%3A00.000Z&end=2026-10-02T00%3A00%3A00.000Z');
    expect(p.host).toBe('https://api.test');
    expect(p.source).toBe('https://web.test');
    expect(p.userId).toBe('17');
    expect(p.hqIds).toEqual(['1', '2']);
    expect(p.start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-10-02T00:00:00.000Z');
  });

  it('treats a missing or empty hq as all of NSW', () => {
    expect(parsePageParams('').hqIds).toEqual([]);
    expect(parsePageParams('hq=').hqIds).toEqual([]);
    expect(parsePageParams('hq=5,,').hqIds).toEqual(['5']);
  });

  it('defaults userId like BeaconClient does', () => {
    expect(parsePageParams('').userId).toBe('notPassed');
  });

  it('gives invalid dates when start/end are missing', () => {
    expect(isValidRange(parsePageParams(''))).toBe(false);
  });
});

describe('rangeForChoice', () => {
  const launch = { start: new Date('2026-10-01T00:00:00Z'), end: new Date('2026-10-02T00:00:00Z') };
  const now = new Date('2026-10-10T12:00:00Z');

  it('returns the launch range for "launch"', () => {
    expect(rangeForChoice(launch, 'launch', now)).toEqual(launch);
  });

  it('returns the last N hours to now', () => {
    const r = rangeForChoice(launch, '24', now);
    expect(r.end).toBe(now);
    expect(r.start.toISOString()).toBe('2026-10-09T12:00:00.000Z');
  });

  it('falls back to the launch range for nonsense', () => {
    expect(rangeForChoice(launch, 'abc', now)).toEqual(launch);
    expect(rangeForChoice(launch, '0', now)).toEqual(launch);
  });
});

describe('isValidRange', () => {
  it('needs real dates in order', () => {
    expect(isValidRange({ start: new Date(1), end: new Date(2) })).toBe(true);
    expect(isValidRange({ start: new Date(2), end: new Date(1) })).toBe(false);
    expect(isValidRange({ start: new Date('x'), end: new Date(2) })).toBe(false);
  });
});

describe('scopeTitle', () => {
  const unit = (Name, Code) => ({ Name, ParentEntity: { Code } });

  it('is NSW with no units', () => {
    expect(scopeTitle([])).toBe('NSW');
  });

  it('is the unit name for one unit', () => {
    expect(scopeTitle([unit('Demo City', 'DMZ')])).toBe('Demo City');
  });

  it('names the shared zone for several units', () => {
    expect(scopeTitle([unit('A', 'DMZ'), unit('B', 'DMZ')])).toBe('2 DMZ units');
  });

  it('just counts units across zones', () => {
    expect(scopeTitle([unit('A', 'DMZ'), unit('B', 'XYZ'), unit('C', 'XYZ')])).toBe('3 units');
  });
});

describe('beaconEnvironment', () => {
  it('recognises train and dev Beacon', () => {
    expect(beaconEnvironment('https://trainbeacon.ses.nsw.gov.au')).toBe('trainbeacon');
    expect(beaconEnvironment('https://devbeacon.ses.nsw.gov.au/')).toBe('devbeacon');
  });

  it('treats anything else as production', () => {
    expect(beaconEnvironment('https://beacon.ses.nsw.gov.au')).toBe('production');
    expect(beaconEnvironment('')).toBe('production');
    expect(beaconEnvironment(undefined)).toBe('production');
  });
});

describe('rangeText', () => {
  it('shows both ends of a valid range', () => {
    const t = rangeText({ start: new Date(2026, 9, 15, 0, 0), end: new Date(2026, 9, 15, 23, 59) });
    expect(t).toMatch(/15 Oct 2026.*00:00 to .*15 Oct 2026.*23:59/);
  });

  it('says so for an invalid one', () => {
    expect(rangeText({ start: new Date('x'), end: new Date() })).toBe('No valid date range');
  });
});

describe('RANGE_CHOICES', () => {
  it('starts with the launch range and has unique ids', () => {
    expect(RANGE_CHOICES[0].value).toBe('launch');
    expect(new Set(RANGE_CHOICES.map((c) => c.id)).size).toBe(RANGE_CHOICES.length);
  });
});
