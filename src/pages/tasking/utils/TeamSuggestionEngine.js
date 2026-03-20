/**
 * TeamSuggestionEngine
 *
 * Rule-based scoring system for suggesting which team to task to a job.
 *
 * Rules:
 *   RESCUE priority jobs →
 *     Prefer the nearest team with ZERO active taskings.
 *     If every team has at least one tasking, fall back to the nearest team.
 *
 *   ALL OTHER priorities →
 *     Score = ((1 − normalisedDistance) × distanceWeight + (1 − normalisedTaskings) × taskingWeight) × 100
 *     100 = best possible match, 0 = worst.  Suggest the team with the
 *     highest combined score.
 *
 * When `travelTimeSeconds` is available on a team object (from Amazon
 * Location Service routing), it is used as the proximity dimension instead
 * of haversine distance.  This gives more accurate suggestions because road
 * travel time accounts for road network topology and speed limits.
 *
 * The user can tweak the distance vs tasking weights per priority class
 * via the config modal.
 */

/**
 * @typedef {Object} SuggestionWeights
 * @property {number} rescueDistanceWeight   0–100 slider value
 * @property {number} rescueTaskingWeight    0–100 slider value
 * @property {number} normalDistanceWeight   0–100 slider value  (non-rescue)
 * @property {number} normalTaskingWeight    0–100 slider value  (non-rescue)
 * @property {boolean} enabled               master on/off toggle
 */

const DEFAULT_WEIGHTS = {
    enabled: true,
    rescueDistanceWeight: 90,
    rescueTaskingWeight: 10,
    normalDistanceWeight: 50,
    normalTaskingWeight: 50,
};

/**
 * Given a list of enriched team objects (with `distanceMeters` and
 * `taskingCount`) and the job's priority ID, returns an array of
 * { index, reason } objects for the top-N suggested teams (best first),
 * or [] if disabled/impossible.
 *
 * @param {{ distanceMeters: number|null, travelTimeSeconds: number|null, taskingCount: number }[]} teams
 * @param {number|null} priorityId   Enum.JobPriorityType id (1 = Rescue)
 * @param {SuggestionWeights} weights
 * @param {number} [count=2]  how many suggestions to return
 * @returns {{ index: number, reason: string }[]}  best first
 */
export function suggestTeamIndices(teams, priorityId, weights, count = 2) {
    const w = { ...DEFAULT_WEIGHTS, ...weights };

    if (!w.enabled || !teams || teams.length === 0) return [];

    const isRescue = priorityId === 1;       // Enum.JobPriorityType.Rescue.Id

    if (isRescue) {
        return rescueStrategyN(teams, w, count);
    }
    return generalStrategyN(teams, w, count);
}


/* ------------------------------------------------------------------ */
/*  Rescue strategy (top N)                                            */
/* ------------------------------------------------------------------ */
function rescueStrategyN(teams, w, count) {
    const withDist = teams
        .map((t, i) => ({ ...t, _idx: i }))
        .filter(t => t.distanceMeters != null && Number.isFinite(t.distanceMeters));

    if (withDist.length === 0) return [];

    // Prefer teams with zero taskings
    const idle = withDist.filter(t => t.taskingCount === 0);

    if (idle.length > 0) {
        // Sort by travel time if available, otherwise by haversine distance
        idle.sort((a, b) => proximityValue(a) - proximityValue(b));
        return idle.slice(0, count).map((t, rank) => {
            const prefix = rank === 0 ? 'Nearest' : `#${rank + 1} nearest`;
            return {
                index: t._idx,
                reason: `${prefix} idle team — ${fmtProximity(t)}, 0 taskings (rescue)`,
            };
        });
    }

    // If user has set non-trivial weights, use weighted scoring even for rescue
    const dw = Math.max(0, w.rescueDistanceWeight);
    const tw = Math.max(0, w.rescueTaskingWeight);

    if (tw > 0) {
        return scoredIndices(withDist, dw, tw, count, 'rescue, all teams busy');
    }

    // Pure distance fallback
    withDist.sort((a, b) => proximityValue(a) - proximityValue(b));
    return withDist.slice(0, count).map((t, rank) => {
        const prefix = rank === 0 ? 'Nearest' : `#${rank + 1} nearest`;
        return {
            index: t._idx,
            reason: `${prefix} team — ${fmtProximity(t)}, ${t.taskingCount} tasking(s) (rescue, all busy)`,
        };
    });
}


