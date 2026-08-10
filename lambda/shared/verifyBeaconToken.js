'use strict';

// SES's Beacon identity server (Duende/IdentityServer4) runs one instance
// per environment (prod, train, ...), each issuing tokens with a different
// `iss` and its own signing keys at `<iss>/.well-known/jwks`. The allowed
// issuers are configured via a deployment env var, never derived from the
// token itself, so a caller can't point verification at a JWKS they control.
const TRUSTED_ISS = (process.env.TRUSTED_ISS || '')
  .split(',')
  .map((iss) => iss.trim())
  .filter(Boolean);
const REQUIRED_SCOPE = 'beaconApi';

// jose ships ESM-only; a CommonJS module has to load it via dynamic
// import(), which Node supports from CJS too. Cached in module scope so it
// only happens once per warm Lambda instance.
let josePromise;
function loadJose() {
  if (!josePromise) josePromise = import('jose');
  return josePromise;
}

// One remote JWKS per trusted issuer, cached across warm invocations.
const jwksByIssuer = new Map();
async function getJwks(iss) {
  if (!jwksByIssuer.has(iss)) {
    const { createRemoteJWKSet } = await loadJose();
    jwksByIssuer.set(iss, createRemoteJWKSet(new URL(`${iss}/.well-known/jwks`)));
  }
  return jwksByIssuer.get(iss);
}

/**
 * Verify an `Authorization: Bearer <token>` header is a currently-valid
 * Beacon access token. Throws on any failure; returns the token's claims
 * on success.
 */
async function verifyBeaconToken(authorizationHeader) {
  const match = /^Bearer (.+)$/.exec(authorizationHeader || '');
  if (!match) throw new Error('Missing or malformed Authorization header');

  const { jwtVerify, decodeJwt } = await loadJose();

  // This iss is unverified until jwtVerify checks it below - it's only
  // used to pick which allow-listed issuer's JWKS to fetch, never to
  // build a URL from an untrusted value.
  let unverifiedIss;
  try {
    unverifiedIss = decodeJwt(match[1]).iss;
  } catch {
    throw new Error('Malformed token');
  }

  if (!TRUSTED_ISS.includes(unverifiedIss)) {
    throw new Error(`Untrusted token issuer: ${unverifiedIss}`);
  }

  const jwks = await getJwks(unverifiedIss);

  const { payload } = await jwtVerify(match[1], jwks, {
    issuer: unverifiedIss,
    audience: `${unverifiedIss}/resources`,
    algorithms: ['RS256'],
  });

  const scopes = Array.isArray(payload.scope) ? payload.scope : String(payload.scope || '').split(' ');
  if (!scopes.includes(REQUIRED_SCOPE)) {
    throw new Error(`Token missing required scope: ${REQUIRED_SCOPE}`);
  }

  return payload;
}

module.exports = { verifyBeaconToken };
