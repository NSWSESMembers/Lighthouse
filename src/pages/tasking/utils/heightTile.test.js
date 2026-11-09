import { describe, it, expect } from 'vitest';
import {
    HEIGHT_STOPS, STEEPNESS_BANDS, TILE_SIZE, heightColor, paintHeightTile, paintSteepnessTile, steepnessColor, tileCellMetres,
} from './heightTile.js';

const GRID = TILE_SIZE + 1;
const grid = (fn) => Float32Array.from({ length: GRID * GRID }, (_, i) => fn(i % GRID, Math.floor(i / GRID)));
const paint = (heights, mask = null) => {
    const out = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
    paintHeightTile(heights, GRID, mask, 5, out);
    return out;
};
const rgba = (out, x, y) => Array.from(out.slice((y * TILE_SIZE + x) * 4, (y * TILE_SIZE + x) * 4 + 4));

describe('heightColor', () => {
    it('uses the exact colour at each stop', () => {
        for (const [h, color] of HEIGHT_STOPS) expect(heightColor(h)).toEqual(color);
    });

    it('blends between stops', () => {
        expect(heightColor(5)).toEqual([66, 145, 93]);
    });

    it('clamps below and above the scale', () => {
        expect(heightColor(-20)).toEqual(HEIGHT_STOPS[0][1]);
        expect(heightColor(2200)).toEqual(HEIGHT_STOPS[HEIGHT_STOPS.length - 1][1]);
    });
});

describe('steepnessColor', () => {
    it('leaves gentle slopes clear', () => {
        expect(steepnessColor(4.9)).toBeNull();
    });

    it('uses the band a slope falls in', () => {
        expect(steepnessColor(5)).toEqual(STEEPNESS_BANDS[0][1]);
        expect(steepnessColor(29.9)).toEqual(STEEPNESS_BANDS[2][1]);
        expect(steepnessColor(80)).toEqual(STEEPNESS_BANDS[4][1]);
    });
});

describe('paintSteepnessTile', () => {
    const paintSteep = (heights) => {
        const out = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
        paintSteepnessTile(heights, GRID, null, 5, out);
        return out;
    };

    it('leaves flat ground clear', () => {
        expect(rgba(paintSteep(grid(() => 100)), 10, 10)[3]).toBe(0);
    });

    it('colours a 45 degree slope in the steepest band', () => {
        expect(rgba(paintSteep(grid((x) => 100 + x * 5)), 10, 10)).toEqual([...STEEPNESS_BANDS[4][1], 255]);
    });

    it('leaves sea transparent', () => {
        expect(rgba(paintSteep(grid(() => 0)), 10, 10)[3]).toBe(0);
    });
});

describe('tileCellMetres', () => {
    it('shrinks with zoom and away from the equator', () => {
        const z13 = tileCellMetres(4911, 13);
        expect(z13).toBeCloseTo(15.9, 0);
        expect(tileCellMetres(9822, 14)).toBeCloseTo(z13 / 2, 0);
    });
});

describe('paintHeightTile', () => {
    it('leaves flat ground at its plain colour', () => {
        expect(rgba(paint(grid(() => 100)), 10, 10)).toEqual([...HEIGHT_STOPS[4][1], 255]);
    });

    it('lights slopes facing north-west and darkens those facing south-east', () => {
        const facingNW = rgba(paint(grid((x, y) => 200 + x + y)), 10, 10);
        const facingSE = rgba(paint(grid((x, y) => 200 - x - y)), 10, 10);
        expect(facingNW[0]).toBeGreaterThan(facingSE[0]);
    });

    it('keeps very steep slopes above the darkest shade', () => {
        const color = heightColor(600);
        const [r] = rgba(paint(grid((x, y) => 600 - (x + y) * 1000)), 0, 0);
        expect(r).toBeGreaterThanOrEqual(Math.floor(color[0] * 0.35));
    });

    it('leaves sea and masked cells transparent', () => {
        const mask = new Uint8Array(GRID * GRID).fill(1);
        mask[5 * GRID + 5] = 0;
        const out = paint(grid((x) => (x < 3 ? 0 : 40)), mask);
        expect(rgba(out, 1, 1)[3]).toBe(0);
        expect(rgba(out, 5, 5)[3]).toBe(0);
        expect(rgba(out, 8, 8)[3]).toBe(255);
    });

    it('leaves the no-data value used for open ocean transparent', () => {
        expect(rgba(paint(grid(() => -3.4028e38)), 10, 10)[3]).toBe(0);
    });

    it('still colours ground below sea level', () => {
        expect(rgba(paint(grid(() => -2)), 10, 10)[3]).toBe(255);
    });

    it('does not shade the coast against the sea next to it', () => {
        const out = paint(grid((x) => (x > 20 ? 0 : 100)));
        expect(rgba(out, 20, 10)).toEqual(rgba(out, 10, 10));
    });
});
