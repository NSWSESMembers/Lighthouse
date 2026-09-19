import { describe, it, expect } from 'vitest';
import { snippetsForSection, mergeSnippet } from './snippets.js';
import data from '../data/sectionSnippets.json';
import { SITREP_SECTIONS } from './sitrepSections.js';

describe('snippetsForSection', () => {
  it('returns well-formed entries and tolerates a missing section', () => {
    const d = { a: [{ label: 'L', text: 'T' }, { label: 'no text' }, null, { label: 'blank', text: '  ' }] };
    expect(snippetsForSection(d, 'a')).toEqual([{ label: 'L', text: 'T' }]);
    expect(snippetsForSection(d, 'missing')).toEqual([]);
    expect(snippetsForSection(null, 'a')).toEqual([]);
  });

  it('the shipped JSON has snippets for every sitrep section', () => {
    SITREP_SECTIONS.forEach((s) => expect(snippetsForSection(data, s.key).length).toBeGreaterThan(0));
  });
});

describe('mergeSnippet', () => {
  it('appends on its own line, or is just the snippet when empty', () => {
    expect(mergeSnippet('Existing.', 'New.')).toBe('Existing.\nNew.');
    expect(mergeSnippet('', 'New.')).toBe('New.');
    expect(mergeSnippet('Existing.\n\n', 'New.')).toBe('Existing.\nNew.');
  });
  it('does not add the same snippet twice', () => {
    expect(mergeSnippet('Existing.\nNew.', 'New.')).toBe('Existing.\nNew.');
  });
});
