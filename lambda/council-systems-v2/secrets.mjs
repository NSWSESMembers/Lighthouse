/**
 * API keys for council systems that need a login, from Secrets Manager.
 *
 * LIZARD_SECRET_ID (default council-systems/lizard) is a JSON object of
 * Lizard API keys by portal host, e.g. { "parramatta.lizard.net": "..." }.
 * A key is only ever sent to its own portal.
 */

const LIZARD_SECRET_ID = process.env.LIZARD_SECRET_ID || 'council-systems/lizard';
const TTL_MS = 15 * 60 * 1000; // pick up a rotated key without a redeploy

let cached = null; // { at, keys }

// Loaded lazily: the AWS SDK ships with the Lambda Node.js runtime but isn't
// a dependency of this repo, so tests and local runs never import it.
async function readSecret() {
  const sdk = await import('@aws-sdk/client-secrets-manager');
  const client = new sdk.SecretsManagerClient({});
  const res = await client.send(new sdk.GetSecretValueCommand({ SecretId: LIZARD_SECRET_ID }));
  return JSON.parse(res.SecretString || '{}');
}

/** Headers for a Lizard portal's API: HTTP Basic with the username __key__. Throws if there's no key for it. */
export async function lizardAuthHeaders(portalHost, { load = readSecret, now = Date.now() } = {}) {
  if (!cached || now - cached.at > TTL_MS) cached = { at: now, keys: await load() };
  const key = cached.keys[portalHost];
  if (!key) throw new Error(`No Lizard key for ${portalHost}`);
  return { authorization: `Basic ${Buffer.from(`__key__:${key}`).toString('base64')}` };
}

/** For tests. */
export function resetSecretsCache() {
  cached = null;
}
