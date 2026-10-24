import { describe, it, expect } from 'vitest';
import { basemapKeepBuffer } from './basemapKeepBuffer.js';

describe('basemapKeepBuffer', () => {
  it('keeps more tiles on machines with more memory', () => {
    expect(basemapKeepBuffer(8)).toBe(6);
    expect(basemapKeepBuffer(4)).toBe(4);
    expect(basemapKeepBuffer(2)).toBe(2);
    expect(basemapKeepBuffer(0.5)).toBe(2);
  });

  it('uses the middle value when memory is not reported', () => {
    expect(basemapKeepBuffer(undefined)).toBe(4);
    expect(basemapKeepBuffer(0)).toBe(4);
    expect(basemapKeepBuffer(NaN)).toBe(4);
  });
});
