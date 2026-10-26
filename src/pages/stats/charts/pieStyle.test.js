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
