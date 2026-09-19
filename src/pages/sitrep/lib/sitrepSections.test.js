import { describe, it, expect } from 'vitest';
import { SITREP_SECTIONS, emptySectionCommentary } from './sitrepSections.js';

describe('SITREP_SECTIONS', () => {
  it('follows the template document order: Situation, Impact, Resources, Execution, Emerging Issues, Prognosis, Safety', () => {
    expect(SITREP_SECTIONS.map((s) => s.heading)).toEqual([
      'Situation',
      'Impact',
      'Resources',
      'Execution',
      'Emerging Issues',
      'Prognosis',
      'Safety',
    ]);
  });

  it('every section has a unique key and at least one guidance prompt', () => {
    const keys = SITREP_SECTIONS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    SITREP_SECTIONS.forEach((s) => expect(s.prompts.length).toBeGreaterThan(0));
  });
});

describe('emptySectionCommentary', () => {
  it('returns an empty string keyed by every section', () => {
    const result = emptySectionCommentary();
    expect(Object.keys(result)).toEqual(SITREP_SECTIONS.map((s) => s.key));
    Object.values(result).forEach((v) => expect(v).toBe(''));
  });
});
