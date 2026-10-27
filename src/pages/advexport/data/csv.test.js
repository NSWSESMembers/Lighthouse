import { describe, it, expect } from 'vitest';
import { csvField, toCsv, fileName } from './csv.js';

describe('csvField', () => {
  it('quotes everything, doubles quotes and flattens line breaks', () => {
    expect(csvField('plain')).toBe('"plain"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('one\r\ntwo\nthree')).toBe('"one two three"');
    expect(csvField(0)).toBe('"0"');
    expect(csvField(false)).toBe('"false"');
    expect(csvField(null)).toBe('""');
    expect(csvField(undefined)).toBe('""');
  });
});

describe('toCsv', () => {
  it('writes a header line and a line per row', () => {
    expect(toCsv(['A', 'B'], [[1, 'x'], ['', 'y,z']])).toBe('"A","B"\n"1","x"\n"","y,z"\n');
  });

  it('is just the header with no rows', () => {
    expect(toCsv(['A'], [])).toBe('"A"\n');
  });
});

describe('fileName', () => {
  it('names the scope and time, without characters Windows refuses', () => {
    expect(fileName('Demo City', '2026-10-27 1015')).toBe('Incident export - Demo City - 2026-10-27 1015.csv');
    expect(fileName('A/B: "C"', '2026-10-27 1015')).toBe('Incident export - A-B- -C- - 2026-10-27 1015.csv');
  });
});
