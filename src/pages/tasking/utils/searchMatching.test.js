import { describe, it, expect } from 'vitest';
import { escapeRegExp, buildJobSuggestionPool, buildJobSearchSuggestions, filterJobsBySearchTerm } from './searchMatching.js';

describe('escapeRegExp', () => {
  it('escapes regex metacharacters', () => {
    // hyphen isn't in the escaped set (only meaningful inside a char class),
    // so it passes through untouched -- only the dot gets escaped here.
    expect(escapeRegExp('14-7570.5')).toBe('14-7570\\.5');
    const rx = new RegExp(escapeRegExp('a.b'));
    expect(rx.test('axb')).toBe(false);
    expect(rx.test('a.b')).toBe(true);
  });
});

function job(overrides = {}) {
  return {
    identifierTrimmed: () => '',
    identifier: () => '',
    id: () => '',
    address: { prettyAddress: () => '' },
    lga: () => '',
    entityAssignedTo: { code: () => '' },
    situationOnScene: () => '',
    contactFirstName: () => '',
    contactLastName: () => '',
    callerFirstName: () => '',
    callerLastName: () => '',
    incidentContactNumber: () => '',
    icemsIncidentIdentifier: () => '',
    tagsCsv: () => '',
    ...overrides,
  };
}

describe('buildJobSuggestionPool', () => {
  it('pulls identifier, id, address, lga, hq, situation, contact and icems fields', () => {
    const j = job({
      identifierTrimmed: () => '14/7570',
      id: () => 'j1',
      address: { prettyAddress: () => '1 Main St' },
      lga: () => 'Sydney',
      entityAssignedTo: { code: () => 'HQ1' },
      situationOnScene: () => 'Tree down',
      contactFirstName: () => 'Jane',
      contactLastName: () => 'Doe',
      icemsIncidentIdentifier: () => '6/1718',
    });
    const pool = buildJobSuggestionPool([j]);
    expect(pool).toContainEqual({ label: '14/7570', category: 'Identifier' });
    expect(pool).toContainEqual({ label: '1 Main St', category: 'Address' });
    expect(pool).toContainEqual({ label: 'Jane Doe', category: 'Contact' });
    expect(pool).toContainEqual({ label: '6/1718', category: 'ICEMS' });
  });

  it('skips empty/falsy values', () => {
    const pool = buildJobSuggestionPool([job()]);
    expect(pool.find((p) => p.category === 'Identifier')).toBeUndefined();
  });

  it('deduplicates case-insensitively across jobs, keeping the first casing seen', () => {
    const pool = buildJobSuggestionPool([
      job({ lga: () => 'Sydney' }),
      job({ lga: () => 'SYDNEY' }),
    ]);
    expect(pool.filter((p) => p.category === 'LGA')).toEqual([{ label: 'Sydney', category: 'LGA' }]);
  });

  it('returns [] for an empty/missing jobs array', () => {
    expect(buildJobSuggestionPool([])).toEqual([]);
    expect(buildJobSuggestionPool(null)).toEqual([]);
  });
});

describe('buildJobSearchSuggestions', () => {
  const pool = [
    { label: 'Rescue at Parramatta', category: 'Situation' },
    { label: '14/7570', category: 'Identifier' },
  ];

  it('returns showSuggestions:false and no suggestions for empty input', () => {
    expect(buildJobSearchSuggestions(pool, '')).toEqual({ suggestions: [], showSuggestions: false });
    expect(buildJobSearchSuggestions(pool, '   ')).toEqual({ suggestions: [], showSuggestions: false });
  });

  it('always includes an exact "Search" row first, echoing the raw term', () => {
    const result = buildJobSearchSuggestions(pool, 'xyz-no-match');
    expect(result.suggestions[0]).toMatchObject({ label: 'xyz-no-match', category: 'Search', isExact: true });
  });

  it('matches on a word-boundary prefix for alphabetic tokens', () => {
    const result = buildJobSearchSuggestions(pool, 'rescue');
    expect(result.suggestions.some((s) => s.label === 'Rescue at Parramatta')).toBe(true);
  });

  it('does not match mid-word for alphabetic tokens (word-boundary only)', () => {
    const result = buildJobSearchSuggestions(pool, 'escue'); // mid-word substring of "Rescue"
    expect(result.suggestions.some((s) => s.label === 'Rescue at Parramatta')).toBe(false);
  });

  it('uses plain substring matching for numeric/punctuated tokens', () => {
    const result = buildJobSearchSuggestions(pool, '7570');
    expect(result.suggestions.some((s) => s.label === '14/7570')).toBe(true);
  });

  it('highlights the matched portion with <strong>', () => {
    const result = buildJobSearchSuggestions(pool, 'rescue');
    const hit = result.suggestions.find((s) => s.label === 'Rescue at Parramatta');
    expect(hit.highlightedLabel).toContain('<strong>Rescue</strong>');
  });

  it('escapes HTML in the label before highlighting', () => {
    const result = buildJobSearchSuggestions([{ label: '<script>alert(1)</script> rescue', category: 'x' }], 'rescue');
    const hit = result.suggestions.find((s) => s.category === 'x');
    expect(hit.highlightedLabel).not.toContain('<script>');
    expect(hit.highlightedLabel).toContain('&lt;script&gt;');
  });

  it('caps at 8 fuzzy matches', () => {
    const bigPool = Array.from({ length: 20 }, (_, i) => ({ label: `Rescue ${i}`, category: 'x' }));
    const result = buildJobSearchSuggestions(bigPool, 'rescue');
    // 8 matches + the leading exact "Search" row
    expect(result.suggestions).toHaveLength(9);
  });

  it('sets showSuggestions:true for a normal, non-empty term', () => {
    const result = buildJobSearchSuggestions(pool, 'rescue');
    expect(result.showSuggestions).toBe(true);
  });
});

describe('filterJobsBySearchTerm', () => {
  it('returns every job unchanged for an empty term', () => {
    const jobs = [job(), job()];
    expect(filterJobsBySearchTerm(jobs, '')).toBe(jobs);
  });

  it('matches a single alphabetic token against any searchable field', () => {
    const match = job({ situationOnScene: () => 'Tree down on roof' });
    const noMatch = job({ situationOnScene: () => 'Flooded driveway' });
    const result = filterJobsBySearchTerm([match, noMatch], 'tree');
    expect(result).toEqual([match]);
  });

  it('requires every token to match (AND across tokens, possibly different fields)', () => {
    const j = job({ situationOnScene: () => 'Rescue', lga: () => 'Parramatta' });
    expect(filterJobsBySearchTerm([j], 'rescue parramatta')).toEqual([j]);
    expect(filterJobsBySearchTerm([j], 'rescue nonexistentplace')).toEqual([]);
  });

  it('matches a numeric token as a plain substring, not word-boundary', () => {
    const j = job({ identifier: () => 'J-00123' });
    expect(filterJobsBySearchTerm([j], '123')).toEqual([j]);
  });

  it('does not word-boundary-match an alphabetic token mid-word', () => {
    const j = job({ lga: () => 'street' });
    expect(filterJobsBySearchTerm([j], 'tree')).toEqual([]);
  });

  it('is case-insensitive', () => {
    const j = job({ lga: () => 'Sydney' });
    expect(filterJobsBySearchTerm([j], 'SYDNEY')).toEqual([j]);
  });
});
