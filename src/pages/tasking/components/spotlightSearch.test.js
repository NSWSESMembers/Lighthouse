import { describe, it, expect } from 'vitest';
import ko from 'knockout';
import { findAssetsByCallsign } from './spotlightSearch.js';

const asset = (name, { radioId = '', satelliteId = '' } = {}) => ({
    name: ko.observable(name),
    radioId: ko.observable(radioId),
    satelliteId: ko.observable(satelliteId),
});

const names = (list) => list.map((a) => a.name());

describe('findAssetsByCallsign', () => {
    const assets = [asset('DEM12'), asset('XDEM1'), asset('DEM1'), asset('BOAT3', { radioId: 9900123, satelliteId: '0-990077' })];

    it('matches callsigns containing the query, ignoring case and spaces, starts-with first', () => {
        expect(names(findAssetsByCallsign(assets, 'dem1'))).toEqual(['DEM1', 'DEM12', 'XDEM1']);
        expect(names(findAssetsByCallsign(assets, 'DEM 12'))).toEqual(['DEM12']);
    });

    it('matches PSN radio IDs and satellite IDs', () => {
        expect(names(findAssetsByCallsign(assets, '9900123'))).toEqual(['BOAT3']);
        expect(names(findAssetsByCallsign(assets, '990077'))).toEqual(['BOAT3']);
    });

    it('returns nothing for an empty query or no match, and respects the limit', () => {
        expect(findAssetsByCallsign(assets, '  ')).toEqual([]);
        expect(findAssetsByCallsign(assets, 'zzz')).toEqual([]);
        expect(findAssetsByCallsign(assets, 'dem', 2)).toHaveLength(2);
    });
});
