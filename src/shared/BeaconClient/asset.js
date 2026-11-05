import moment from 'moment';
import { request } from './core/request.js';
import { fetchResourceLocations as fetchSimulatedRadioAssets } from '../cadenceSimulation.js';

const CACHE_SECONDS = 20;

function cacheKey(host, suffix) {
  const source = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `${source}-${suffix}`;
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    const parsed = JSON.parse(raw);
    const ageSeconds = Math.round(Date.now() / 1000) - Math.round(new Date(parsed.timestamp * 1000) / 1000);
    return ageSeconds > CACHE_SECONDS ? null : parsed.data;
  } catch (_) {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ timestamp: Math.round(Date.now() / 1000), data }));
  } catch (_) {
    /* storage full / unavailable -- caching is best-effort */
  }
}

async function fetchRadioAssets(host, userId, token, signal, simulation, refreshToken) {
  if (simulation) {
    // A CADence exercise is selected (Train/Test Beacon only, see
    // ../cadenceSimulation.js): its simulated positions replace Beacon's radio
    // feed. Never cached: the feed is served no-store and positions move every
    // few seconds, so a cached copy would show teams where they were.
    return fetchSimulatedRadioAssets(simulation, { host, token, signal, refreshToken });
  }
  const key = cacheKey(host, 'LighthouseFetchedRadioAssets');
  const cached = readCache(key);
  if (cached) {
    return cached;
  }
  const params = new URLSearchParams({ resourceTypes: '', LighthouseFunction: 'fetchRadioAssets', userId });
  const data = await request(host + '/Api/v1/ResourceLocations/Radio?' + params.toString(), { token, signal });
  const merged = Array.isArray(data) ? data.flat() : data;
  writeCache(key, merged);
  return merged;
}

async function fetchTeleAssets(host, userId, token, signal) {
  const key = cacheKey(host, 'LighthouseFetchedTeleAssets');
  const cached = readCache(key);
  if (cached) {
    return cached;
  }
  const params = new URLSearchParams({ LighthouseFunction: 'fetchTeleAssets', userId });
  const data = await request(host + '/Api/v1/ResourceLocations/Telematics?' + params.toString(), { token, signal });
  writeCache(key, data);
  return data;
}

// Radio (PSN) features -> assets. Numeric names aren't callsigns, so they're
// dropped. `exerciseHqId` is set for a CADence exercise copy's positions: the
// HQ that copy belongs to (see models/Asset.js in tasking).
function normaliseRadioAssets(features, exerciseHqId = null) {
  const assets = [];
  features.forEach((i) => {
    if (isNaN(i.properties.name)) {
      i.type = 'psn';
      if (exerciseHqId != null && exerciseHqId !== '') i.exerciseHqId = String(exerciseHqId);
      i.lastSeen = i.properties.lastSeen;
      i.name = `${i.properties.name} (PSN)`;
      i.unitCode = i.properties.name.match(/([a-z]+)/i) ? i.properties.name.match(/([a-z]+)/i)[1] : i.properties.name;
      i.vehCode = i.properties.name.match(/[a-z]+(\d*[a-z]?)/i) ? i.properties.name.match(/[a-z]+(\d*[a-z]?)/i)[1] : '';
      i.markerLabel = i.properties.name;
      if (i.unitCode && i.vehCode) {
        i.markerLabel = `${i.unitCode}<br>${i.vehCode}`;
      }
      i.entity = i.properties.entity;
      i.capability = i.properties.capability;
      i.resourceType = i.properties.resourceType;
      i.talkGroup = i.properties.talkgroup != null ? i.properties.talkgroup : 'Unknown';
      i.talkGroupLastUpdated = i.properties.talkgroupLastUpdated != null ? i.properties.talkgroupLastUpdated : 'Unknown';
      i.licensePlate = i.properties.licensePlate;
      assets.push(i);
    }
  });
  return assets;
}

