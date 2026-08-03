import { createRemoteJWKSet, jwtVerify } from 'jose';

// SES's Beacon identity server (Duende/IdentityServer4). Configured via
// deployment env vars, never derived from the token or request, so a
// caller can't point verification at a JWKS they control.
const TRUSTED_ISS = process.env.TRUSTED_ISS;
const JWKS_URI = process.env.JWKS_URI;
const EXPECTED_AUD = process.env.EXPECTED_AUD;
const REQUIRED_SCOPE = 'beaconApi';

// Module-scope: persists (and caches fetched keys) across warm invocations.
const JWKS = createRemoteJWKSet(new URL(JWKS_URI));

/**
 * Verify an `Authorization: Bearer <token>` header is a currently-valid
 * Beacon access token. Throws on any failure; returns the token's claims
 * on success.
 */
export async function verifyBeaconToken(authorizationHeader) {
  const match = /^Bearer (.+)$/.exec(authorizationHeader || '');
  if (!match) throw new Error('Missing or malformed Authorization header');

  const { payload } = await jwtVerify(match[1], JWKS, {
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
