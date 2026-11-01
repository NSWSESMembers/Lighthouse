import { describe, it, expect } from 'vitest';
import { viewImageRequest, MERCATOR_MAX } from './wmsViewImage.js';

const view = (minx, miny, maxx, maxy) => ({ min: { x: minx, y: miny }, max: { x: maxx, y: maxy } });

describe('viewImageRequest', () => {
    it('pads the view on each side and keeps the map scale', () => {
        const r = viewImageRequest(view(0, 0, 1000, 500), { x: 1000, y: 500 }, { pad: 0.25 });
        expect(r.bbox).toEqual([-250, -125, 1250, 625]);
        expect(r.width).toBe(1500);
        expect(r.height).toBe(750);
    });

    it('requests exactly the view with no padding', () => {
        const r = viewImageRequest(view(10, 20, 410, 320), { x: 800, y: 600 }, { pad: 0 });
        expect(r.bbox).toEqual([10, 20, 410, 320]);
        expect(r).toMatchObject({ width: 800, height: 600 });
    });

    it('clamps y to the Mercator extent and shrinks the height to match', () => {
        const top = MERCATOR_MAX - 100;
        const r = viewImageRequest(view(0, top - 1000, 1000, top), { x: 100, y: 100 }, { pad: 0.5 });
        expect(r.bbox[3]).toBe(MERCATOR_MAX);
        // 1000 m view at 10 m/px: 500 m padding below, only 100 m above
        expect(r.height).toBe(160);
        expect(r.width).toBe(200);
    });

    it('scales down to maxPx keeping the aspect ratio', () => {
        const r = viewImageRequest(view(0, 0, 4000, 2000), { x: 4000, y: 2000 }, { pad: 0.5, maxPx: 4096 });
        expect(r.width).toBe(4096);
        expect(r.height).toBe(2048);
        expect(r.bbox).toEqual([-2000, -1000, 6000, 3000]);
    });
});
