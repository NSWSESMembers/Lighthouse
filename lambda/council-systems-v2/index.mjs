/**
 * AWS Lambda — Council systems (v2, auth-gated)
 *
 * GET /lad_v2/council/{council}/{dataset}
 *   → GeoJSON FeatureCollection of one dataset from a council's own system
 *     (see councils.mjs), with
 *     `meta = { council, councilName, system, dataset, generatedAt, ok,
 *               lastGoodAt, error? }`.
 *
 * Fetched on demand only: nothing runs while nobody has the layer on.
 * A request uses, in order:
 *   1. this warm instance's in-memory copy, if under the dataset's TTL;
 *   2. the copy saved in S3, if under the TTL;
 *   3. a fresh fetch. If that fails, the last good copy is returned with
 *      `ok: false` and the error, so a council system being down never
 *      empties the map, and the next request after a minute tries again.
 *      With no good copy at all it's a 502.
 *
 * Auth is enforced by the LH-BeaconAuthorizerV2 API Gateway authorizer.
 *
 * Env:
 *   BUCKET_NAME       S3 bucket for the cached copies (required for 2/3 to
 *                     survive cold starts; without it only 1 is used)
 *   CACHE_PREFIX      key prefix, default council-systems/
 *   FETCH_TIMEOUT_MS  per upstream request, default 8000
 */

import { gzipSync } from 'node:zlib';
import { COUNCILS } from './councils.mjs';

const BUCKET = process.env.BUCKET_NAME || '';
const CACHE_PREFIX = process.env.CACHE_PREFIX || 'council-systems/';
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS) || 8000;

const FETCH_HEADERS = {
  'user-agent': 'Mozilla/5.0 (compatible; Lighthouse NSW SES extension; +https://lighthouse-extension.com)',
};

const corsHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
};

// Loaded lazily: the AWS SDK ships with the Lambda Node.js runtime but isn't
// a dependency of this repo, so tests and local runs never import it.
let s3sdk;
async function getS3() {
  if (!s3sdk) {
    const sdk = await import('@aws-sdk/client-s3');
    s3sdk = { sdk, client: new sdk.S3Client({}) };
  }
  return s3sdk;
}

// ── Cache ───────────────────────────────────────────────────────────
// Stored shape, per council/dataset: { generatedAt, ok, lastGoodAt, error, features }

const memory = new Map(); // `${council}/${dataset}` -> stored shape
const inFlight = new Map(); // one refresh at a time per key per instance

async function readSaved(key) {
  if (!BUCKET) return null;
  try {
    const { sdk, client } = await getS3();
    const res = await client.send(new sdk.GetObjectCommand({ Bucket: BUCKET, Key: `${CACHE_PREFIX}${key}.json` }));
    return JSON.parse(await res.Body.transformToString('utf-8'));
  } catch (err) {
    const status = err.$metadata?.httpStatusCode;
    if (err.name !== 'NoSuchKey' && status !== 404 && status !== 403) {
      console.warn(JSON.stringify({ msg: 'cache_read_failed', fn: 'council-systems-v2', key, error: err.message }));
    }
    return null;
  }
}

async function writeSaved(key, state) {
  if (!BUCKET) return;
  try {
    const { sdk, client } = await getS3();
    await client.send(new sdk.PutObjectCommand({
      Bucket: BUCKET,
      Key: `${CACHE_PREFIX}${key}.json`,
      Body: JSON.stringify(state),
      ContentType: 'application/json',
    }));
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'cache_write_failed', fn: 'council-systems-v2', key, error: err.message }));
  }
}

const RETRY_MS = 60 * 1000; // a failed fetch is retried after this, not after the dataset's TTL

const isFresh = (state, ttlMs, now) =>
  state && now - Date.parse(state.generatedAt) < (state.ok ? ttlMs : Math.min(ttlMs, RETRY_MS));

// ── Fetching ────────────────────────────────────────────────────────

