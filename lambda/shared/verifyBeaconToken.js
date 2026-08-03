'use strict';

// SES's Beacon identity server (Duende/IdentityServer4). Configured via
// deployment env vars, never derived from the token or request, so a
// caller can't point verification at a JWKS they control.
const TRUSTED_ISS = process.env.TRUSTED_ISS;
const JWKS_URI = process.env.JWKS_URI;
const EXPECTED_AUD = process.env.EXPECTED_AUD;
const REQUIRED_SCOPE = 'beaconApi';

// jose ships ESM-only; a CommonJS module has to load it via dynamic
// import(), which Node supports from CJS too. Cached in module scope so it
// only happens once per warm Lambda instance.
let josePromise;
function loadJose() {
  if (!josePromise) josePromise = import('jose');
  return josePromise;
}

let jwksPromise;
function getJwks() {
  if (!jwksPromise) {
    jwksPromise = loadJose().then(({ createRemoteJWKSet }) => createRemoteJWKSet(new URL(JWKS_URI)));
  }
  return jwksPromise;
}

/**
 * Verify an `Authorization: Bearer <token>` header is a currently-valid
 * Beacon access token. Throws on any failure; returns the token's claims
 * on success.
 */
async function verifyBeaconToken(authorizationHeader) {
  const match = /^Bearer (.+)$/.exec(authorizationHeader || '');
  if (!match) throw new Error('Missing or malformed Authorization header');

  const [{ jwtVerify }, jwks] = await Promise.all([loadJose(), getJwks()]);

  const { payload } = await jwtVerify(match[1], jwks, {
    issuer: TRUSTED_ISS,
    audience: EXPECTED_AUD,
    algorithms: ['RS256'],
  });

  const scopes = Array.isArray(payload.scope) ? payload.scope : String(payload.scope || '').split(' ');
  if (!scopes.includes(REQUIRED_SCOPE)) {
    throw new Error(`Token missing required scope: ${REQUIRED_SCOPE}`);
  }

  return payload;
}

module.exports = { verifyBeaconToken };
