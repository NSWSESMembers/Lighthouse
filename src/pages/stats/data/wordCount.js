/*
  Word frequencies for the Situation On Scene word cloud.
*/

import { english as englishStopwords } from 'stopwords';

const STOPWORDS = new Set(englishStopwords);

/**
 * Lower-cased words of one situation, without punctuation, digits or stopwords.
 * @param {string} text
 * @returns {string[]}
 */
export function situationWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/object object/g, ' ')
    .replace(/[0-9]/g, ' ')
    .replace(/[^a-z'\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/**
 * @param {string[]} texts
 * @param {number} [limit=100]  keep the most frequent words only
 * @returns {Array<{text: string, weight: number}>}  most frequent first
 */
export function wordFrequencies(texts, limit = 100) {
  const counts = new Map();
  for (const text of texts) {
    for (const w of situationWords(text)) counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts]
    .map(([text, weight]) => ({ text, weight }))
    .sort((a, b) => b.weight - a.weight || a.text.localeCompare(b.text))
    .slice(0, limit);
}
