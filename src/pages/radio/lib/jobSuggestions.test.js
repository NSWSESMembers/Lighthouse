import { describe, it, expect } from 'vitest';
import { rankJobSuggestions } from './jobSuggestions.js';

const jobs = [
  { Id: 1, Identifier: '6/1718', Address: { PrettyAddress: '12 Smith St, Parramatta' }, JobType: { Name: 'Storm Damage' } },
  { Id: 2, Identifier: '6/1720', Address: { PrettyAddress: '5 Church Rd, Parramatta' }, JobType: { Name: 'Tree Down' } },
  { Id: 3, Identifier: '7/0042', Address: { PrettyAddress: '1 High St, Blacktown' }, JobType: { Name: 'Flood' } },
];

describe('rankJobSuggestions', () => {
  it('returns nothing for an empty query', () => {
    expect(rankJobSuggestions(jobs, '')).toEqual([]);
  });

  it('matches by identifier substring', () => {
    expect(rankJobSuggestions(jobs, '1718')).toEqual([jobs[0]]);
  });

  it('matches by raw job id substring (parity with LAD\'s job lookup)', () => {
    expect(rankJobSuggestions(jobs, '3')).toEqual([jobs[2]]);
  });

  it('matches by address substring', () => {
    const result = rankJobSuggestions(jobs, 'parramatta');
    expect(result).toHaveLength(2);
  });

  it('ranks identifier-prefix matches first', () => {
    const result = rankJobSuggestions(jobs, '6/17');
    expect(result[0].Identifier).toBe('6/1718');
    expect(result[1].Identifier).toBe('6/1720');
  });

  it('caps results at the given limit', () => {
    expect(rankJobSuggestions(jobs, 'a', 1)).toHaveLength(1);
  });

  it('does not crash on a job missing Address/JobType', () => {
    expect(() => rankJobSuggestions([{ Id: 9, Identifier: '9/0001' }], '9/0001')).not.toThrow();
  });
});
