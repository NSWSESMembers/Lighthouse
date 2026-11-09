/**
 * AWS Lambda — NSW Power Outages (v2, auth-gated)
 *
 * GET /lad_v2/power-outages
 *   → GeoJSON FeatureCollection of current Ausgrid, Endeavour Energy and
 *     Essential Energy outages (unplanned, plus planned ones starting in the
 *     next 48 hours), normalised by providers.mjs, with
 *     `meta.providers[name] = { ok, fetchedAt, count, error? }`.
 *
 * Fetched on demand only: nothing runs while nobody has the layer on.
 * A request uses, in order:
 *   1. this warm instance's in-memory copy, if under CACHE_TTL_SECONDS old;
 *   2. the copy saved in S3, if under CACHE_TTL_SECONDS old;
 *   3. a fresh fetch of all three companies (each with a time limit). A
 *      company that fails or times out keeps its last good outages from the
 *      saved copy, with `ok: false` and the error, so one company being down
 *      never empties the map.
 *
 * Auth is enforced by the LH-BeaconAuthorizerV2 API Gateway authorizer.
 *
 * Env:
 *   BUCKET_NAME        S3 bucket for the cached copy (required for 2/3 to
 *                      survive cold starts; without it only 1 is used)
 *   CACHE_KEY          object key, default power-outages/latest.json
 *   CACHE_TTL_SECONDS  default 120
 *   FETCH_TIMEOUT_MS   per company, default 6000
 */

import { gzipSync } from 'node:zlib';
import { PROVIDERS, isRelevant } from './providers.mjs';

const BUCKET = process.env.BUCKET_NAME || '';
const CACHE_KEY = process.env.CACHE_KEY || 'power-outages/latest.json';
const TTL_MS = (Number(process.env.CACHE_TTL_SECONDS) || 120) * 1000;
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS) || 6000;

// A plain browser-like User-Agent: the companies' sites sit behind web
// application firewalls that may turn away unknown clients.
const FETCH_HEADERS = {
  'user-agent': 'Mozilla/5.0 (compatible; Lighthouse NSW SES extension; +https://lighthouse-extension.com)',
  accept: 'application/json, application/vnd.google-earth.kml+xml, text/xml, */*',
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
// Stored shape: { generatedAt, providers: { [name]: { ok, fetchedAt,
//   lastGoodAt, error, features } } }

let memory = null; // last stored shape this instance has seen
let inFlight = null; // one refresh at a time per instance

async function readSaved() {
  if (!BUCKET) return null;
  try {
    const { sdk, client } = await getS3();
    const res = await client.send(new sdk.GetObjectCommand({ Bucket: BUCKET, Key: CACHE_KEY }));
    return JSON.parse(await res.Body.transformToString('utf-8'));
  } catch (err) {
    const status = err.$metadata?.httpStatusCode;
    if (err.name !== 'NoSuchKey' && status !== 404 && status !== 403) {
      console.warn(JSON.stringify({ msg: 'cache_read_failed', fn: 'power-outages-v2', error: err.message }));
    }
    return null;
  }
}

async function writeSaved(state) {
  if (!BUCKET) return;
  try {
    const { sdk, client } = await getS3();
    await client.send(new sdk.PutObjectCommand({
      Bucket: BUCKET,
      Key: CACHE_KEY,
      Body: JSON.stringify(state),
      ContentType: 'application/json',
    }));
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'cache_write_failed', fn: 'power-outages-v2', error: err.message }));
  }
}

const isFresh = (state, now) => state && now - Date.parse(state.generatedAt) < TTL_MS;

// ── Fetching ────────────────────────────────────────────────────────

async function fetchText(url, fetchImpl) {
  const res = await fetchImpl(url, {
    headers: FETCH_HEADERS,
    redirect: 'manual', // a redirect means the feed moved (it lands on a web page)
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (res.status >= 300 && res.status < 400) throw new Error(`HTTP ${res.status} redirect, feed has moved`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/**
 * Fetch every company; a failed one keeps `previous`'s outages for it.
 * Exported for tests.
 */
export async function refresh(previous, { fetchImpl = fetch, now = Date.now() } = {}) {
  const nowIso = new Date(now).toISOString();
  const entries = await Promise.all(
    Object.entries(PROVIDERS).map(async ([name, p]) => {
      try {
        const features = p.parse(await fetchText(p.url, fetchImpl));
        return [name, { ok: true, fetchedAt: nowIso, lastGoodAt: nowIso, error: null, features }];
      } catch (err) {
        const error = err?.name === 'TimeoutError'
          ? 'Timed out'
          : [err?.message || String(err), err?.cause?.code || err?.cause?.message].filter(Boolean).join(': ');
        console.warn(JSON.stringify({ msg: 'provider_failed', fn: 'power-outages-v2', provider: name, error }));
        const prev = previous?.providers?.[name];
        return [name, {
          ok: false,
          fetchedAt: nowIso,
          lastGoodAt: prev?.lastGoodAt || null,
          error,
          features: prev?.features || [],
        }];
      }
    }),
  );
  return { generatedAt: nowIso, providers: Object.fromEntries(entries) };
}

/** Stored shape -> response body. Exported for tests. */
export function toResponseBody(state, now = Date.now()) {
  const features = [];
  const providers = {};
  for (const [name, p] of Object.entries(state.providers || {})) {
    // Planned outages are re-filtered so a stale company's ended ones drop off.
    const relevant = (p.features || []).filter((f) => isRelevant(f.properties, now));
    features.push(...relevant);
    providers[name] = {
      name: PROVIDERS[name]?.name || name,
      ok: !!p.ok,
      fetchedAt: p.fetchedAt,
      lastGoodAt: p.lastGoodAt,
      count: relevant.length,
      ...(p.error ? { error: p.error } : {}),
    };
  }
  return { type: 'FeatureCollection', features, meta: { generatedAt: state.generatedAt, providers } };
}

async function getState() {
  const now = Date.now();
  if (isFresh(memory, now)) return memory;
  if (!inFlight) {
    inFlight = (async () => {
      const saved = await readSaved();
      if (isFresh(saved, now)) return saved;
      const next = await refresh(saved || memory);
      await writeSaved(next);
      return next;
    })().finally(() => { inFlight = null; });
  }
  memory = await inFlight;
  return memory;
}

// ── Handler ─────────────────────────────────────────────────────────

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod;
  if (method === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };

  const userId = event?.requestContext?.authorizer?.lambda?.sub || 'unknown';
  console.log(JSON.stringify({ msg: 'beacon_auth', fn: 'power-outages-v2', userId }));

  try {
    const body = JSON.stringify(toResponseBody(await getState()));
    const headers = { ...corsHeaders, 'cache-control': 'private, max-age=60', vary: 'accept-encoding' };
    // CloudFront can't compress this route (its cache policy is CachingDisabled).
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
    console.error(JSON.stringify({ msg: 'power_outages_failed', fn: 'power-outages-v2', error: err?.message || String(err) }));
    return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'Could not load power outages' }) };
  }
};
