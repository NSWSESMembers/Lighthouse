// @vitest-environment jsdom
//
// A CADence exercise feed travelling the same path as Beacon's radio feed:
// BeaconClient.asset.filter -> models/Asset -> team matching -> marker codes.
// Checks the claims in CADence's Lighthouse integration notes: a team named
// "KOG56 + KOG711" picks up its vehicle and its vessel, a vehicle-only team
// picks up just its vehicle, and the capability labels give the usual codes.
// In a group exercise, a copy's positions only go to its own HQ's teams.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ko from 'knockout';
import { request } from '../../../shared/BeaconClient/core/request.js';
import { filter } from '../../../shared/BeaconClient/asset.js';
import { Asset } from '../models/Asset.js';
import { Entity } from '../models/Entity.js';
import { computeMatchedAssetsForTeam } from './assetTeamMatching.js';
import { assetCapabilityCode } from '../components/asset_icon.js';

vi.mock('../../../shared/BeaconClient/core/request.js', () => ({ request: vi.fn() }));

const ctx = {
  host: 'https://apitrainbeacon.ses.nsw.gov.au',
  token: 'tok',
  userId: 'u1',
  simulation: { exerciseId: 'ex123', copyId: 'individual' },
};

// The shape CADence's backend serves (infra/lambda/shared/feed.ts there).
function feedFeature(callsign, { capability, resourceType, lng, lat, direction = null }) {
  const lastSeen = new Date().toISOString();
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      id: `cadence-ex123-individual-${callsign}`,
      name: callsign,
      entity: 'Kogarah',
      capability,
      resourceType,
      lastSeen,
      direction,
      talkgroup: 'CADence exercise',
      talkgroupLastUpdated: lastSeen,
      radioId: '',
      licensePlate: 'SIM',
    },
  };
}

const FEED = [
  feedFeature('KOG56', {
    capability: 'General Purpose',
    resourceType: 'Vehicle',
    lng: 151.1335,
    lat: -33.9686,
    direction: 90,
  }),
  feedFeature('KOG711', { capability: 'Class 1', resourceType: 'Vessel', lng: 151.1352, lat: -33.9701 }),
  feedFeature('KOG57', { capability: 'General Purpose', resourceType: 'Vehicle', lng: 151.14, lat: -33.97 }),
  feedFeature('KOG31', { capability: 'Storm', resourceType: 'Vehicle', lng: 151.12, lat: -33.96 }),
];

async function simulatedAssets() {
  vi.mocked(request).mockResolvedValueOnce(FEED).mockResolvedValueOnce({ features: [] });
  const assets = await filter('', ctx);
  return assets.map((a) => new Asset(a));
}

const team = (callsign) => ({ callsign: () => callsign });
const names = (set) => [...set].map((a) => a.name()).sort();

beforeEach(() => {
  localStorage.clear();
  vi.mocked(request).mockReset();
});

describe('a CADence exercise feed in LAD', () => {
  it('builds assets keyed by the cadence- feature id, named by callsign', async () => {
    const assets = await simulatedAssets();
    expect(assets.map((a) => a.id())).toEqual([
      'cadence-ex123-individual-KOG56',
      'cadence-ex123-individual-KOG711',
      'cadence-ex123-individual-KOG57',
      'cadence-ex123-individual-KOG31',
    ]);
    expect(assets[0].name()).toBe('KOG56');
    expect(assets[0].latLng()).toEqual({ lat: -33.9686, lng: 151.1335 });
    expect(assets[0].direction()).toBe(90);
    expect(assets[0].talkgroup()).toBe('CADence exercise');
  });

  it('matches "KOG56 + KOG711" to both its vehicle and its vessel', async () => {
    const assets = await simulatedAssets();
    expect(names(computeMatchedAssetsForTeam(team('KOG56 + KOG711'), assets))).toEqual(['KOG56', 'KOG711']);
  });

  it('matches a vehicle-only team to just its vehicle', async () => {
    const assets = await simulatedAssets();
    expect(names(computeMatchedAssetsForTeam(team('KOG56'), assets))).toEqual(['KOG56']);
    expect(names(computeMatchedAssetsForTeam(team('KOG57'), assets))).toEqual(['KOG57']);
  });

  it('gives the simulated capabilities their usual marker codes', async () => {
    const byName = Object.fromEntries((await simulatedAssets()).map((a) => [a.name(), a]));
    expect(assetCapabilityCode(byName.KOG56)).toBe('GPV');
    expect(assetCapabilityCode(byName.KOG31)).toBe('STM');
    expect(assetCapabilityCode(byName.KOG711)).toBe('VC1');
  });
});

