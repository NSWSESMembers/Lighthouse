import { describe, it, expect } from 'vitest';
import { buildLocationLabel } from './locationLabel.js';

const u = (id, name) => ({ id, name });

describe('buildLocationLabel', () => {
  it('is the name for a single HQ, empty for none', () => {
    expect(buildLocationLabel([u(1, 'Parramatta Unit')])).toBe('Parramatta Unit');
    expect(buildLocationLabel([])).toBe('');
  });
  it('lists several HQs together', () => {
    expect(buildLocationLabel([u(1, 'A'), u(2, 'B')])).toBe('A, B');
  });
  it('shows an expanded parent by name with its child count', () => {
    expect(buildLocationLabel([u(1, 'Region HQ'), u(2, 'C1'), u(3, 'C2')], { 2: 1, 3: 1 })).toBe('Region HQ (2 HQs)');
  });
  it('counts nested descendants under the top parent', () => {
    expect(buildLocationLabel([u(1, 'Region'), u(2, 'Cluster'), u(3, 'Unit')], { 2: 1, 3: 2 })).toBe('Region (2 HQs)');
  });
  it('mixes an expanded parent with other HQs', () => {
    expect(buildLocationLabel([u(1, 'Region'), u(2, 'C1'), u(9, 'Other')], { 2: 1 })).toBe('Region (1 HQ), Other');
  });
  it('lets a child stand alone once its parent is removed', () => {
    expect(buildLocationLabel([u(2, 'C1'), u(3, 'C2')], { 2: 1, 3: 1 })).toBe('C1, C2');
  });
});
