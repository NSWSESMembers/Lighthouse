import { describe, it, expect, vi, beforeEach } from 'vitest';
import ko from 'knockout';
import { driveSourceFor, fixFreshness, fetchDriveTime, setDriveTimeTokenGetter } from './driveTime.js';

const asset = (name, lat, lng, lastSeen = '2026-06-15T09:58:00') => ({
  name: ko.observable(name),
  latitude: ko.observable(lat),
  longitude: ko.observable(lng),
  lastSeen: ko.observable(lastSeen),
});

describe('driveSourceFor', () => {
  it('prefers the default asset', () => {
    const a = asset('A', -33.1, 151.1), b = asset('B', -33.2, 151.2);
    const team = { trackableAssets: ko.observableArray([a, b]), defaultAsset: () => b };
    expect(driveSourceFor(team)).toEqual({ name: 'B', lat: -33.2, lng: 151.2, lastSeen: '2026-06-15T09:58:00' });
  });

  it('skips assets with no position, and is null when none has one', () => {
    const a = asset('A', null, null), b = asset('B', -33.2, 151.2);
    expect(driveSourceFor({ trackableAssets: ko.observableArray([a, b]), defaultAsset: () => a }).name).toBe('B');
    expect(driveSourceFor({ trackableAssets: ko.observableArray([a]) })).toBeNull();
    expect(driveSourceFor(null)).toBeNull();
  });
});

describe('fixFreshness', () => {
  const now = new Date('2026-06-15T10:00:00').getTime();
  it.each([
    ['2026-06-15T09:59:40', 'updated just now', 'fresh'],
    ['2026-06-15T09:55:00', 'updated 5 min ago', 'fresh'],
    ['2026-06-15T09:54:00', 'updated 6 min ago', 'aging'],
    ['2026-06-15T09:45:00', 'updated 15 min ago', 'aging'],
    ['2026-06-15T09:44:00', 'updated 16 min ago', 'stale'],
    ['2026-06-15T08:20:00', 'updated 1h 40m ago', 'stale'],
    ['2026-06-13T09:00:00', 'updated 2d ago', 'stale'],
  ])('%s -> %s (%s)', (lastSeen, ageLabel, state) => {
    expect(fixFreshness(lastSeen, now)).toMatchObject({ ageLabel, state });
  });

  it('is unknown with no time', () => {
    expect(fixFreshness('', now)).toEqual({ minutesAgo: null, ageLabel: 'update time unknown', state: 'unknown' });
  });
});

describe('fetchDriveTime', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('routes from -> to with the token and rounds minutes up', async () => {
    setDriveTimeTokenGetter(async () => 'tok');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ Routes: [{ Summary: { Overview: { Distance: 12345, Duration: 61 } } }] }),
    });
    const r = await fetchDriveTime({ lat: -33.1, lng: 151.1 }, { lat: -33.2, lng: 151.2 });
    expect(r).toEqual({ minutes: 2, distanceMeters: 12345 });
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(opts.body).coordinates).toEqual([[151.1, -33.1], [151.2, -33.2]]);
  });

  it('is null when no route comes back', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await fetchDriveTime({ lat: 1, lng: 1 }, { lat: 2, lng: 2 })).toBeNull();
  });
});
