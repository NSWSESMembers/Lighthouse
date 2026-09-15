import { describe, it, expect } from 'vitest';
import { jobMatchesConfigFilters, teamMatchesConfigFilters, filterDescriptionsToEnumIds } from './configFilters.js';

function makeConfig(overrides = {}) {
    return {
        incidentFilters: () => [],
        sectorFilters: () => [],
        jobStatusFilter: () => [],
        allowedIncidentTypeIds: () => new Set(),
        fetchPeriod: () => 7,
        fetchForward: () => 1,
        applySectorsToIncidents: () => false,
        includeIncidentsWithoutSector: () => true,
        teamStatusFilter: () => [],
        teamTypeFilter: () => [],
        teamFilters: () => [],
        applySectorsToTeams: () => false,
        ...overrides,
    };
}

function makeJob(overrides = {}) {
    const now = new Date().toISOString();
    return {
        statusName: () => 'Active',
        entityAssignedTo: { id: () => 'hq1' },
        sector: () => ({ id: () => null }),
        typeId: () => '',
        jobReceived: () => now,
        ...overrides,
    };
}

function makeTeam(overrides = {}) {
    const now = new Date();
    return {
        teamStatusType: () => ({ Name: 'Active' }),
        assignedTo: () => ({ id: () => 'hq1' }),
        teamType: () => ({ Name: 'Field' }),
        sector: () => ({ id: () => null }),
        statusDate: () => now,
        ...overrides,
    };
}

describe('jobMatchesConfigFilters', () => {
    it('admits a job with no active filters', () => {
        expect(jobMatchesConfigFilters(makeJob(), makeConfig())).toBe(true);
    });

    it('filters by HQ allow-list', () => {
        const config = makeConfig({ incidentFilters: () => [{ id: 'hq2' }] });
        expect(jobMatchesConfigFilters(makeJob(), config)).toBe(false);
        expect(jobMatchesConfigFilters(makeJob({ entityAssignedTo: { id: () => 'hq2' } }), config)).toBe(true);
    });

    it('filters by job status allow-list', () => {
        const config = makeConfig({ jobStatusFilter: () => ['Tasked'] });
        expect(jobMatchesConfigFilters(makeJob({ statusName: () => 'Active' }), config)).toBe(false);
        expect(jobMatchesConfigFilters(makeJob({ statusName: () => 'Tasked' }), config)).toBe(true);
    });

    it('is lenient on incident type when the job type is not yet known (empty string)', () => {
        const config = makeConfig({ allowedIncidentTypeIds: () => new Set(['5']) });
        expect(jobMatchesConfigFilters(makeJob({ typeId: () => '' }), config)).toBe(true);
    });

    it('filters by incident type once the type is known', () => {
        const config = makeConfig({ allowedIncidentTypeIds: () => new Set(['5']) });
        expect(jobMatchesConfigFilters(makeJob({ typeId: () => '9' }), config)).toBe(false);
        expect(jobMatchesConfigFilters(makeJob({ typeId: () => '5' }), config)).toBe(true);
    });

    it('excludes a job outside the fetch period window', () => {
        const config = makeConfig({ fetchPeriod: () => 7, fetchForward: () => 1 });
        const old = makeJob({ jobReceived: () => new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString() });
        expect(jobMatchesConfigFilters(old, config)).toBe(false);
    });

    describe('sector filtering (only applied when applySectorsToIncidents)', () => {
        it('is ignored entirely when applySectorsToIncidents is false', () => {
            const config = makeConfig({ applySectorsToIncidents: () => false, sectorFilters: () => [{ id: 'secA' }] });
            expect(jobMatchesConfigFilters(makeJob({ sector: () => ({ id: () => null }) }), config)).toBe(true);
        });

        it('excludes a sectorless job when includeIncidentsWithoutSector is false', () => {
            const config = makeConfig({
                applySectorsToIncidents: () => true,
                sectorFilters: () => [{ id: 'secA' }],
                includeIncidentsWithoutSector: () => false,
            });
            expect(jobMatchesConfigFilters(makeJob({ sector: () => ({ id: () => null }) }), config)).toBe(false);
        });

        it('includes a sectorless job when includeIncidentsWithoutSector is true', () => {
            const config = makeConfig({
                applySectorsToIncidents: () => true,
                sectorFilters: () => [{ id: 'secA' }],
                includeIncidentsWithoutSector: () => true,
            });
            expect(jobMatchesConfigFilters(makeJob({ sector: () => ({ id: () => null }) }), config)).toBe(true);
        });

        it('excludes a job in a sector not in the allow-list', () => {
            const config = makeConfig({ applySectorsToIncidents: () => true, sectorFilters: () => [{ id: 'secA' }] });
            expect(jobMatchesConfigFilters(makeJob({ sector: () => ({ id: () => 'secB' }) }), config)).toBe(false);
        });
    });
});