async function returnAssetLocations(host, userId, token, signal, simulation, refreshToken) {
  const [radio, tele] = await Promise.allSettled([
    fetchRadioAssets(host, userId, token, signal, simulation, refreshToken),
    fetchTeleAssets(host, userId, token, signal),
  ]);

  // With a simulated exercise selected, a failed radio fetch rejects instead of
  // quietly returning telematics only: the caller has to know, either to keep
  // the positions it last drew (network/5xx) or to drop back to the real feed
  // (the backend refused the token, see isSimulationUnavailable).
  if (simulation && radio.status === 'rejected') {
    throw radio.reason;
  }

  const response = [];

  if (radio.status === 'fulfilled') {
    response.push(...normaliseRadioAssets(radio.value, simulation ? simulation.participantHqId : null));
  } else {
    console.error('Error fetching PSN asset locations', radio.reason);
  }

  if (tele.status === 'fulfilled') {
    tele.value.features.forEach((i) => {
      if (isNaN(i.properties.displayName)) {
        i.type = 'telematics';
        i.lastSeen = moment.unix(i.properties.timestamp).toISOString();
        i.name = `${i.properties.displayName.match(/(^\w*)/g)} (Tele)`;
        i.unitCode = i.properties.displayName.match(/([a-z]+)/i) ? i.properties.displayName.match(/([a-z]+)/i)[1] : i.properties.displayName;
        i.vehCode = i.properties.displayName.match(/[a-z]+(\d*[a-z]?)/i) ? i.properties.displayName.match(/[a-z]+(\d*[a-z]?)/i)[1] : '';
        i.markerLabel = i.properties.displayName;
        if (i.unitCode && i.vehCode) {
          i.markerLabel = `${i.unitCode}<br>${i.vehCode}`;
        }
        i.entity = 'N/A';
        // Telematics has no capability; displayName is "<callsign> <make and
        // model>" (sometimes "<callsign> - <make and model>"), so use the
        // make and model. (This was a /g match, which
        // returns the whole displayName in an array instead of the group.)
        const model = String(i.properties.displayName).trim().match(/^\S+\s+(?:[-\u2013]\s*)?(.+)$/);
        i.capability = model ? model[1] : '';
        i.resourceType = i.properties.type;
        i.talkGroup = 'N/A';
        i.talkGroupLastUpdated = 'N/A';
        i.licensePlate = 'N/A';
        response.push(i);
      }
    });
  } else {
    console.error('Error fetching Telemetric asset locations', tele.reason);
  }

  return response;
}

/**
 * SES asset locations (radio + telematics, merged and normalised).
 *
 * Pass `ctx.simulation` ({ exerciseId, copyId } of a CADence exercise copy) to
 * read the radio half from that exercise's simulated positions instead of
 * Beacon. That only works on Train and Test Beacon; anywhere else the call
 * rejects with a SimulationFeedError that isSimulationUnavailable() accepts,
 * without contacting the CADence backend. With `participantHqId` in it too,
 * each simulated asset carries that HQ as `exerciseHqId`, so LAD only matches
 * it to teams assigned to that HQ. `refreshToken` (simulated feed only) gives the
 * newest Beacon token after a 401/403, see cadenceSimulation.js.
 *
 * @param {string[]} assetFilter  asset names to keep; empty/falsy returns everything
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal,
 *          simulation?: {exerciseId: string, copyId: string, participantHqId?: string}|null,
 *          refreshToken?: () => Promise<string|null>}} ctx
 * @returns {Promise<object[]>}
 */
export async function filter(assetFilter, ctx = {}) {
  const { host, userId = 'notPassed', token, signal, simulation = null, refreshToken } = ctx;
  const response = await returnAssetLocations(host, userId, token, signal, simulation, refreshToken);
  if (!assetFilter || assetFilter.length === 0) {
    return response;
  }
  return response.filter((v) => assetFilter.includes(v.name));
}

/**
 * Only the simulated vehicles and vessels of a CADence exercise copy,
 * normalised like filter()'s radio assets. For a map that draws the exercise
 * as a layer of its own beside the live feed (the situational awareness map),
 * so Beacon's telematics aren't included. Train and Test Beacon only; anywhere
 * else it rejects like filter() does with `ctx.simulation`.
 *
 * @param {{host: string, token: string, signal?: AbortSignal,
 *          simulation: {exerciseId: string, copyId: string}, refreshToken?: () => Promise<string|null>}} ctx
 * @returns {Promise<object[]>}
 */
export async function simulated(ctx = {}) {
  const { host, token, signal, simulation = null, refreshToken } = ctx;
  return normaliseRadioAssets(await fetchSimulatedRadioAssets(simulation, { host, token, signal, refreshToken }));
}
