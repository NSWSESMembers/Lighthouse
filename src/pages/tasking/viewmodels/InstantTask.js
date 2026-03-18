var ko = require('knockout');

import { suggestTeamIndices } from '../utils/TeamSuggestionEngine.js';
import { batchRoute } from '../utils/batchRoute.js';


/**
 * ViewModel for the "instant task" dropdown attached to each job row and
 * map popup.  Provides a filtered, distance-sorted, suggestion-enriched
 * list of teams that can be tasked to the parent job with a single click.
 *
 * When the dropdown opens the list renders immediately using haversine
 * (crow-flies) distances.  If road-routing is enabled in config, Amazon
 * Location Service travel times are fetched in the background.  When
 * results arrive the computed re-evaluates, the summary lines update with
 * actual travel times, and the suggestion engine re-ranks using road
 * distance instead of haversine.
 */
export class InstantTaskViewModel {
    constructor({ job, map, filteredTeams, config }) {
        this.job = job;
        this.map = map;
        this.filteredTeams = filteredTeams;
        this.config = config;

        /**
         * In-memory cache of route results keyed by `"teamId"`.
         * Each value stores the route summary plus the origin/destination
         * coordinates that were used, so stale entries can be detected
         * when teams or jobs move.
         *
         * Shape: `{ distanceMeters, travelTimeSeconds, fromLat, fromLng, toLat, toLng }` or `null` (in-flight).
         * @type {Map<string, RouteCacheEntry|null>}
         */
        this._routeCache = new Map();

        /**
         * Last-known job coordinates used for route lookups.
         * When the job moves, the entire cache is flushed.
         * @type {{ lat: number|null, lon: number|null }}
         */
        this._lastJobCoords = { lat: null, lon: null };

        /**
         * Minimum movement (in metres) of either endpoint before a cached
         * route entry is considered stale and evicted.
         * @type {number}
         */
        this._movementThreshold = 100;

        /**
         * Bumped after route results arrive so `popupFilteredTeams` re-evaluates.
         * @type {ko.Observable<number>}
         */
        this._routeCacheTick = ko.observable(0);

        /**
         * AbortController for the current in-flight batch route request.
         * Allows cancellation when the dropdown closes before results arrive.
         * @type {AbortController|null}
         */
        this._routeAbort = null;

        /**
         * Set to `true` after routes are kicked off for the current
         * dropdown session.  Reset to `false` when the dropdown closes
         * so the next open triggers a fresh fetch.
         * @type {boolean}
         */
        this._routesFetchedThisOpen = false;

        // When the instant-task dropdown closes, cancel pending route
        // requests and reset the fetch-once flag for the next open.
        this.dropdownOpen.subscribe(open => {
            if (!open) {
                if (this._routeAbort) {
                    this._routeAbort.abort();
                    this._routeAbort = null;
                }
                this._routesFetchedThisOpen = false;
            }
        });
    }


    popupActive = ko.observable(false);   // gate to stop it from processing every time something changes under it

    /** True only while the instant-task Bootstrap dropdown is shown. */
    dropdownOpen = ko.observable(false);

    popupTeamFilter = ko.observable('');



    drawCrowsFliesToAssetPassedTeam = (team) => {
        this.map.drawCrowsFliesToAssetPassedTeam(team, this.job)
    }

    /**
     * Draw the cached road-route polyline for a team, or fall back to
     * crow-flies if no geometry is available.
     */
    drawRouteOrCrowsFlies = (tm, teamId) => {
        const cached = this._routeCache.get(teamId);
        if (cached && cached.geometry) {
            this.map.clearCrowFliesLine();
            this.map.drawRoutePolyline(cached.geometry);
        } else {
            this.drawCrowsFliesToAssetPassedTeam(tm);
        }
    }

    removeCrowsFlies = () => {
        this.map.clearCrowFliesLine();
    }

    taskTeamToJobWithConfirm = (team) => {
        this.map.taskTeamToJobWithConfirm(this.job, team);
    }

