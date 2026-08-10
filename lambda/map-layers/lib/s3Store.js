'use strict';

const crypto = require('crypto');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({});
const BUCKET = process.env.BUCKET_NAME;
const S3_PREFIX = 'shared_layers';

/** Namespace every org's layers under a hash of its Beacon apiUrl. */
function orgPrefix(apiUrl) {
  const hash = crypto.createHash('sha256').update(String(apiUrl)).digest('hex').slice(0, 24);
  return `${S3_PREFIX}/${hash}`;
}

function indexKey(apiUrl) {
  return `${orgPrefix(apiUrl)}/index.json`;
}

function layerKey(apiUrl, layerId) {
  return `${orgPrefix(apiUrl)}/${layerId}.json`;
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

/** Read a JSON object from S3. Returns { data: null, etag: null } if it doesn't exist yet. */
async function getJson(key) {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await streamToString(res.Body);
    return { data: JSON.parse(body), etag: res.ETag };
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return { data: null, etag: null };
    }
    throw err;
  }
}

async function putJson(key, data, { ifMatch, ifNoneMatch } = {}) {
  const params = {
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  };
  if (ifMatch) params.IfMatch = ifMatch;
  if (ifNoneMatch) params.IfNoneMatch = ifNoneMatch;
  await s3.send(new PutObjectCommand(params));
}

/**
 * Read-modify-write the small per-org index.json with optimistic
 * concurrency (S3 conditional writes) + a short retry loop, since it's the
 * one object concurrent requests (e.g. two users creating a layer at the
 * same moment) could race on. Individual layer objects are only ever
 * written by requests for that one layer, so they don't need this.
 */
async function updateIndex(apiUrl, mutate, { retries = 3 } = {}) {
  const key = indexKey(apiUrl);
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, etag } = await getJson(key);
    const index = data || { apiUrl, layers: [] };
    const result = mutate(index);
    try {
      await putJson(key, index, etag ? { ifMatch: etag } : { ifNoneMatch: '*' });
      return result;
    } catch (err) {
      const status = err.$metadata?.httpStatusCode;
      // S3's conditional-write feature (IfMatch/IfNoneMatch on PutObject)
      // reports a lost race as 409 ConditionalRequestConflict, not the 412
      // Precondition Failed other conditional S3 operations use.
      if ((status === 409 || status === 412) && attempt < retries) continue; // lost the race, retry
      throw err;
    }
  }
  throw new Error(`updateIndex: exhausted retries for ${key}`);
}

async function getLayerObject(apiUrl, layerId) {
  const { data } = await getJson(layerKey(apiUrl, layerId));
  if (!data || data.apiUrl !== apiUrl) return null; // not found, or belongs to a different org
  return data;
}

async function putLayerObject(apiUrl, layerId, layer) {
  await putJson(layerKey(apiUrl, layerId), layer);
}

module.exports = { orgPrefix, indexKey, layerKey, getJson, putJson, updateIndex, getLayerObject, putLayerObject };
