import { describe, it, expect } from 'vitest';
import { suggestCallsigns } from './callsignSuggestions.js';

const teams = [{ Callsign: 'RESCUE1' }, { Callsign: 'RESCUE10' }, { Callsign: 'FLOOD2' }, { Callsign: 'GENERAL RESCUE' }];

describe('suggestCallsigns', () => {
  it('returns nothing for an empty query', () => {
    expect(suggestCallsigns(teams, '')).toEqual([]);
    expect(suggestCallsigns(teams, '   ')).toEqual([]);
  });

  it('matches by substring, case-insensitively', () => {
    const result = suggestCallsigns(teams, 'resc');
    expect(result.map((t) => t.Callsign)).toEqual(expect.arrayContaining(['RESCUE1', 'RESCUE10', 'GENERAL RESCUE']));
  });

  it('ranks prefix matches before mid-string matches', () => {
    const result = suggestCallsigns(teams, 'rescue');
    expect(result[0].Callsign).toBe('RESCUE1');
    expect(result[1].Callsign).toBe('RESCUE10');
    expect(result[result.length - 1].Callsign).toBe('GENERAL RESCUE');
  });

  it('caps results at the given limit', () => {
    expect(suggestCallsigns(teams, 'e', 2)).toHaveLength(2);
  });

  it('never restricts free text -- an unmatched query still lets the caller submit whatever they typed', () => {
    expect(suggestCallsigns(teams, 'not-a-known-callsign')).toEqual([]);
  });
});
