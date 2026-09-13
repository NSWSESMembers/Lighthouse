import { describe, it, expect } from 'vitest';
import { parseSearchParams } from './urlParams.js';

describe('parseSearchParams', () => {
  it('parses a single key=value pair', () => {
    expect(parseSearchParams('source=abc')).toEqual({ source: 'abc' });
  });

  it('parses multiple pairs', () => {
    expect(parseSearchParams('a=1&b=2')).toEqual({ a: '1', b: '2' });
  });

  it('URL-decodes values', () => {
    expect(parseSearchParams('source=' + encodeURIComponent('https://a b'))).toEqual({ source: 'https://a b' });
  });

  it('does not decode keys', () => {
    const result = parseSearchParams('a%20b=1');
    expect(result['a%20b']).toBe('1');
  });
});