// Group mode: every participant HQ gets its own copy of the exercise, and each
// copy creates the same teams in its HQ. So two teams can be called
// "KOG56 + KOG711", and each must get its own HQ's positions or none.
describe('a group exercise in LAD', () => {
  const KOGARAH = '150';
  const BANKSTOWN = '151';
  // The Team model's assignedTo: an observable holding an Entity.
  const teamAt = (callsign, hqId) => ({
    callsign: () => callsign,
    assignedTo: ko.observable(new Entity({ Id: hqId == null ? null : Number(hqId), Name: `HQ ${hqId}` })),
  });
  const kogarahTeam = teamAt('KOG56 + KOG711', KOGARAH);
  const bankstownTeam = teamAt('KOG56 + KOG711', BANKSTOWN);
  const ids = (set) => [...set].map((a) => a.id()).sort();

  // One copy's feed, as LAD reads it with that copy selected.
  async function copyAssets(copyId, participantHqId) {
    const copyFeed = FEED.map((f) => ({
      ...f,
      properties: { ...f.properties, id: `cadence-ex123-${copyId}-${f.properties.name}` },
    }));
    vi.mocked(request).mockResolvedValueOnce(copyFeed).mockResolvedValueOnce({ features: [] });
    const simulation = { exerciseId: 'ex123', copyId, participantHqId };
    return (await filter('', { ...ctx, simulation })).map((a) => new Asset(a));
  }

  it("gives a copy's positions to its own HQ's team only", async () => {
    const assets = await copyAssets(KOGARAH, KOGARAH);

    expect(ids(computeMatchedAssetsForTeam(kogarahTeam, assets))).toEqual([
      'cadence-ex123-150-KOG56',
      'cadence-ex123-150-KOG711',
    ]);
    expect(computeMatchedAssetsForTeam(bankstownTeam, assets).size).toBe(0);
  });

  it('gives each team its own HQ copy when both copies are loaded', async () => {
    const assets = [...(await copyAssets(KOGARAH, KOGARAH)), ...(await copyAssets(BANKSTOWN, BANKSTOWN))];

    expect(ids(computeMatchedAssetsForTeam(kogarahTeam, assets))).toEqual([
      'cadence-ex123-150-KOG56',
      'cadence-ex123-150-KOG711',
    ]);
    expect(ids(computeMatchedAssetsForTeam(bankstownTeam, assets))).toEqual([
      'cadence-ex123-151-KOG56',
      'cadence-ex123-151-KOG711',
    ]);
  });

  it('gives no simulated position to a team whose HQ is unknown', async () => {
    const assets = await copyAssets(KOGARAH, KOGARAH);
    expect(computeMatchedAssetsForTeam(team('KOG56 + KOG711'), assets).size).toBe(0);
    expect(computeMatchedAssetsForTeam(teamAt('KOG56 + KOG711', null), assets).size).toBe(0);
  });

  it('still matches real radios to teams in any HQ', async () => {
    vi.mocked(request).mockResolvedValueOnce(FEED).mockResolvedValueOnce({ features: [] });
    const real = (await filter('', { ...ctx, simulation: null })).map((a) => new Asset(a));

    expect(names(computeMatchedAssetsForTeam(kogarahTeam, real))).toEqual(['KOG56', 'KOG711']);
    expect(names(computeMatchedAssetsForTeam(bankstownTeam, real))).toEqual(['KOG56', 'KOG711']);
  });
});
