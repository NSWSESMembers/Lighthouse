// API Gateway HTTP API Lambda authorizer (REQUEST type, simple responses,
// payload format 2.0) for the /lad_v2/... routes. Centralizes the Beacon
// token check that used to be duplicated in each of the five lad_v2
// Lambdas — same trusted-issuer allow-list, same JWKS verification, same
// required scope, via the shared verifyBeaconToken.mjs (see TRUSTED_ISS env
// var to add/remove issuers).
//
// On success, `sub` (the Beacon member id) is returned in `context`, which
// API Gateway forwards to the backend Lambda at
// event.requestContext.authorizer.lambda.sub — so downstream handlers don't
// need the raw token to know who's calling.
import { verifyBeaconToken } from './verifyBeaconToken.mjs';

export const handler = async (event) => {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;

  try {
    const claims = await verifyBeaconToken(authHeader);
    return {
      isAuthorized: true,
      context: {
        sub: String(claims.sub || claims.client_id || 'unknown'),
      },
    };
  } catch (err) {
    console.log(JSON.stringify({
      msg: 'beacon_auth_denied',
      fn: 'authorizer-v2',
      path: event.rawPath,
      error: err?.message || String(err),
    }));
    return { isAuthorized: false };
  }
};