describe('teamMatchesConfigFilters', () => {
    it('admits a team with no active filters', () => {
        expect(teamMatchesConfigFilters(makeTeam(), makeConfig())).toBe(true);
    });

    it('rejects a team with no status', () => {
        expect(teamMatchesConfigFilters(makeTeam({ teamStatusType: () => null }), makeConfig())).toBe(false);
    });

    it('filters by team status allow-list', () => {
        const config = makeConfig({ teamStatusFilter: () => ['Activated'] });
        expect(teamMatchesConfigFilters(makeTeam({ teamStatusType: () => ({ Name: 'Active' }) }), config)).toBe(false);
        expect(teamMatchesConfigFilters(makeTeam({ teamStatusType: () => ({ Name: 'Activated' }) }), config)).toBe(true);
    });

    it('filters by team type allow-list, leniently when the type is unknown', () => {
        const config = makeConfig({ teamTypeFilter: () => ['Aviation'] });
        expect(teamMatchesConfigFilters(makeTeam({ teamType: () => ({ Name: 'Field' }) }), config)).toBe(false);
        expect(teamMatchesConfigFilters(makeTeam({ teamType: () => null }), config)).toBe(true);
    });

    it('filters by HQ allow-list', () => {
        const config = makeConfig({ teamFilters: () => [{ id: 'hq2' }] });
        expect(teamMatchesConfigFilters(makeTeam(), config)).toBe(false);
        expect(teamMatchesConfigFilters(makeTeam({ assignedTo: () => ({ id: () => 'hq2' }) }), config)).toBe(true);
    });

    it('excludes a team outside the fetch period window', () => {
        const config = makeConfig();
        const old = makeTeam({ statusDate: () => new Date(Date.now() - 30 * 24 * 3600 * 1000) });
        expect(teamMatchesConfigFilters(old, config)).toBe(false);
    });

    describe('sector filtering (only applied when applySectorsToTeams)', () => {
        it('is ignored entirely when applySectorsToTeams is false', () => {
            const config = makeConfig({ applySectorsToTeams: () => false, sectorFilters: () => [{ id: 'secA' }] });
            expect(teamMatchesConfigFilters(makeTeam({ sector: () => ({ id: () => null }) }), config)).toBe(true);
        });

        it('excludes a sectorless team when includeIncidentsWithoutSector is false', () => {
            const config = makeConfig({
                applySectorsToTeams: () => true,
                sectorFilters: () => [{ id: 'secA' }],
                includeIncidentsWithoutSector: () => false,
            });
            expect(teamMatchesConfigFilters(makeTeam({ sector: () => ({ id: () => null }) }), config)).toBe(false);
        });

        it('excludes a team in a sector not in the allow-list', () => {
            const config = makeConfig({ applySectorsToTeams: () => true, sectorFilters: () => [{ id: 'secA' }] });
            expect(teamMatchesConfigFilters(makeTeam({ sector: () => ({ id: () => 'secB' }) }), config)).toBe(false);
        });
    });
});

describe('filterDescriptionsToEnumIds', () => {
    const enumMap = {
        A: { Id: 1, Name: 'nameA', Description: 'descA' },
        B: { Id: 2, Name: 'nameB', Description: 'descB' },
    };

    it('resolves by Description (default)', () => {
        expect(filterDescriptionsToEnumIds(['descA', 'descB'], enumMap)).toEqual([1, 2]);
    });

    it('resolves by Name when specified', () => {
        expect(filterDescriptionsToEnumIds(['nameA'], enumMap, 'Name')).toEqual([1]);
    });

    it('drops entries that do not resolve', () => {
        expect(filterDescriptionsToEnumIds(['descA', 'unknown'], enumMap)).toEqual([1]);
    });

    it('returns [] for an empty/missing input', () => {
        expect(filterDescriptionsToEnumIds([], enumMap)).toEqual([]);
        expect(filterDescriptionsToEnumIds(undefined, enumMap)).toEqual([]);
    });
});
