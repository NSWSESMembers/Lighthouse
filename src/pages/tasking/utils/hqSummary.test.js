import { describe, it, expect } from 'vitest';
import { hqSearchUrl, pickHq } from './hqSummary.js';

const host = 'https://beacon.example.test';
const search = host + '/Api/v1/Entities/Search?EntityName=';
const page = '&PageIndex=1&PageSize=50';

describe('hqSearchUrl', () => {
  it('searches by unit code when there is one', () => {
    expect(hqSearchUrl(host, { code: 'ABC', name: 'North-South Example' })).toBe(search + 'ABC' + page);
  });

  it('falls back to the name, with spaces around hyphens, when there is no code', () => {
    expect(hqSearchUrl(host, { code: null, name: 'North-South Example' })).toBe(search + 'North%20-%20South%20Example' + page);
  });

  it('encodes awkward characters in the name', () => {
    expect(hqSearchUrl(host, { name: 'East\\West & Co' })).toBe(search + 'East%5CWest%20%26%20Co' + page);
  });
});

describe('pickHq', () => {
  // A code search also returns units whose names contain the code.
  const results = [
    { Id: 1, Code: 'XYZ', Name: 'Abcdale' },
    { Id: 2, Code: 'ABC', Name: 'Exampleton' },
  ];

  it('picks the result whose code matches exactly', () => {
    expect(pickHq(results, { code: 'abc' }).Id).toBe(2);
  });

  it('returns null when no result has the code', () => {
    expect(pickHq(results, { code: 'ZZZ' })).toBeNull();
  });

  it('prefers an exact name match for a name search, else the first result', () => {
    expect(pickHq(results, { name: 'exampleton' }).Id).toBe(2);
    expect(pickHq(results, { name: 'Somewhere' }).Id).toBe(1);
  });

  it('returns null for no results', () => {
    expect(pickHq([], { code: 'ABC' })).toBeNull();
    expect(pickHq(undefined, { name: 'x' })).toBeNull();
  });
});
