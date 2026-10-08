// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { addFix, pruneTrail, trailOpacity, fixTime, distanceM, MIN_MOVE_M, MAX_FIXES } from './assetTrails.js';

// ~111m per 0.001 deg of latitude.
const fix = (dLat, t) => ({ lat: -33.8 + dLat, lng: 151.2, t });

describe('distanceM', () => {
    it('measures roughly in metres', () => {
        expect(distanceM(fix(0), fix(0.001))).toBeGreaterThan(105);
        expect(distanceM(fix(0), fix(0.001))).toBeLessThan(115);
    });
});

describe('addFix', () => {
    it('adds the first fix', () => {
        const trail = [];
        expect(addFix(trail, fix(0, 1))).toBe(true);
        expect(trail).toHaveLength(1);
    });

    it('ignores jitter within MIN_MOVE_M of the last fix', () => {
        const trail = [fix(0, 1)];
        const jitterDeg = (MIN_MOVE_M / 2) / 111000;
        expect(addFix(trail, fix(jitterDeg, 2))).toBe(false);
        expect(addFix(trail, fix(0.001, 3))).toBe(true);
        expect(trail.map(f => f.t)).toEqual([1, 3]);
    });

    it('ignores a fix older than the last one', () => {
        const trail = [fix(0, 10)];
        expect(addFix(trail, fix(0.001, 5))).toBe(false);
        expect(trail).toHaveLength(1);
    });

    it('caps a trail at MAX_FIXES, dropping the oldest', () => {
        const trail = [];
        for (let i = 0; i < MAX_FIXES + 10; i++) addFix(trail, fix(i * 0.001, i));
        expect(trail).toHaveLength(MAX_FIXES);
        expect(trail[0].t).toBe(10);
    });
});

describe('pruneTrail', () => {
    it('drops fixes that only start segments older than the cutoff', () => {
        const trail = [fix(0, 1), fix(0.001, 2), fix(0.002, 5), fix(0.003, 8)];
        expect(pruneTrail(trail, 3)).toBe(true);
        // 2 stays: the 2->5 segment ends inside the trail length.
        expect(trail.map(f => f.t)).toEqual([2, 5, 8]);
    });

    it('always keeps the newest fix, so the next move draws from it', () => {
        const trail = [fix(0, 1), fix(0.001, 2)];
        pruneTrail(trail, 100);
        expect(trail.map(f => f.t)).toEqual([2]);
    });

    it('reports no change when nothing is old enough', () => {
        const trail = [fix(0, 10), fix(0.001, 20)];
        expect(pruneTrail(trail, 5)).toBe(false);
        expect(trail).toHaveLength(2);
    });
});

describe('trailOpacity', () => {
    it('fades from strong to faint over the window, clamped', () => {
        expect(trailOpacity(0, 1000)).toBeCloseTo(0.8);
        expect(trailOpacity(1000, 1000)).toBeCloseTo(0.15);
        expect(trailOpacity(5000, 1000)).toBeCloseTo(0.15);
        expect(trailOpacity(500, 1000)).toBeGreaterThan(trailOpacity(900, 1000));
    });
});

describe('fixTime', () => {
    const now = Date.parse('2026-10-08T03:00:00Z');

    it('uses lastSeen', () => {
        expect(fixTime('2026-10-08T02:55:00Z', now)).toBe(now - 5 * 60 * 1000);
    });

    it('falls back to now if missing, unparseable or in the future', () => {
        expect(fixTime('', now)).toBe(now);
        expect(fixTime('not a date', now)).toBe(now);
        expect(fixTime('2026-10-08T03:10:00Z', now)).toBe(now);
    });
});
