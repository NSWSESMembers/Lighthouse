import moment from 'moment';
import { request } from './core/request.js';

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

async function fetchRadioAssets(host, userId, token, signal) {
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

async function returnAssetLocations(host, userId, token, signal) {
  const [radio, tele] = await Promise.allSettled([
    fetchRadioAssets(host, userId, token, signal),
    fetchTeleAssets(host, userId, token, signal),
  ]);

  const response = [];

  if (radio.status === 'fulfilled') {
    radio.value.forEach((i) => {
      if (isNaN(i.properties.name)) {
        i.type = 'psn';
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
        response.push(i);
      }
    });
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
        i.capability = i.properties.displayName.match(/^\w.* (.*)/g);
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
 * @param {string[]} assetFilter  asset names to keep; empty/falsy returns everything
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object[]>}
 */
export async function filter(assetFilter, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  const response = await returnAssetLocations(host, userId, token, signal);
  if (!assetFilter || assetFilter.length === 0) {
    return response;
  }
  return response.filter((v) => assetFilter.includes(v.name));
}