// fetchJson(url, { headers, timeoutMs }): extra headers are a login (e.g. a
// Lizard key), so a redirect is refused rather than followed somewhere else
// with it. timeoutMs overrides FETCH_TIMEOUT_MS for a big download.
function makeFetchJson(fetchImpl) {
  return async (url, { headers, timeoutMs } = {}) => {
    const res = await fetchImpl(url, {
      headers: { ...FETCH_HEADERS, accept: 'application/json', ...headers },
      ...(headers ? { redirect: 'error' } : {}),
      signal: AbortSignal.timeout(timeoutMs || FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
}

/**
 * Load one dataset; on failure keep `previous`'s features.
 * Exported for tests.
 */
export async function refresh(dataset, previous, { fetchImpl = fetch, now = Date.now(), key = '' } = {}) {
  const nowIso = new Date(now).toISOString();
  try {
    const features = await dataset.load(makeFetchJson(fetchImpl), now);
    return { generatedAt: nowIso, ok: true, lastGoodAt: nowIso, error: null, features };
  } catch (err) {
    const error = err?.name === 'TimeoutError'
      ? 'Timed out'
      : [err?.message || String(err), err?.cause?.code || err?.cause?.message].filter(Boolean).join(': ');
    console.warn(JSON.stringify({ msg: 'source_failed', fn: 'council-systems-v2', key, error }));
    return {
      generatedAt: nowIso,
      ok: false,
      lastGoodAt: previous?.lastGoodAt || null,
      error,
      features: previous?.features || [],
    };
  }
}

/**
 * "/lad_v2/council/parramatta/water-levels" -> { council, dataset }, or null.
 * Exported for tests.
 */
export function parsePath(path) {
  const m = String(path || '').match(/\/council\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/);
  return m ? { council: m[1], dataset: m[2] } : null;
}

/** The dataset a route asks for, or null. */
function routeDataset(route) {
  const council = route && Object.hasOwn(COUNCILS, route.council) ? COUNCILS[route.council] : null;
  return council && Object.hasOwn(council.datasets, route.dataset) ? council.datasets[route.dataset] : null;
}

async function getState(key, dataset) {
  const now = Date.now();
  const ttlMs = dataset.ttlSeconds * 1000;
  if (isFresh(memory.get(key), ttlMs, now)) return memory.get(key);
  if (!inFlight.has(key)) {
    inFlight.set(key, (async () => {
      const saved = await readSaved(key);
      if (isFresh(saved, ttlMs, now)) return saved;
      const next = await refresh(dataset, saved || memory.get(key), { key });
      await writeSaved(key, next);
      return next;
    })().finally(() => inFlight.delete(key)));
  }
  const state = await inFlight.get(key);
  memory.set(key, state);
  return state;
}

// ── Handler ─────────────────────────────────────────────────────────

const json = (statusCode, body) => ({ statusCode, headers: corsHeaders, body: JSON.stringify(body) });

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod;
  if (method === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };

  const route = parsePath(event?.rawPath || event?.path);
  const dataset = routeDataset(route);
  if (!dataset) return json(404, { error: 'Unknown council system' });
  const council = COUNCILS[route.council];
  const key = `${route.council}/${route.dataset}`;

  const userId = event?.requestContext?.authorizer?.lambda?.sub || 'unknown';
  console.log(JSON.stringify({ msg: 'beacon_auth', fn: 'council-systems-v2', userId, key }));

  try {
    const state = await getState(key, dataset);
    if (!state.ok && !state.lastGoodAt) {
      return json(502, { error: `Could not load ${council.system} (${state.error})` });
    }
    const body = JSON.stringify({
      type: 'FeatureCollection',
      features: state.features,
      meta: {
        council: route.council,
        councilName: council.name,
        system: council.system,
        dataset: route.dataset,
        generatedAt: state.generatedAt,
        ok: state.ok,
        lastGoodAt: state.lastGoodAt,
        ...(state.error ? { error: state.error } : {}),
      },
    });
    const headers = { ...corsHeaders, 'cache-control': 'private, max-age=60', vary: 'accept-encoding' };
    // CloudFront can't compress lad_v2 routes (their cache policy is CachingDisabled).
    if (/\bgzip\b/i.test(event?.headers?.['accept-encoding'] || '')) {
      return {
        statusCode: 200,
        headers: { ...headers, 'content-encoding': 'gzip' },
        isBase64Encoded: true,
        body: gzipSync(body).toString('base64'),
      };
    }
    return { statusCode: 200, headers, body };
  } catch (err) {
    console.error(JSON.stringify({ msg: 'council_systems_failed', fn: 'council-systems-v2', key, error: err?.message || String(err) }));
    return json(502, { error: 'Could not load council system' });
  }
};
