/**
 * AWS Lambda — Default-Asset Mapping Store (v2, auth-gated)
 *
 * Stores each team's chosen default-asset as a small JSON file in S3,
 * namespaced by the Beacon API URL so different environments
 * (train / dev / prod) never collide.
 *
 * S3 structure:
 *   s3://{BUCKET}/{CONFIG_PREFIX}/{urlHash}/{teamId}.json
 *
 * Old objects are automatically expired by S3 Lifecycle policy.
 *
 * ── Routes ──
 *
 *   GET  /default-assets?apiUrl=…&teamIds=1,2,3
 *        → { "mapping": { "1": "assetA", "3": "assetC" } }
 *        Teams with no stored default are simply omitted from mapping.
 *
 *   PUT  /default-assets
 *        body: { "apiUrl": "…", "teamId": "…", "assetId": "…" }
 *        → { "saved": true, "teamId": "…", "assetId": "…" }
 *
 * Both routes require `Authorization: Bearer <Beacon access token>`.
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { verifyBeaconToken } from './verifyBeaconToken.mjs';

// ── Config ──────────────────────────────────────────────────────────
const BUCKET        = process.env.BUCKET_NAME   || 'lighthouse-default-assets';
const CONFIG_PREFIX = process.env.CONFIG_PREFIX  || '';

const s3 = new S3Client({});

// ── Helpers ─────────────────────────────────────────────────────────

/** Deterministic short hash of the API URL (namespace key). */
function hashApiUrl(apiUrl) {
    return crypto.createHash('sha256').update(apiUrl.trim().toLowerCase()).digest('hex').slice(0, 16);
}

/** Build the S3 object key for one team. */
function s3Key(urlHash, teamId) {
    const base = CONFIG_PREFIX ? `${CONFIG_PREFIX}/${urlHash}` : urlHash;
    return `${base}/${teamId}.json`;
}

/** Read a single object; returns parsed JSON or null if missing. */
async function getObject(key) {
    try {
        const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
        const body = await streamToString(res.Body);
        return JSON.parse(body);
    } catch (err) {
        const code = err.name || err.Code || '';
        const status = err.$metadata?.httpStatusCode;
        if (code === 'NoSuchKey' || code === 'NotFound' || status === 404 || status === 403) {
            return null;
        }
        // Unexpected error — log but don't throw; treat as missing
        console.warn('getObject unexpected error for key:', key, err);
        return null;
    }
}

/** Convert a readable stream to a string. */
function streamToString(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (c) => chunks.push(c));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
}

/** Standard JSON response helper. */
function respond(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: JSON.stringify(body),
    };
}

// ── Handler ─────────────────────────────────────────────────────────

export const handler = async (event) => {
    const method = event.httpMethod || event.requestContext?.http?.method || 'GET';

    // CORS preflight
    if (method === "OPTIONS") {
        return respond(204, '');
    }

    let claims;
    try {
        claims = await verifyBeaconToken(event.headers?.authorization || event.headers?.Authorization);
    } catch (err) {
        return respond(401, { error: 'Unauthorized', message: err?.message || String(err) });
    }
    console.log(JSON.stringify({ msg: 'beacon_auth', fn: 'default-assets-v2', userId: claims.sub || claims.client_id || 'unknown', method }));

    try {
        // ---------- GET: Bulk fetch for a list of team IDs ----------
        if (method === 'GET') {
            const qs = event.queryStringParameters || {};
            const apiUrl  = qs.apiUrl;
            const teamIds = qs.teamIds;

            if (!apiUrl || !teamIds) {
                return respond(400, { error: 'Missing required query params: apiUrl, teamIds' });
            }

            const urlHash = hashApiUrl(apiUrl);
            const ids = teamIds.split(',').map(s => s.trim()).filter(Boolean);

            if (ids.length === 0) {
                return respond(200, { mapping: {} });
            }

            // Fan-out reads (S3 handles concurrency well at this scale)
            const entries = await Promise.all(
                ids.map(async (id) => {
                    const data = await getObject(s3Key(urlHash, id));
                    return data ? [id, data.assetId] : null;
                })
            );

            const mapping = {};
            for (const entry of entries) {
                if (entry) mapping[entry[0]] = entry[1];
            }

            return respond(200, { mapping });
        }

        // ---------- PUT: Save a single mapping ----------
        if (method === 'PUT') {
            const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
            const { apiUrl, teamId, assetId } = body || {};

            if (!apiUrl || !teamId || !assetId) {
                return respond(400, { error: 'Missing required fields: apiUrl, teamId, assetId' });
            }

            const urlHash = hashApiUrl(apiUrl);
            const key = s3Key(urlHash, teamId);

            const payload = {
                teamId: String(teamId),
                assetId: String(assetId),
                updatedAt: new Date().toISOString(),
            };

            await s3.send(new PutObjectCommand({
                Bucket: BUCKET,
                Key: key,
                Body: JSON.stringify(payload),
                ContentType: 'application/json',
            }));

            return respond(200, { saved: true, teamId, assetId });
        }

        return respond(405, { error: `Method ${method} not allowed` });

    } catch (err) {
        console.error('Lambda error:', err);
        return respond(500, { error: 'Internal server error' });
    }
};
