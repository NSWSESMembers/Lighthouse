import { describe, it, expect } from 'vitest';
import { situationWords, wordFrequencies } from './wordCount.js';

describe('situationWords', () => {
  it('lower-cases and drops punctuation, digits and stopwords', () => {
    expect(situationWords('Tree DOWN on the roof, 2 cars!')).toEqual(['tree', 'roof', 'cars']);
  });

  it('splits on slashes and strips stray quotes/dashes', () => {
    expect(situationWords("Tree/branch -- 'leaking'")).toEqual(['tree', 'branch', 'leaking']);
  });

  it('drops stringified objects and one-letter words', () => {
    expect(situationWords('[object Object] x roof')).toEqual(['roof']);
  });

  it('copes with nothing', () => {
    expect(situationWords(null)).toEqual([]);
  });
});

describe('wordFrequencies', () => {
  it('counts across texts, most frequent first, ties alphabetical', () => {
    expect(wordFrequencies(['roof leaking', 'tree roof', 'tree'])).toEqual([
      { text: 'roof', weight: 2 },
      { text: 'tree', weight: 2 },
      { text: 'leaking', weight: 1 },
    ]);
  });

  it('keeps only the top words', () => {
    expect(wordFrequencies(['alpha beta gamma'], 2)).toHaveLength(2);
  });
});
