// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Asset } from '../models/Asset.js';
import { assetColor, assetCapabilityCode, assetCapabilityName, buildIcon, vesselClass } from './asset_icon.js';

// Shaped like a ResourceLocations/Radio feature (see BeaconClient/asset.js);
// every value is invented.
function makeFeature(properties = {}) {
    return {
        type: 'Feature',
        id: 9101,
        geometry: { type: 'Point', coordinates: [151.0, -33.8] },
        markerLabel: 'DMB<br>701',
        properties: {
            type: 'Feature', id: 9101, name: 'DMB701', capability: 'Class 3', entity: 'Demo City',
            resourceType: 'Vessel', sourceType: 'SAP', licensePlate: null, serialNumber: '000DEMO701',
            radioId: 9900701, equipmentId: '99000701', lastSeen: '2026-10-05T11:55:52', status: 'COMM',
            direction: 16, talkgroup: 'DEMO DISP', talkgroupLastUpdated: '2026-10-05T07:55:28',
            smartConnect: 'ACTIVE', radioLatitude: -33.8, radioLongitude: 151.0,
            radioLocationLastUpdated: '2026-10-05T11:55:52',
            satelliteId: '0-9900701', satelliteBattery: null, satelliteLatitude: null, satelliteLongitude: null,
            satelliteClass: 'Class 3 550 Demo Hull', satelliteEquipmentId: '99100701',
            satelliteLocationLastUpdated: null, satelliteClassType: 'Class 3 550 Demo Hull', satelliteStatus: 'ACTIVE',
            ...properties,
        },
    };
}
const makeAsset = (properties) => new Asset(makeFeature(properties));

describe('vessels whose capability is their class', () => {
    it('are coloured and coded as vessels by their resourceType', () => {
        const a = makeAsset();
        expect(assetColor(a)).toBe('#0288D1');
        // The fixture is Class 3; without the class it's plain VES.
        expect(assetCapabilityCode(a)).toBe('VC3');
        expect(assetCapabilityCode(a, { withClass: false })).toBe('VES');
    });

    it('still go by a known capability first', () => {
        const a = makeAsset({ capability: 'Heavy Rescue', resourceType: 'Vessel' });
        expect(assetCapabilityCode(a)).toBe('HRV');
    });

    it('portables go by their resourceType too', () => {
        expect(assetCapabilityCode(makeAsset({ capability: null, resourceType: 'Portable' }))).toBe('PRT');
    });

    it('vehicles with an unknown capability, or none, are grey with no code', () => {
        for (const capability of [null, 'Something New']) {
            const a = makeAsset({ capability, resourceType: 'Vehicle' });
            expect(assetCapabilityCode(a)).toBe('');
            expect(assetColor(a)).toBe('#757575');
        }
    });

    it('Pool Vehicle is coded and coloured as SHQ Pool', () => {
        const a = makeAsset({ capability: 'Pool Vehicle', resourceType: 'Vehicle' });
        expect(assetCapabilityCode(a)).toBe('SHQ');
        expect(assetColor(a)).toBe(assetColor(makeAsset({ capability: 'SHQ Pool', resourceType: 'Vehicle' })));
    });

    it('the newer capabilities have codes', () => {
        const code = (capability) => assetCapabilityCode(makeAsset({ capability, resourceType: 'Vehicle' }));
        expect([
            'High Clearance', 'Support', 'Cell on Wheels', 'General Land Rescue', 'Storm', 'Strategic Asset', 'Corporate Command',
        ].map(code)).toEqual(['HCV', 'SUP', 'COW', 'GLR', 'STM', 'SAV', 'CCV']);
    });
});

describe('vesselClass', () => {
    it('reads the satellite tracker class', () => {
        expect(vesselClass(makeAsset({ capability: 'vessel' }))).toBe(3);
        expect(vesselClass(makeAsset({ capability: 'vessel', satelliteClass: 'class 1 punt', satelliteClassType: null }))).toBe(1);
    });

    it('falls back to the class type, then the capability', () => {
        expect(vesselClass(makeAsset({ satelliteClass: null, satelliteClassType: 'Class 2 RIB' }))).toBe(2);
        expect(vesselClass(makeAsset({ satelliteId: null, satelliteClass: null, satelliteClassType: null, capability: 'Class 1' }))).toBe(1);
    });

    it('reads any class number, e.g. Class 4', () => {
        expect(vesselClass(makeAsset({ satelliteClass: 'Class 4 Punt', satelliteClassType: null, capability: 'Class 4' }))).toBe(4);
    });

    it('is 0 for non-vessels or vessels without a class', () => {
        expect(vesselClass(makeAsset({ capability: 'Bus', resourceType: 'Vehicle' }))).toBe(0);
        expect(vesselClass(makeAsset({ satelliteClass: null, satelliteClassType: null, capability: 'vessel' }))).toBe(0);
    });
});

describe('vessel class in the code', () => {
    const html = (asset) => buildIcon(asset, 'matched').options.html;

    it('codes a classed vessel VC and its class, in the tab', () => {
        for (const n of [1, 2, 3, 4]) {
            const a = makeAsset({ satelliteClass: `Class ${n} Demo`, satelliteClassType: null });
            expect(assetCapabilityCode(a)).toBe(`VC${n}`);
            expect(html(a)).toContain(`>VC${n}</text>`);
        }
    });

    it('keeps VES for a vessel without a class, and other codes unchanged', () => {
        expect(assetCapabilityCode(makeAsset({ capability: 'vessel', satelliteId: null, satelliteClass: null, satelliteClassType: null }))).toBe('VES');
        expect(assetCapabilityCode(makeAsset({ capability: 'Command', resourceType: 'Vehicle', satelliteClass: 'Class 3 Demo' }))).toBe('CMD');
    });

    it('draws no separate class box', () => {
        expect(html(makeAsset())).not.toContain('asset-pin__class');
    });
});

describe('assetCapabilityName', () => {
    const name = (props) => assetCapabilityName(makeAsset(props));

    it('names the capability as the map shows it', () => {
        expect(name({ capability: 'Heavy Rescue', resourceType: 'Vehicle' })).toBe('Heavy Rescue');
        expect(name({ capability: 'Class 3' })).toBe('Vessel');
        expect(name({ capability: 'vessel' })).toBe('Vessel');
        expect(name({ capability: 'portable', resourceType: 'Portable' })).toBe('Portable');
        expect(name({ capability: 'Pool Vehicle', resourceType: 'Vehicle' })).toBe('SHQ Pool');
    });

    it('is Other for an unknown capability or none', () => {
        expect(name({ capability: null, resourceType: 'Vehicle' })).toBe('Other');
        expect(name({ capability: 'Something New', resourceType: 'Vehicle' })).toBe('Other');
    });
});
