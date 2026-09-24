import { describe, it, expect } from 'vitest';
import { resolveIsDark } from './theme.js';

describe('resolveIsDark', () => {
  it('is dark when mode is dark, regardless of system preference', () => {
    expect(resolveIsDark('dark', false)).toBe(true);
    expect(resolveIsDark('dark', true)).toBe(true);
  });

  it('is light when mode is light, regardless of system preference', () => {
    expect(resolveIsDark('light', true)).toBe(false);
    expect(resolveIsDark('light', false)).toBe(false);
  });

  it('follows the system preference when mode is system', () => {
    expect(resolveIsDark('system', true)).toBe(true);
    expect(resolveIsDark('system', false)).toBe(false);
  });
});