    popupFilteredTeams = ko.pureComputed(() => {

        if (!this.popupActive()) return []; // short-circuit

        // Read the route-cache tick so this computed re-fires after routes arrive
        this._routeCacheTick();

        const term = (this.popupTeamFilter() || "").toLowerCase().trim();
        const list = this.filteredTeams() || [];
        const job = this.job;

        const jLat = unwrapNum(job?.address?.latitude);
        const jLon = unwrapNum(job?.address?.longitude);

        const cfg = this.config;
        const useRouting = cfg && cfg.suggestionUseRouting ? !!ko.unwrap(cfg.suggestionUseRouting) : false;
        const dropdownIsOpen = this.dropdownOpen();

        // ── Invalidate entire cache when the job/incident has moved ──
        if (jLat != null && jLon != null) {
            const prev = this._lastJobCoords;
            if (prev.lat != null && prev.lon != null) {
                const jobDrift = haversineMeters(prev.lat, prev.lon, jLat, jLon);
                if (jobDrift > this._movementThreshold) {
                    this._routeCache.clear();
                }
            }
            this._lastJobCoords = { lat: jLat, lon: jLon };
        }

        /** Max number of route lookups per evaluation (nearest teams only). */
        const ROUTE_LIMIT = 5;

        // Teams that could use a route lookup (collected during map, trimmed after)
        const routeCandidates = [];

        const enriched = list
            .filter(tm =>
                !term || (tm.callsign() || "").toLowerCase().includes(term)
            )
            .filter(tm =>
                !(job.incompleteTaskingsOnly() || []).some(
                    t => t.team.id === tm.id
                )
            )
            .map(tm => {
                const { distance, backBearing, assetLat, assetLon } = bestDistanceAndBearing(tm, job);
                const taskingCount = tm.filteredTaskings().length;

                // Check route cache — evict if team's asset has moved
                const teamId = String(ko.unwrap(tm.id));
                let cached = this._routeCache.get(teamId);
                if (cached && assetLat != null && assetLon != null) {
                    const drift = haversineMeters(cached.fromLat, cached.fromLng, assetLat, assetLon);
                    if (drift > this._movementThreshold) {
                        this._routeCache.delete(teamId);
                        cached = undefined;
                    }
                }
                const hasRoute = cached && cached.travelTimeSeconds != null;

                // Build summary line — include travel time when available
                const noJobLocation = jLat == null || jLon == null;
                const summaryParts = [
                    taskingCount + ' tasking(s)',
                    hasRoute ? fmtTime(cached.travelTimeSeconds) : null,
                    hasRoute ? fmtDist(cached.distanceMeters) + ' road' : (distance != null ? fmtDist(distance) : null),
                    backBearing != null ? fmtBearing(backBearing) : null,
                    noJobLocation ? "No incident location" :
                        (distance == null && backBearing == null ? "Team location unknown" : null),
                ].filter(Boolean).join(' • ');

                // For the suggestion engine: prefer road distance, fall back to haversine
                const effectiveDistance = hasRoute ? cached.distanceMeters : distance;

                // Collect candidate for route fetching (only on first eval after dropdown opens)
                if (useRouting && dropdownIsOpen && !this._routesFetchedThisOpen && !this._routeCache.has(teamId) && assetLat != null && jLat != null) {
                    routeCandidates.push({
                        teamId, fromLat: assetLat, fromLng: assetLon,
                        toLat: jLat, toLng: jLon,
                        _haversine: distance ?? Number.POSITIVE_INFINITY,
                    });
                }

                return {
                    team: tm,
                    taskings: tm.filteredTaskings,
                    taskingCount,
                    currentTaskingSummary: tm.currentTaskingSummary,
                    summaryLine: summaryParts,
                    distanceMeters: effectiveDistance,
                    travelTimeSeconds: hasRoute ? cached.travelTimeSeconds : null,
                    isSuggested: false,
                    suggestionReason: '',
                    routeLoading: false, // updated below after trimming to nearest N
                    mouseInTeamInInstantTaskPopup: () => {
                        this.drawRouteOrCrowsFlies(tm, teamId);
                    },
                    mouseOutTeamInInstantTaskPopup: () => {
                        this.removeCrowsFlies();
                    },
                    taskTeamToJobWithConfirm: (d, e) => {
                        console.log(e);
                        const dropdown = e.target.closest('.dropdown-menu');
                        if (dropdown) {
                            dropdown.classList.remove('show');
                        }
                        this.taskTeamToJobWithConfirm(tm);
                    }
                };
            })
            .sort((a, b) => {
                const da = a.distanceMeters ?? Number.POSITIVE_INFINITY;
                const db = b.distanceMeters ?? Number.POSITIVE_INFINITY;
                return da - db;
            });

        // ── Kick off async route fetching for nearest uncached teams (once per open) ──
        if (routeCandidates.length > 0) {
            // Sort candidates by haversine so we only route the closest teams
            routeCandidates.sort((a, b) => a._haversine - b._haversine);
            const routeNeeded = routeCandidates.slice(0, ROUTE_LIMIT);

            // Mark those teams as loading in the enriched list
            const routeSet = new Set(routeNeeded.map(r => r.teamId));
            for (const item of enriched) {
                if (routeSet.has(String(ko.unwrap(item.team.id)))) {
                    item.routeLoading = true;
                }
            }

            this._routesFetchedThisOpen = true;
            this._fetchRoutes(routeNeeded);
        }

        // ── Suggestion engine ──
        if (cfg && enriched.length > 0) {
            const weights = {
                enabled: cfg.suggestionEnabled ? !!ko.unwrap(cfg.suggestionEnabled) : true,
                rescueDistanceWeight: cfg.rescueDistanceWeight ? Number(ko.unwrap(cfg.rescueDistanceWeight)) : 90,
                rescueTaskingWeight: cfg.rescueTaskingWeight ? Number(ko.unwrap(cfg.rescueTaskingWeight)) : 10,
                normalDistanceWeight: cfg.normalDistanceWeight ? Number(ko.unwrap(cfg.normalDistanceWeight)) : 50,
                normalTaskingWeight: cfg.normalTaskingWeight ? Number(ko.unwrap(cfg.normalTaskingWeight)) : 50,
            };

            const priorityId = job.priorityId ? ko.unwrap(job.priorityId) : null;
            const results = suggestTeamIndices(enriched, priorityId, weights, 2);

            // Mark suggested teams with reason, then move them to the top (best first)
            const suggested = [];
            for (const { index, reason } of results) {
                if (index >= 0 && index < enriched.length) {
                    enriched[index].isSuggested = true;
                    enriched[index].suggestionReason = reason;
                }
            }
            // Pull them out in reverse index order to avoid shifting
            const sortedIdxDesc = results
                .map(r => r.index)
                .filter(i => i >= 0 && i < enriched.length)
                .sort((a, b) => b - a);
            for (const idx of sortedIdxDesc) {
                suggested.unshift(enriched.splice(idx, 1)[0]);
            }
            enriched.unshift(...suggested);
        }

        return enriched;
    });

