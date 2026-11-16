import { describe, it, expect } from 'vitest';
import { teamCapabilityCounts } from './teamCapabilities.js';

const member = (...names) => ({
    Person: { PersonCapabilityTags: names.map(Name => ({ Name, Description: `${Name} description` })) },
});

describe('teamCapabilityCounts', () => {
    it('counts the members holding each capability', () => {
        expect(teamCapabilityCounts([member('SWDH-ACC'), member('SWDH-ACC', 'CL1-ACC')])).toEqual([
            { code: 'CL1-ACC', label: 'Chainsaw L1 only', count: 1 },
            { code: 'SWDH-ACC', label: 'Storm Heights', count: 2 },
        ]);
    });

    it('does not count Storm Ground for a member who also has Storm Heights', () => {
        expect(teamCapabilityCounts([member('SWDG-ACC', 'SWDH-ACC'), member('SWDG-ACC')])).toEqual([
            { code: 'SWDH-ACC', label: 'Storm Heights', count: 1 },
            { code: 'SWDG-ACC', label: 'Storm Ground only', count: 1 },
        ]);
    });

    it('drops a capability only held by members who have superseded it', () => {
        expect(teamCapabilityCounts([member('SWDG-ACC', 'SWDH-ACC')]).map(c => c.code)).toEqual(['SWDH-ACC']);
    });

    it.each([
        ['CL1-ACC', 'CL2-ACC'],
        ['FRL1-ACC', 'FRL2-ACC'],
        ['FRL1-ACC', 'FRL3-ACC'],
        ['BOAT-ACC', 'FRL2-ACC'],
        ['HCV2-ACC', 'HCV3-ACC'],
        ['HCV1-ACC', 'HCV2-ACC'],
        ['HCV1-ACC', 'HCV3-ACC'],
        ['DRL2-ACC', 'DRL3-ACC'],
        ['DRL1-ACC', 'DRL2-ACC'],
        ['DRL1-ACC', 'DRL3-ACC'],
        ['JR', 'FO'],
        ['FO', 'FIELD-ACC'],
        ['JR', 'FIELD-ACC'],
        ['BEAI-ACC', 'BEAA-ACC'],
        ['BEAF-ACC', 'BEAI-ACC'],
        ['BEAF-ACC', 'BEAA-ACC'],
    ])('does not count %s for a member who also has %s', (lower, higher) => {
        expect(teamCapabilityCounts([member(lower, higher)]).map(c => c.code)).toEqual([higher]);
    });

    it.each([
        ['FRL2-ACC', 'FRL3-ACC'],
        ['FIELD-ACC', 'FTL-ACC'],
        ['LS-ACC', 'ASAR-ACC'],
        ['RCR-ACC', 'GLR2-ACC'],
        ['USAR1-ACC', 'GLR2-ACC'],
        ['BOAT-ACC', 'FRL3-ACC'],
    ])('counts %s and %s separately', (a, b) => {
        expect(teamCapabilityCounts([member(a, b)])).toHaveLength(2);
    });

    it.each([
        'SWDG-ACC', 'SWDH-ACC', 'CL1-ACC', 'CL2-ACC', 'FRL1-ACC', 'FRL2-ACC', 'FRL3-ACC', 'BOAT-ACC', 'USAR1-ACC',
        'RCR-ACC', 'GLR2-ACC', 'VR-ACC2', 'LAR-ACC', 'ASAR-ACC', 'LS-ACC', 'CFR-ACC',
    ])('does not count Field Operator, Foundations or Job Ready for a member with %s', (technical) => {
        expect(teamCapabilityCounts([member('JR', 'FO', 'FIELD-ACC', technical)]).map(c => c.code)).toEqual([technical]);
        expect(teamCapabilityCounts([member('JR', 'FO', technical)]).map(c => c.code)).toEqual([technical]);
        expect(teamCapabilityCounts([member('JR', technical)]).map(c => c.code)).toEqual([technical]);
    });

    it('counts each member once up the stack: Job Ready, Foundations, Field Operator, technical', () => {
        expect(teamCapabilityCounts([
            member('JR'),
            member('JR', 'FO'),
            member('JR', 'FO', 'FIELD-ACC'),
            member('JR', 'FO', 'FIELD-ACC', 'SWDG-ACC'),
        ]).map(c => [c.label, c.count])).toEqual([
            ['Storm Ground only', 1],
            ['Field Operator only', 1],
            ['Field Foundations only', 1],
            ['Job Ready only', 1],
        ]);
    });

    it('still counts Field Operator for a member with only a driver level or Field Team Leader', () => {
        expect(teamCapabilityCounts([member('FIELD-ACC', 'DRL1-ACC')]).map(c => c.code)).toEqual(['DRL1-ACC', 'FIELD-ACC']);
        expect(teamCapabilityCounts([member('FIELD-ACC', 'FTL-ACC')]).map(c => c.code)).toEqual(['FTL-ACC', 'FIELD-ACC']);
    });

    it('still counts Foundations for a member with only a driver level', () => {
        expect(teamCapabilityCounts([member('FO', 'DRL1-ACC')]).map(c => c.code)).toEqual(['DRL1-ACC', 'FO']);
    });

    it('never says "only" on a driver level, but still counts the highest', () => {
        expect(teamCapabilityCounts([member('DRL1-ACC'), member('DRL2-ACC'), member('DRL1-ACC', 'DRL3-ACC')]).map(c => [c.label, c.count]))
            .toEqual([['Driver L3', 1], ['Driver L2', 1], ['Driver L1', 1]]);
    });

    it('says "only" on a level that can be superseded, not on the top level', () => {
        expect(teamCapabilityCounts([member('HCV2-ACC'), member('HCV3-ACC')]).map(c => c.label))
            .toEqual(['HCV Flood', 'HCV General only']);
    });

    it('lists capabilities in table order whatever order Beacon sends them', () => {
        expect(teamCapabilityCounts([member('BEAF-ACC', 'SWDH-ACC', 'CL1-ACC', 'FRL1-ACC', 'DRL1-ACC')]).map(c => c.code))
            .toEqual(['DRL1-ACC', 'FRL1-ACC', 'CL1-ACC', 'SWDH-ACC', 'BEAF-ACC']);
    });

    it('counts a person once if Beacon repeats a tag', () => {
        expect(teamCapabilityCounts([member('CL1-ACC', 'CL1-ACC')])[0].count).toBe(1);
    });

    it('shows a tag missing from the table under its Beacon description, after the known ones', () => {
        expect(teamCapabilityCounts([member('NEW-ACC', 'CL1-ACC')])).toEqual([
            { code: 'CL1-ACC', label: 'Chainsaw L1 only', count: 1 },
            { code: 'NEW-ACC', label: 'NEW-ACC description', count: 1 },
        ]);
    });

    it('copes with members that have no person or tags', () => {
        expect(teamCapabilityCounts([{}, { Person: {} }])).toEqual([]);
        expect(teamCapabilityCounts(undefined)).toEqual([]);
    });
});
