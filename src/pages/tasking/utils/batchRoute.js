/**
 * batchRoute.js
 *
 * Lightweight helper that fetches road-routing summaries (distance + travel
 * time) for multiple origin→destination pairs via the same Amazon Location
 * Service Lambda used by the map routing controls.
 *
 * Each pair produces a single POST to the route endpoint.  All requests
 * run in parallel and are individually fault-tolerant — a failed route
 * resolves to `null` rather than rejecting the batch.
 *
 * @module batchRoute
 */

const ROUTE_URL = "https://lambda.lighthouse-extension.com/lad/route";

/**
 * @typedef {Object} RouteSummary
 * @property {number} distanceMeters   Road distance in metres.
 * @property {number} travelTimeSeconds  Estimated travel time in seconds.
 * @property {number[][]|null} geometry  Route polyline as [[lat,lng], …] or null.
 */

/**
 * Fetch road-routing summaries for an array of origin→destination pairs.
 *
 * @param {{ fromLat: number, fromLng: number, toLat: number, toLng: number }[]} pairs
 *   Array of coordinate pairs to route between.
 * @param {Object} [opts]
 * @param {string}  [opts.travelMode="Car"]    ALS travel mode.
 * @param {number}  [opts.timeoutMs=10000]     Per-request timeout.
 * @param {AbortSignal} [opts.signal]          Optional abort signal to
 *   cancel all in-flight requests.
 * @returns {Promise<(RouteSummary|null)[]>}
 *   Array aligned with `pairs`.  Each entry is either a summary object or
 *   `null` if that individual route failed.
 */
export async function batchRoute(pairs, opts = {}) {
    const { travelMode = "Car", timeoutMs = 10000, signal } = opts;

    const promises = pairs.map(({ fromLat, fromLng, toLat, toLng }) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        // Honour external abort as well
        if (signal) {
            signal.addEventListener("abort", () => controller.abort(), { once: true });
        }

        const payload = {
            coordinates: [
                [fromLng, fromLat],   // ALS expects [lng, lat]
                [toLng, toLat],
            ],
            travelMode,
        };

        return fetch(ROUTE_URL, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
        })
            .then(res => {
                clearTimeout(timer);
                if (!res.ok) return null;
                return res.json();
            })
            .then(json => {
                if (!json) return null;
                return extractSummary(json);
            })
            .catch(() => {
                clearTimeout(timer);
                return null;   // swallow per-route failures
            });
    });

    return Promise.all(promises);
}

/**
 * Pulls distance (metres) and time (seconds) from the ALS Lambda response.
 *
 * The Lambda returns the raw Amazon Routes API shape:
 *   `{ Routes: [{ Summary: { Overview: { Distance, Duration } } }] }`
 *
 * Falls back through several structural variants for robustness.
 *
 * @param {Object} json  Parsed API response.
 * @returns {RouteSummary|null}
 */
function extractSummary(json) {
    const routes = json?.Routes ?? json?.routes ?? (Array.isArray(json) ? json : null);
    if (!routes || !routes.length) return null;

    const r = routes[0];
    const src =
        r?.Summary?.Overview ??
        r?.summary?.overview ??
        r?.Summary ??
        r?.summary ??
        null;

    if (!src) return null;

    const distanceMeters = typeof src.Distance === "number" ? Math.round(src.Distance) : null;
    const travelTimeSeconds = typeof src.Duration === "number" ? Math.round(src.Duration) : null;

    if (distanceMeters == null && travelTimeSeconds == null) return null;

    // Extract route geometry from Legs[].Geometry.LineString => [[lat,lng], …]
    const legs = r?.Legs ?? r?.legs ?? [];
    let geometry = null;
    if (Array.isArray(legs) && legs.length) {
        const coords = [];
        for (const leg of legs) {
            const geom = leg?.Geometry ?? leg?.geometry;
            const ls = geom?.LineString ?? geom?.lineString;
            if (Array.isArray(ls) && ls.length) {
                for (let i = 0; i < ls.length; i++) {
                    // Skip duplicate join-point between legs
                    if (coords.length && i === 0) continue;
                    // ALS returns [lng, lat] — flip to [lat, lng] for Leaflet
                    coords.push([ls[i][1], ls[i][0]]);
                }
            }
        }
        if (coords.length >= 2) geometry = coords;
    }

    return { distanceMeters, travelTimeSeconds, geometry };
}