    /**
     * Fires off parallel route requests for teams not yet in the cache.
     * When results arrive the cache is populated, the tick is bumped, and
     * `popupFilteredTeams` re-evaluates automatically.
     *
     * Safe to call multiple times — teams already in-flight or cached are
     * skipped because the caller only passes uncached team IDs.
     *
     * @param {{ teamId: string, fromLat: number, fromLng: number, toLat: number, toLng: number }[]} pairs
     */
    _fetchRoutes = (pairs) => {
        // Mark these as "in-flight" in cache so we don't re-request
        for (const p of pairs) {
            this._routeCache.set(p.teamId, null);
        }

        // Abort any previous batch
        if (this._routeAbort) this._routeAbort.abort();
        const controller = new AbortController();
        this._routeAbort = controller;

        batchRoute(pairs, { signal: controller.signal })
            .then(results => {
                if (controller.signal.aborted) return;

                for (let i = 0; i < pairs.length; i++) {
                    const summary = results[i];
                    const p = pairs[i];
                    // Store the coordinates alongside the result for staleness checks
                    this._routeCache.set(p.teamId, summary
                        ? { ...summary, fromLat: p.fromLat, fromLng: p.fromLng, toLat: p.toLat, toLng: p.toLng }
                        : summary);
                }

                // Bump tick so the computed re-evaluates with route data
                this._routeCacheTick(this._routeCacheTick() + 1);
            })
            .catch(() => {
                // Silently ignore — haversine fallback remains in place
            });
    };

}


