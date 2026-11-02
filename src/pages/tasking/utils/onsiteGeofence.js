import ko from 'knockout';

// Geofence check for the "at incident but not marked Onsite" alert: a team
// still Tasked/Enroute whose radio asset has a recent fix within radiusM of
// the incident marker has probably arrived without updating its status.

export const ONSITE_GEOFENCE_DEFAULT_METRES = 200;
export const ONSITE_GEOFENCE_MIN_METRES = 50;
export const ONSITE_GEOFENCE_MAX_METRES = 1000;
// Fixes older than this are ignored: a radio that stopped reporting near the
// incident shouldn't keep the alert up.
export const ONSITE_GEOFENCE_MAX_FIX_AGE_MINUTES = 15;

const PRE_ARRIVAL_STATUSES = new Set(['tasked', 'enroute']);

const toRad = d => d * Math.PI / 180;

export function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dφ = toRad(lat2 - lat1);
    const dλ = toRad(lon2 - lon1);
    const a = Math.sin(dφ / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dλ / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

const num = (v) => {
    const u = ko.unwrap(v);
    if (u == null || u === '') return null;
    const n = +u;
    return Number.isFinite(n) ? n : null;
};

/**
 * Closest of the team's assets with a fresh fix inside radiusM of (lat, lng),
 * as { asset, metres }, or null.
 */
export function nearestAssetInFence(assets, lat, lng, radiusM, nowMs, maxAgeMin = ONSITE_GEOFENCE_MAX_FIX_AGE_MINUTES) {
    let best = null;
    for (const a of assets || []) {
        const aLat = num(a.latitude);
        const aLng = num(a.longitude);
        if (aLat == null || aLng == null) continue;
        const seen = Date.parse(ko.unwrap(a.lastSeen) || '');
        if (!Number.isFinite(seen) || nowMs - seen > maxAgeMin * 60000) continue;
        const metres = haversineMeters(lat, lng, aLat, aLng);
        if (metres <= radiusM && (!best || metres < best.metres)) best = { asset: a, metres };
    }
    return best;
}

/**
 * Taskings whose team looks to be at the incident while still Tasked/Enroute,
 * nearest first: [{ team, tasking, asset, metres }].
 */
export function findUnmarkedArrivals(teams, { radiusM, nowMs = Date.now(), maxAgeMin } = {}) {
    const out = [];
    for (const team of teams || []) {
        const assets = team.trackableAssets?.() || [];
        if (!assets.length) continue;
        const taskings = team.filteredTaskings ? team.filteredTaskings() : (team.taskings?.() || []);
        for (const t of taskings) {
            if (!PRE_ARRIVAL_STATUSES.has(String(t.currentStatus?.() || '').toLowerCase())) continue;
            if (t.isComplete?.()) continue;
            const lat = num(t.job?.address?.latitude);
            const lng = num(t.job?.address?.longitude);
            if (lat == null || lng == null) continue;
            const hit = nearestAssetInFence(assets, lat, lng, radiusM, nowMs, maxAgeMin);
            if (hit) out.push({ team, tasking: t, ...hit });
        }
    }
    return out.sort((a, b) => a.metres - b.metres);
}
