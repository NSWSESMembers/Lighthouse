/**
 * driveTime.js
 *
 * Drive-time ETA for the tasking status menu: a road route from the team's
 * tracked asset to the incident, via the same route Lambda as the Instant
 * Task suggestions (batchRoute). An asset's last fix can be old -- radios go
 * quiet when parked or out of coverage -- so the source always carries the
 * fix's age and a freshness grade for the operator to judge it by, and is
 * reverse-geocoded (geocode-v2 Lambda) to say roughly where the team is.
 *
 * @module driveTime
 */
import ko from "knockout";
import { batchRoute } from "./batchRoute.js";

const GEOCODE_URL = "https://lambda.lighthouse-extension.com/lad_v2/geocode";

let _getToken = null;
/** Beacon token getter for the route and geocode Lambdas -- set once by main.js. */
export function setDriveTimeTokenGetter(getTokenFn) { _getToken = getTokenFn; }

// Fix age grades: fresh up to FIX_AGING_MINUTES, then aging (amber), stale
// (red) past FIX_STALE_MINUTES -- by then a moving team could be well away.
export const FIX_AGING_MINUTES = 5;
export const FIX_STALE_MINUTES = 15;

const num = (v) => {
    const n = ko.unwrap(v);
    return n == null || n === "" ? null : Number.isFinite(+n) ? +n : null;
};

/**
 * The asset a drive time is measured from: the team's default asset, else the
 * first tracked asset with a position. Null if none has one.
 * @returns {{ name: string, lat: number, lng: number, lastSeen: string }|null}
 */
export function driveSourceFor(team) {
    if (!team || !team.trackableAssets) return null;
    const def = team.defaultAsset ? team.defaultAsset() : null;
    const assets = def ? [def, ...team.trackableAssets()] : team.trackableAssets();
    for (const a of assets) {
        const lat = num(a.latitude), lng = num(a.longitude);
        if (lat == null || lng == null) continue;
        return { name: ko.unwrap(a.name) || "team asset", lat, lng, lastSeen: ko.unwrap(a.lastSeen) || "" };
    }
    return null;
}

/**
 * How old an asset fix is, for the line beside the Drive time button.
 * @returns {{ minutesAgo: number|null, ageLabel: string, state: 'fresh'|'aging'|'stale'|'unknown' }}
 */
export function fixFreshness(lastSeen, nowMs = Date.now()) {
    const t = lastSeen ? new Date(lastSeen).getTime() : NaN;
    if (!Number.isFinite(t)) return { minutesAgo: null, ageLabel: "update time unknown", state: "unknown" };
    const minutesAgo = Math.max(0, Math.floor((nowMs - t) / 60000));
    let ageLabel;
    if (minutesAgo < 1) ageLabel = "updated just now";
    else if (minutesAgo < 60) ageLabel = `updated ${minutesAgo} min ago`;
    else if (minutesAgo < 1440) {
        const h = Math.floor(minutesAgo / 60), m = minutesAgo % 60;
        ageLabel = `updated ${h}h${m ? ` ${m}m` : ""} ago`;
    } else ageLabel = `updated ${Math.floor(minutesAgo / 1440)}d ago`;
    const state = minutesAgo > FIX_STALE_MINUTES ? "stale" : minutesAgo > FIX_AGING_MINUTES ? "aging" : "fresh";
    return { minutesAgo, ageLabel, state };
}

/**
 * Road route from `from` to `to` ({ lat, lng }). Resolves to
 * { minutes, distanceMeters } (minutes rounded up, at least 1), or null if
 * no route came back.
 */
export async function fetchDriveTime(from, to, opts = {}) {
    const [summary] = await batchRoute(
        [{ fromLat: from.lat, fromLng: from.lng, toLat: to.lat, toLng: to.lng }],
        { getToken: _getToken, ...opts },
    );
    if (!summary || summary.travelTimeSeconds == null) return null;
    return {
        minutes: Math.max(1, Math.ceil(summary.travelTimeSeconds / 60)),
        distanceMeters: summary.distanceMeters,
    };
}

/**
 * A short address for a reverse-geocode result: "12 Smith St, Parramatta".
 * In Australian results the suburb is District (Locality is the city), as in
 * the map's "Geocode here".
 */
export function shortAddress(item) {
    const a = item && item.Address;
    if (!a) return (item && item.Title) || null;
    const suburb = a.District || a.Locality;
    const street = a.Street ? `${a.AddressNumber ? `${a.AddressNumber} ` : ""}${a.Street}` : null;
    const parts = [street, suburb].filter(Boolean);
    return parts.length ? parts.join(", ") : item.Title || a.Label || null;
}

/**
 * The street address nearest { lat, lng }, shortened (shortAddress), or null
 * if the lookup fails or finds nothing.
 */
export async function fetchNearAddress(pos, { timeoutMs = 10000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const url = new URL(GEOCODE_URL);
        url.searchParams.set("lat", String(pos.lat));
        url.searchParams.set("lon", String(pos.lng));
        url.searchParams.set("maxResults", "1");
        const token = _getToken ? await _getToken() : null;
        const res = await fetch(url.toString(), {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal,
        });
        if (!res.ok) return null;
        const json = await res.json();
        return shortAddress(Array.isArray(json?.results) ? json.results[0] : null);
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}
