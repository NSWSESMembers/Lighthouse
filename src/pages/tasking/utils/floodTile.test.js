import { describe, it, expect } from 'vitest';
import { clearImageBorder } from './floodTile.js';

describe('clearImageBorder', () => {
    it('makes near-black pixels transparent and keeps the photo', () => {
        const data = Uint8ClampedArray.from([0, 0, 0, 255, 3, 2, 1, 255, 90, 70, 40, 255]);
        expect(clearImageBorder(data)).toBe(true);
        expect(Array.from(data)).toEqual([0, 0, 0, 0, 3, 2, 1, 0, 90, 70, 40, 255]);
    });

    it('keeps dark pixels that are not border', () => {
        const data = Uint8ClampedArray.from([3, 3, 4, 255]);
        expect(clearImageBorder(data)).toBe(true);
        expect(data[3]).toBe(255);
    });

    it('reports a tile with nothing left to show', () => {
        expect(clearImageBorder(Uint8ClampedArray.from([0, 0, 0, 255, 200, 200, 200, 0]))).toBe(false);
    });
});
