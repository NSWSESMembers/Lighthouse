import { describe, it, expect } from 'vitest';
import ko from 'knockout';
import { haversineMeters, nearestAssetInFence, findUnmarkedArrivals } from './onsiteGeofence.js';

const NOW = Date.parse('2026-10-15T10:00:00+11:00');
const JOB = { lat: -33.8688, lng: 151.2093 };
// ~0.0009 deg latitude is ~100 m
const north = (m) => JOB.lat + m / 111320;

const asset = (lat, lng, minutesAgo = 1) => ({
    latitude: ko.observable(lat),
    longitude: ko.observable(lng),
    lastSeen: ko.observable(new Date(NOW - minutesAgo * 60000).toISOString()),
});
const tasking = (status, { complete = false, lat = JOB.lat, lng = JOB.lng } = {}) => ({
    currentStatus: ko.observable(status),
    isComplete: ko.observable(complete),
    job: { address: { latitude: ko.observable(lat), longitude: ko.observable(lng) } },
});
const team = (assets, taskings) => ({
    trackableAssets: ko.observableArray(assets),
    taskings: ko.observableArray(taskings),
});

describe('haversineMeters', () => {
    it('measures ~111 km per degree of latitude', () => {
        expect(haversineMeters(0, 0, 1, 0)).toBeCloseTo(111195, -1);
    });
});

describe('nearestAssetInFence', () => {
    it('returns the closest fresh asset inside the radius', () => {
        const far = asset(north(150), JOB.lng);
        const near = asset(north(50), JOB.lng);
        const hit = nearestAssetInFence([far, near], JOB.lat, JOB.lng, 200, NOW);
        expect(hit.asset).toBe(near);
        expect(hit.metres).toBeCloseTo(50, 0);
    });

    it('ignores assets outside the radius', () => {
        expect(nearestAssetInFence([asset(north(250), JOB.lng)], JOB.lat, JOB.lng, 200, NOW)).toBeNull();
    });

    it('ignores stale fixes and assets without a position', () => {
        const stale = asset(JOB.lat, JOB.lng, 20);
        const noPos = asset(null, null);
        const noTime = asset(JOB.lat, JOB.lng);
        noTime.lastSeen('');
        expect(nearestAssetInFence([stale, noPos, noTime], JOB.lat, JOB.lng, 200, NOW)).toBeNull();
    });
});

describe('findUnmarkedArrivals', () => {
    it('flags Tasked and Enroute taskings with an asset at the incident', () => {
        const a = team([asset(north(100), JOB.lng)], [tasking('Enroute')]);
        const b = team([asset(north(20), JOB.lng)], [tasking('Tasked')]);
        const hits = findUnmarkedArrivals([a, b], { radiusM: 200, nowMs: NOW });
        expect(hits.map(h => h.team)).toEqual([b, a]); // nearest first
    });

    it('skips Onsite, Offsite, complete and ungeocoded taskings', () => {
        const t = team([asset(JOB.lat, JOB.lng)], [
            tasking('Onsite'),
            tasking('Offsite'),
            tasking('Enroute', { complete: true }),
            tasking('Enroute', { lat: null, lng: null }),
        ]);
        expect(findUnmarkedArrivals([t], { radiusM: 200, nowMs: NOW })).toEqual([]);
    });

    it('skips teams with no matched asset', () => {
        expect(findUnmarkedArrivals([team([], [tasking('Enroute')])], { radiusM: 200, nowMs: NOW })).toEqual([]);
    });

    it('uses filteredTaskings when the team has it', () => {
        const t = team([asset(JOB.lat, JOB.lng)], [tasking('Enroute')]);
        t.filteredTaskings = () => [];
        expect(findUnmarkedArrivals([t], { radiusM: 200, nowMs: NOW })).toEqual([]);
    });
});
