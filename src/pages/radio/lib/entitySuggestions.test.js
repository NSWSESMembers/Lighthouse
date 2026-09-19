import { describe, it, expect } from 'vitest';
import { rankEntitySuggestions, bestEntityMatch } from './entitySuggestions.js';

const entities = [
  { Id: 1, Name: 'Parramatta Unit', Code: 'PAR' },
  { Id: 2, Name: 'Parramatta Region', Code: 'PARR' },
  { Id: 3, Name: 'North Parramatta Unit', Code: 'NPAR' },
  { Id: 42, Name: 'Hillside Unit', Code: 'HLS' },
];

describe('rankEntitySuggestions', () => {
  it('returns nothing for an empty query', () => {
    expect(rankEntitySuggestions(entities, '')).toEqual([]);
  });

  it('matches by substring, case-insensitively', () => {
    const result = rankEntitySuggestions(entities, 'parra');
    expect(result).toHaveLength(3);
  });

  it('ranks prefix matches before mid-string matches', () => {
    const result = rankEntitySuggestions(entities, 'parramatta');
    expect(result[0].Name).toBe('Parramatta Region');
    expect(result[1].Name).toBe('Parramatta Unit');
    expect(result[2].Name).toBe('North Parramatta Unit');
  });

  it('caps results at the given limit', () => {
    expect(rankEntitySuggestions(entities, 'parra', 1)).toHaveLength(1);
  });

  it('matches by short code, case-insensitively', () => {
    const result = rankEntitySuggestions(entities, 'hls');
    expect(result).toEqual([entities[3]]);
  });

  it('matches an exact id even when it appears nowhere in the name/code', () => {
    const result = rankEntitySuggestions(entities, '42');
    expect(result).toEqual([entities[3]]);
  });

  it('includes a code-only prefix match alongside name prefix matches, not just name matches', () => {
    const result = rankEntitySuggestions([...entities, { Id: 5, Name: 'Something Else', Code: 'PARX' }], 'par');
    expect(result.map((e) => e.Id)).toEqual(expect.arrayContaining([1, 2, 3, 5]));
  });
});

describe('bestEntityMatch', () => {
  it('picks an exact (case-insensitive) name match over other candidates', () => {
    expect(bestEntityMatch(entities, 'parramatta unit')).toEqual(entities[0]);
  });

  it('picks the single result when there is only one', () => {
    expect(bestEntityMatch(entities, 'north')).toEqual(entities[2]);
  });

  it('picks the single prefix match when several substring matches exist but only one starts with the query', () => {
    expect(bestEntityMatch(entities, 'parramatta u')).toEqual(entities[0]);
  });

  it('refuses to guess when multiple equally-plausible matches exist', () => {
    expect(bestEntityMatch(entities, 'parra')).toBeNull();
  });

  it('returns null when nothing matches at all', () => {
    expect(bestEntityMatch(entities, 'nowhere')).toBeNull();
  });

  it('picks an exact short-code match', () => {
    expect(bestEntityMatch(entities, 'HLS')).toEqual(entities[3]);
  });

  it('picks an exact id match even when it matches no name/code', () => {
    expect(bestEntityMatch(entities, '42')).toEqual(entities[3]);
  });
});
