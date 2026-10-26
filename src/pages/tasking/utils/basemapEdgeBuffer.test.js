import { describe, it, expect } from 'vitest';
import { withEdgeBuffer, basemapEdgeBufferRows } from './basemapEdgeBuffer.js';

// Minimal stand-ins for L.Point / L.Bounds
const pt = (x, y) => ({
  x, y,
  add: (p) => pt(x + p.x, y + p.y),
  subtract: (p) => pt(x - p.x, y - p.y),
  multiplyBy: (n) => pt(x * n, y * n),
});
const bounds = (min, max) => ({
  min, max,
  extend(p) {
    this.min = pt(Math.min(this.min.x, p.x), Math.min(this.min.y, p.y));
    this.max = pt(Math.max(this.max.x, p.x), Math.max(this.max.y, p.y));
    return this;
  },
});
const fakeLayer = () => ({
  getTileSize: () => pt(256, 256),
  _getTiledPixelBounds: () => bounds(pt(1000, 2000), pt(2920, 3080)),
});

describe('withEdgeBuffer', () => {
  it('pads the tiled pixel bounds by one tile per edge', () => {
    const b = withEdgeBuffer(fakeLayer(), () => 1)._getTiledPixelBounds();
    expect([b.min.x, b.min.y, b.max.x, b.max.y]).toEqual([744, 1744, 3176, 3336]);
  });

  it('pads by the given number of tile rows', () => {
    const b = withEdgeBuffer(fakeLayer(), () => 2)._getTiledPixelBounds();
    expect([b.min.x, b.min.y, b.max.x, b.max.y]).toEqual([488, 1488, 3432, 3592]);
  });

  it('leaves the bounds alone when the buffer is off', () => {
    const b = withEdgeBuffer(fakeLayer(), () => 0)._getTiledPixelBounds();
    expect([b.min.x, b.min.y, b.max.x, b.max.y]).toEqual([1000, 2000, 2920, 3080]);
  });

  it('re-reads the row count on every update', () => {
    let rows = 1;
    const layer = withEdgeBuffer(fakeLayer(), () => rows);
    expect(layer._getTiledPixelBounds().min.x).toBe(744);
    rows = 0;
    expect(layer._getTiledPixelBounds().min.x).toBe(1000);
  });

  it('only patches the layer it is given', () => {
    const other = fakeLayer();
    withEdgeBuffer(fakeLayer());
    expect(other._getTiledPixelBounds().min.x).toBe(1000);
  });
});

describe('basemapEdgeBufferRows', () => {
  it('prefetches one row on fast or unreported connections', () => {
    expect(basemapEdgeBufferRows(undefined)).toBe(1);
    expect(basemapEdgeBufferRows({ effectiveType: '4g' })).toBe(1);
    expect(basemapEdgeBufferRows({})).toBe(1);
  });

  it('turns off on slow connections', () => {
    expect(basemapEdgeBufferRows({ effectiveType: '3g' })).toBe(0);
    expect(basemapEdgeBufferRows({ effectiveType: '2g' })).toBe(0);
    expect(basemapEdgeBufferRows({ effectiveType: 'slow-2g' })).toBe(0);
  });

  it('turns off when the user asks to save data', () => {
    expect(basemapEdgeBufferRows({ effectiveType: '4g', saveData: true })).toBe(0);
  });
});