/* ------------------------------------------------------------------ */
/*  General (non-rescue) strategy (top N)                              */
/* ------------------------------------------------------------------ */
function generalStrategyN(teams, w, count) {
    const withDist = teams
        .map((t, i) => ({ ...t, _idx: i }))
        .filter(t => t.distanceMeters != null && Number.isFinite(t.distanceMeters));

    if (withDist.length === 0) return [];

    const dw = Math.max(0, w.normalDistanceWeight);
    const tw = Math.max(0, w.normalTaskingWeight);

    if (dw === 0 && tw === 0) return [];   // both zeroed → no suggestion

    return scoredIndices(withDist, dw, tw, count, 'standard');
}


/* ------------------------------------------------------------------ */
/*  Shared min-max normalised scoring                                  */
/* ------------------------------------------------------------------ */
function scoredIndices(items, distWeight, taskWeight, count, tag) {
    if (items.length === 0) return [];

    const totalWeight = distWeight + taskWeight;
    if (totalWeight === 0) return [];

    const dw = distWeight / totalWeight;   // normalise to 0-1
    const tw = taskWeight / totalWeight;
    const dwPct = Math.round(dw * 100);
    const twPct = Math.round(tw * 100);

    // Use travel time as proximity dimension when available, fall back to distance
    const proxValues = items.map(t => proximityValue(t));
    const taskings   = items.map(t => t.taskingCount);

    const dMin = Math.min(...proxValues);
    const dMax = Math.max(...proxValues);
    const tMin = Math.min(...taskings);
    const tMax = Math.max(...taskings);

    const dRange = dMax - dMin || 1;   // avoid /0
    const tRange = tMax - tMin || 1;

    // Are any teams using road-routing data?
    const hasAnyRouting = items.some(t => t.travelTimeSeconds != null && Number.isFinite(t.travelTimeSeconds));
    const proxLabel = hasAnyRouting ? 'travel' : 'dist';

    const scored = items.map((t, i) => {
        const normDist = 1 - (proxValues[i] - dMin) / dRange;  // 1 = closest/fastest, 0 = farthest/slowest
        const normTask = 1 - (t.taskingCount - tMin) / tRange; // 1 = fewest, 0 = most
        const score    = (normDist * dw + normTask * tw) * 100; // 0–100 scale
        return { _idx: t._idx, score, normDist, normTask, raw: t };
    });

    scored.sort((a, b) => b.score - a.score);   // highest (best) first

    return scored.slice(0, count).map((s, rank) => {
        const parts = [];
        if (dwPct > 0) parts.push(`${proxLabel} ${dwPct}%`);
        if (twPct > 0) parts.push(`task ${twPct}%`);
        const weightDesc = parts.join(' / ');
        const prefix = rank === 0 ? 'Best' : `#${rank + 1}`;
        return {
            index: s._idx,
            reason: `${prefix} match ${s.score.toFixed(0)}% (${weightDesc}) — ${fmtProximity(s.raw)}, ${s.raw.taskingCount} tasking(s) [${tag}]`,
        };
    });
}


/* ------------------------------------------------------------------ */
/*  Proximity helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Returns a single numeric "proximity" value for sorting / normalisation.
 *
 * Prefers `travelTimeSeconds` (road routing) when available because it
 * accounts for road topology and speed limits.  Falls back to haversine
 * `distanceMeters`.  Lower value = closer/faster.
 *
 * @param {{ travelTimeSeconds?: number|null, distanceMeters: number }} t
 * @returns {number}
 */
function proximityValue(t) {
    if (t.travelTimeSeconds != null && Number.isFinite(t.travelTimeSeconds)) {
        return t.travelTimeSeconds;
    }
    return t.distanceMeters ?? Infinity;
}

/**
 * Human-readable proximity string for reason tooltips.
 * Shows travel time + road distance when routing data is available,
 * otherwise just the haversine distance.
 *
 * @param {{ travelTimeSeconds?: number|null, distanceMeters: number }} t
 * @returns {string}
 */
function fmtProximity(t) {
    if (t.distanceMeters == null || !Number.isFinite(t.distanceMeters)) {
        return 'distance unknown';
    }
    const distKm = (t.distanceMeters / 1000).toFixed(1);
    if (t.travelTimeSeconds != null && Number.isFinite(t.travelTimeSeconds)) {
        const totalMin = Math.round(t.travelTimeSeconds / 60);
        let timeStr;
        if (totalMin < 60) {
            timeStr = `${totalMin} min`;
        } else {
            const hr = Math.floor(totalMin / 60);
            const min = totalMin % 60;
            timeStr = min > 0 ? `${hr} hr ${min} min` : `${hr} hr`;
        }
        return `${timeStr}, ${distKm} km road`;
    }
    return `${distKm} km`;
}