// --- helpers

const unwrapNum = v => {
    const n = +ko.unwrap(v);
    return Number.isFinite(n) ? n : null;
};

const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;

function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dφ = toRad(lat2 - lat1);
    const dλ = toRad(lon2 - lon1);
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

function bearingDegrees(lat1, lon1, lat2, lon2) {
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const λ1 = toRad(lon1);
    const λ2 = toRad(lon2);
    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    const θ = Math.atan2(y, x);
    return (toDeg(θ) + 360) % 360; // forward bearing
}

function backBearingDegrees(bearing) {
    return (bearing + 180) % 360;
}

function bearingToCardinal(bearing) {
    if (bearing == null || !Number.isFinite(bearing)) return null;
    const dirs = [
        "↑", "↗", "→", "↘",
        "↓", "↙", "←", "↖"
    ];
    const idx = Math.round(bearing / 45) % 8;
    return dirs[idx];
}

function bestDistanceAndBearing(team, job) {
    const jLat = unwrapNum(job?.address?.latitude);
    const jLon = unwrapNum(job?.address?.longitude);
    if (jLat == null || jLon == null) return { distance: null, bearing: null, assetLat: null, assetLon: null };

    // Use the team's default asset (user-chosen or first) for distance/bearing
    const defAsset = team.defaultAsset ? team.defaultAsset() : null;
    const assets = defAsset ? [defAsset] : (ko.unwrap(team?.trackableAssets) || []);
    let best = null;
    let bestBearing = null;
    let bestAssetLat = null;
    let bestAssetLon = null;

    for (const a of assets) {
        let lat = unwrapNum(a?.latitude), lon = unwrapNum(a?.longitude);
        if ((lat == null || lon == null) && a?.geometry?.coordinates) {
            lat = unwrapNum(a.geometry.coordinates[1]);
            lon = unwrapNum(a.geometry.coordinates[0]);
        }
        if (lat == null || lon == null) continue;

        const d = haversineMeters(lat, lon, jLat, jLon);
        if (best == null || d < best) {
            best = d;
            bestBearing = bearingDegrees(lat, lon, jLat, jLon);
            bestAssetLat = lat;
            bestAssetLon = lon;
        }
    }
    const backBearing = bestBearing != null ? backBearingDegrees(bestBearing) : null;

    return { distance: best, bearing: bestBearing, backBearing, assetLat: bestAssetLat, assetLon: bestAssetLon };
}

const fmtBearing = b =>
    b == null ? "-" : `${bearingToCardinal(b)} ${Math.round(b)}°`;

const fmtDist = m =>
    m == null ? "-" : (m < 950 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

/**
 * Formats a travel time in seconds for display.
 * Examples: "3 min", "1 hr 25 min".
 *
 * @param {number|null} s  Travel time in seconds.
 * @returns {string}
 */
const fmtTime = s => {
    if (s == null || !Number.isFinite(s)) return "-";
    const totalMin = Math.round(s / 60);
    if (totalMin < 60) return `${totalMin} min`;
    const hr = Math.floor(totalMin / 60);
    const min = totalMin % 60;
    return min > 0 ? `${hr} hr ${min} min` : `${hr} hr`;
};


