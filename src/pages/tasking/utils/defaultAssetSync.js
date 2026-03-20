/**
 * defaultAssetSync.js
 *
 * Client-side helper for fetching and pushing shared default-asset
 * mappings via the Lambda / S3 backend.
 *
 * A single GET request is made per refresh cycle, shared across all
 * teams.  Results are stored in localStorage so they survive page
 * reloads and are available immediately on next open.
 *
 * The request only fires if there is at least one team with multiple
 * trackable assets.  Only those team IDs are sent, so the Lambda
 * doesn't pull the entire universe.
 */

const LAMBDA_BASE = 'https://lambda.lighthouse-extension.com/lad/default-assets';
const LS_KEY      = 'lh_sharedDefaultAssets';   // localStorage key for cached mapping
const LS_TS_KEY   = 'lh_sharedDefaultAssets_ts'; // timestamp of last successful fetch

// ── Local cache helpers ─────────────────────────────────────────────

/**
 * Read the cached shared mapping from localStorage.
 * @returns {Object<string, string>}  teamId → assetId
 */
export function loadSharedMapping() {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY)) || {};
    } catch {
        return {};
    }
}

/**
 * Persist a mapping into localStorage.
 * @param {Object<string, string>} mapping
 */
function saveSharedMapping(mapping) {
    localStorage.setItem(LS_KEY, JSON.stringify(mapping));
    localStorage.setItem(LS_TS_KEY, String(Date.now()));
}

// ── Fetch (GET) ─────────────────────────────────────────────────────

/**
 * Fetch shared default-asset mappings for the given teams from the
 * Lambda backend.  Only team IDs with >1 trackable asset should be
 * passed in — the caller is responsible for filtering.
 *
 * The result is merged into localStorage so that subsequent calls to
 * `loadSharedMapping()` return the latest data.
 *
 * @param {string}   apiUrl    The Beacon source URL (namespace).
 * @param {string[]} teamIds   Array of team ID strings.
 * @returns {Promise<Object<string, string>>}  teamId → assetId map
 */
export async function fetchSharedDefaults(apiUrl, teamIds) {
    if (!teamIds || teamIds.length === 0) return loadSharedMapping();

    const url = `${LAMBDA_BASE}?apiUrl=${encodeURIComponent(apiUrl)}&teamIds=${teamIds.join(',')}`;

    try {
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) {
            console.warn('[defaultAssetSync] GET failed:', res.status);
            return loadSharedMapping(); // fall back to cache
        }

        const { mapping } = await res.json();

        // Merge into existing cache (replace only the IDs we asked about,
        // keep any cached IDs we didn't ask about so they remain available).
        const cached = loadSharedMapping();
        const merged = { ...cached };

        // Overwrite with fresh data for requested IDs
        for (const id of teamIds) {
            if (mapping[id] !== undefined) {
                merged[id] = mapping[id];
            } else {
                // Lambda didn't return this ID → no shared default exists
                delete merged[id];
            }
        }

        saveSharedMapping(merged);
        return merged;
    } catch (err) {
        console.warn('[defaultAssetSync] fetch error:', err);
        return loadSharedMapping();
    }
}

// ── Push (PUT) ──────────────────────────────────────────────────────

/**
 * Push a single team's default-asset mapping to the Lambda backend.
 * Also updates localStorage immediately.
 *
 * @param {string}      apiUrl   The Beacon source URL (namespace).
 * @param {string}      teamId
 * @param {string|null} assetId  Pass null to clear.
 * @returns {Promise<void>}
 */
export async function pushSharedDefault(apiUrl, teamId, assetId) {
    // Optimistic local update
    const cached = loadSharedMapping();
    if (assetId != null) {
        cached[String(teamId)] = String(assetId);
    } else {
        delete cached[String(teamId)];
    }
    saveSharedMapping(cached);

    // Fire-and-forget remote write
    try {
        await fetch(LAMBDA_BASE, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiUrl,
                teamId: String(teamId),
                assetId: assetId != null ? String(assetId) : null,
            }),
        });
    } catch (err) {
        console.warn('[defaultAssetSync] push error:', err);
    }
}
