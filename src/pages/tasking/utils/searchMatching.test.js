import { describe, it, expect } from 'vitest';
import { escapeRegExp, buildJobSuggestionPool, buildTeamSuggestionPool, buildSearchSuggestions, filterJobsBySearchTerm, filterTeamsBySearchTerm } from './searchMatching.js';

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

describe('buildSearchSuggestions', () => {
  const pool = [
    { label: 'Rescue at Parramatta', category: 'Situation' },
    { label: '14/7570', category: 'Identifier' },
  ];

  it('returns showSuggestions:false and no suggestions for empty input', () => {
    expect(buildSearchSuggestions(pool, '')).toEqual({ suggestions: [], showSuggestions: false });
    expect(buildSearchSuggestions(pool, '   ')).toEqual({ suggestions: [], showSuggestions: false });
  });

  it('always includes an exact "Search" row first, echoing the raw term', () => {
    const result = buildSearchSuggestions(pool, 'xyz-no-match');
    expect(result.suggestions[0]).toMatchObject({ label: 'xyz-no-match', category: 'Search', isExact: true });
  });

  it('matches on a word-boundary prefix for alphabetic tokens', () => {
    const result = buildSearchSuggestions(pool, 'rescue');
    expect(result.suggestions.some((s) => s.label === 'Rescue at Parramatta')).toBe(true);
  });

  it('does not match mid-word for alphabetic tokens (word-boundary only)', () => {
    const result = buildSearchSuggestions(pool, 'escue'); // mid-word substring of "Rescue"
    expect(result.suggestions.some((s) => s.label === 'Rescue at Parramatta')).toBe(false);
  });

  it('uses plain substring matching for numeric/punctuated tokens', () => {
    const result = buildSearchSuggestions(pool, '7570');
    expect(result.suggestions.some((s) => s.label === '14/7570')).toBe(true);
  });

  it('highlights the matched portion with <strong>', () => {
    const result = buildSearchSuggestions(pool, 'rescue');
    const hit = result.suggestions.find((s) => s.label === 'Rescue at Parramatta');
    expect(hit.highlightedLabel).toContain('<strong>Rescue</strong>');
  });

  it('escapes HTML in the label before highlighting', () => {
    const result = buildSearchSuggestions([{ label: '<script>alert(1)</script> rescue', category: 'x' }], 'rescue');
    const hit = result.suggestions.find((s) => s.category === 'x');
    expect(hit.highlightedLabel).not.toContain('<script>');
    expect(hit.highlightedLabel).toContain('&lt;script&gt;');
  });

  it('caps at 8 fuzzy matches', () => {
    const bigPool = Array.from({ length: 20 }, (_, i) => ({ label: `Rescue ${i}`, category: 'x' }));
    const result = buildSearchSuggestions(bigPool, 'rescue');
    // 8 matches + the leading exact "Search" row
    expect(result.suggestions).toHaveLength(9);
  });

  it('sets showSuggestions:true for a normal, non-empty term', () => {
    const result = buildSearchSuggestions(pool, 'rescue');
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

const team = (callsign, people = [], assets = []) => ({
  callsign: () => callsign,
  members: () => people.map(([FirstName, LastName, RegistrationNumber]) => ({ Person: { FirstName, LastName, RegistrationNumber } })),
  trackableAssets: () => assets.map(([name, plate, radioId]) => ({ name: () => name, licensePlate: () => plate, radioId: () => radioId })),
});

describe('buildTeamSuggestionPool', () => {
  it('lists callsigns first, then member names, deduplicated', () => {
    const pool = buildTeamSuggestionPool([
      team('BAN13', [['Alex', 'Rivers']], [['BAN13-RADIO', '-', 9900001]]),
      team('BAN14', [['Alex', 'Rivers'], ['Sam', 'Ng']], [['BAN14-RADIO', 'DM17XX', null]]),
    ]);
    expect(pool).toEqual([
      { label: 'BAN13', category: 'Callsign', anywhere: true },
      { label: 'BAN14', category: 'Callsign', anywhere: true },
      { label: 'Alex Rivers', category: 'Member' },
      { label: 'Sam Ng', category: 'Member' },
      { label: 'BAN13-RADIO', category: 'Asset', anywhere: true },
      { label: 'BAN14-RADIO', category: 'Asset', anywhere: true },
      { label: 'DM17XX', category: 'Plate', anywhere: true },
    ]);
  });

  it('suggests callsigns and plates on a partial match, member names only at a word start', () => {
    const pool = buildTeamSuggestionPool([team('BAN13', [['Alex', 'Rivers']], [['BAN13', 'DM17XX', null]])]);
    expect(buildSearchSuggestions(pool, 'n13').suggestions.map(x => x.label)).toEqual(['n13', 'BAN13']);
    expect(buildSearchSuggestions(pool, 'm17').suggestions.map(x => x.label)).toEqual(['m17', 'DM17XX']);
    expect(buildSearchSuggestions(pool, 'ivers').suggestions.map(x => x.label)).toEqual(['ivers']);
  });
});

describe('filterTeamsBySearchTerm', () => {
  const a = team('BAN13', [['Alex', 'Rivers', '40000001']], [['BANKSTOWN 13', 'DM17XX', 9900001]]);
  const b = team('WOL21', [['Sam', 'Ng', '40000002']]);

  it('returns every team unchanged for an empty term', () => {
    const teams = [a, b];
    expect(filterTeamsBySearchTerm(teams, '  ')).toBe(teams);
  });

  it('matches anywhere in the callsign', () => {
    expect(filterTeamsBySearchTerm([a, b], 'n13')).toEqual([a]);
    expect(filterTeamsBySearchTerm([a, b], 'wol')).toEqual([b]);
  });

  it('matches member names at the start of a word, and member numbers', () => {
    expect(filterTeamsBySearchTerm([a, b], 'riv')).toEqual([a]);
    expect(filterTeamsBySearchTerm([a, b], 'ivers')).toEqual([]);
    expect(filterTeamsBySearchTerm([a, b], '40000002')).toEqual([b]);
  });

  it("matches anywhere in a matched asset's name, plate or radio id", () => {
    expect(filterTeamsBySearchTerm([a, b], 'kstown')).toEqual([a]);
    expect(filterTeamsBySearchTerm([a, b], 'm17x')).toEqual([a]);
    expect(filterTeamsBySearchTerm([a, b], '9900001')).toEqual([a]);
  });

  it('requires every token to match, across callsign and members', () => {
    expect(filterTeamsBySearchTerm([a, b], 'ban alex')).toEqual([a]);
    expect(filterTeamsBySearchTerm([a, b], 'ban sam')).toEqual([]);
  });
});
