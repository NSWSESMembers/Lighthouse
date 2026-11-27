/**
 * Client side of the council systems Lambda (lambda/council-systems-v2):
 * GET /lad_v2/council/{council}/{dataset} returns one GeoJSON
 * FeatureCollection from a council's own system, with
 * meta = { council, councilName, system, dataset, generatedAt, ok, lastGoodAt, error? }.
 * Used by the tasking map's Council Systems overlays.
 */

export const COUNCIL_SYSTEMS_URL = 'https://lambda.lighthouse-extension.com/lad_v2/council';

/**
 * GET one council dataset. Throws on a non-2xx response, a body that isn't a
 * FeatureCollection, or a source that's down with nothing cached, so the
 * Layers menu shows the error instead of an empty layer.
 * @param {string} council e.g. 'parramatta'
 * @param {string} dataset e.g. 'water-levels'
 * @param {string} token Beacon access token
 */
export function fetchCouncilDataset(council, dataset, token, opts) {
  if (![council, dataset].every((part) => /^[a-z0-9-]+$/.test(String(part)))) {
    return Promise.reject(new Error('Council systems: bad path'));
  }
  return fetchCouncilPath(`${council}/${dataset}`, token, opts);
}

/**
 * GET a council systems path the Lambda handed out, e.g. a camera's
 * `latestPath` ('tweed/flood-cameras/oaksave'). Only a plain path under
 * COUNCIL_SYSTEMS_URL, so the token never goes anywhere else.
 */
export async function fetchCouncilPath(path, token, { fetchImpl = fetch } = {}) {
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+){1,2}$/.test(String(path))) throw new Error('Council systems: bad path');
  const res = await fetchImpl(`${COUNCIL_SYSTEMS_URL}/${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit',
  });
  if (!res.ok) throw new Error(`Council systems: HTTP ${res.status}`);
  const body = await res.json();
  if (!body || !Array.isArray(body.features)) throw new Error('Council systems: unexpected response');
  if (body.meta?.ok === false && !body.features.length) {
    throw new Error(`${body.meta.system || 'Council system'} is not responding`);
  }
  return body;
}
