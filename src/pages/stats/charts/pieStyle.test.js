import { describe, it, expect } from 'vitest';
import { pieColors, percentText, PIE_PALETTE, OTHERS_COLOR, OTHERS_LABEL } from './pieStyle.js';

describe('pieColors', () => {
  it('gives the initial keys the palette in order', () => {
    const color = pieColors(['Storm', 'Support']);
    expect(color('Storm')).toBe(PIE_PALETTE[0]);
    expect(color('Support')).toBe(PIE_PALETTE[1]);
  });

  it('keeps a key\'s colour and gives new keys the next one', () => {
    const color = pieColors(['A']);
    expect(color('B')).toBe(PIE_PALETTE[1]);
    expect(color('A')).toBe(PIE_PALETTE[0]);
    expect(color('B')).toBe(PIE_PALETTE[1]);
  });

  it('never repeats a colour within the palette size', () => {
    const color = pieColors();
    const seen = Array.from({ length: PIE_PALETTE.length }, (_, i) => color(`k${i}`));
    expect(new Set(seen).size).toBe(PIE_PALETTE.length);
  });

  it('keeps grey for Others, out of the palette', () => {
    expect(pieColors()(OTHERS_LABEL)).toBe(OTHERS_COLOR);
    expect(PIE_PALETTE).not.toContain(OTHERS_COLOR);
  });

  it('fit() moves a shown key off a colour a bigger shown slice has', () => {
    // The 1st and 19th keys share a colour when there are more keys than colours.
    const keys = Array.from({ length: PIE_PALETTE.length + 1 }, (_, i) => `k${i}`);
    const color = pieColors(keys);
    expect(color('k0')).toBe(color(`k${PIE_PALETTE.length}`));
    color.fit(['k0', `k${PIE_PALETTE.length}`, 'k1', OTHERS_LABEL]);
    expect(color('k0')).toBe(PIE_PALETTE[0]);
    expect(color(`k${PIE_PALETTE.length}`)).not.toBe(color('k0'));
    expect(color(`k${PIE_PALETTE.length}`)).not.toBe(color('k1'));
    expect(color(OTHERS_LABEL)).toBe(OTHERS_COLOR);
  });

  it('fit() leaves distinct colours alone, and keeps a moved key stable', () => {
    const keys = Array.from({ length: 25 }, (_, i) => `k${i}`);
    const color = pieColors(keys);
    color.fit(['k0', 'k1', 'k2']);
    expect([color('k0'), color('k1'), color('k2')]).toEqual(PIE_PALETTE.slice(0, 3));
    color.fit(['k0', 'k18', 'k5']);
    const moved = color('k18');
    color.fit(['k0', 'k18', 'k5']);
    expect(color('k18')).toBe(moved);
  });

  it('fit() never shows two slices with one colour, whatever is shown', () => {
    const keys = Array.from({ length: 60 }, (_, i) => `k${i}`);
    const color = pieColors(keys);
    for (let start = 0; start < 50; start += 7) {
      const shown = Array.from({ length: 9 }, (_, i) => `k${(start + i * 18) % 60}`);
      color.fit(shown);
      expect(new Set(shown.map(color)).size).toBe(shown.length);
    }
  });

  it('gives each chart its own sequence', () => {
    expect(pieColors(['x'])('x')).toBe(pieColors(['y'])('y'));
  });
});

describe('percentText', () => {
  it('rounds to whole percent', () => {
    expect(percentText(1, 3)).toBe('33%');
    expect(percentText(2, 2)).toBe('100%');
  });

  it('shows slivers as <1%', () => {
    expect(percentText(1, 1000)).toBe('<1%');
    expect(percentText(0, 10)).toBe('0%');
  });

  it('is blank with no total', () => {
    expect(percentText(0, 0)).toBe('');
  });
});
