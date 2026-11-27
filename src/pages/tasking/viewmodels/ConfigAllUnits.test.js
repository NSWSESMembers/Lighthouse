// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigVM } from './Config.js';
import { taskingConfigKey } from '../utils/taskingConfigStorage.js';

const FOCUS = 123;

function makeConfig({ requireHqFilter = true } = {}) {
    return new ConfigVM({}, {
        requireHqFilter,
        defaultHqId: String(FOCUS),
        beaconEnvironment: requireHqFilter ? 'production' : 'train',
        entity: () => Promise.resolve(null),
        entitiesChildren: () => Promise.resolve([]),
        entitiesSearch: () => Promise.resolve([]),
        fetchAllSectors: () => {},
    });
}

const ids = (arr) => arr().map(f => f.id);
const saved = () => JSON.parse(localStorage.getItem(taskingConfigKey('production')));

beforeEach(() => localStorage.clear());

describe('Config: all units (holding Clear on Production)', () => {
    it('empties the list without the focus unit coming back, and lets the modal close', () => {
        const c = makeConfig();
        expect(ids(c.teamFilters)).toEqual([FOCUS]);

        c.allUnitsTeams();
        expect(ids(c.teamFilters)).toEqual([]);
        expect(c.teamsAllUnitsShown()).toBe(true);
        expect(c.teamsEmptyHint()).toMatch(/^All units/);
        expect(c.hqFilterMissing()).toBe(false);
        // incidents are untouched
        expect(ids(c.incidentFilters)).toEqual([FOCUS]);
    });

    it('is saved and restored', () => {
        const c = makeConfig();
        c.allUnitsTeams();
        c.save();
        expect(saved().locationFilters).toMatchObject({ teams: [], teamsAllUnits: true, incidentsAllUnits: false });

        const reloaded = makeConfig();
        expect(ids(reloaded.teamFilters)).toEqual([]);
        expect(reloaded.teamsAllUnits()).toBe(true);
        expect(ids(reloaded.incidentFilters)).toEqual([FOCUS]);
    });

    it('a normal Clear goes back to the focus unit', () => {
        const c = makeConfig();
        c.allUnitsIncidents();
        c.clearIncidents();
        expect(ids(c.incidentFilters)).toEqual([FOCUS]);
        expect(c.incidentsAllUnits()).toBe(false);
    });

    it('adding a headquarters ends it, and removing that one falls back to the focus unit', () => {
        const c = makeConfig();
        c.allUnitsTeams();
        c.addTeam({ id: 9, name: 'Somewhere Unit', entityType: 0 });
        expect(c.teamsAllUnits()).toBe(false);
        expect(ids(c.teamFilters)).toEqual([9]);

        c.removeTeam({ id: 9 });
        expect(ids(c.teamFilters)).toEqual([FOCUS]);
    });

    it('adding to both lists ends it for both', () => {
        const c = makeConfig();
        c.allUnitsTeams();
        c.allUnitsIncidents();
        c.addTeamAndIncident({ id: 9, name: 'Somewhere Unit', entityType: 0 });
        expect(c.teamsAllUnits()).toBe(false);
        expect(c.incidentsAllUnits()).toBe(false);
    });

    it('ignores a saved flag when the saved list has headquarters', () => {
        localStorage.setItem(taskingConfigKey('production'), JSON.stringify({
            locationFilters: { teams: [{ id: 9, name: 'Somewhere Unit', entityType: 0 }], incidents: [], teamsAllUnits: true },
        }));
        const c = makeConfig();
        expect(c.teamsAllUnits()).toBe(false);
        expect(ids(c.teamFilters)).toEqual([9]);
    });

    it('keeps Clear enabled on Production so it can be held', () => {
        const c = makeConfig();
        c.allUnitsTeams();
        expect(c.teamsClearEnabled()).toBe(true);
        expect(makeConfig({ requireHqFilter: false }).teamsClearEnabled()).toBe(false);
    });
});
