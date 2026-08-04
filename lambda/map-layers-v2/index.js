'use strict';

const { json, serverError } = require('./lib/response');
const { verifyBeaconToken } = require('./verifyBeaconToken');
const listLayers = require('./handlers/listLayers');
const createLayer = require('./handlers/createLayer');
const getLayer = require('./handlers/getLayer');
const upsertFeature = require('./handlers/upsertFeature');
const deleteFeature = require('./handlers/deleteFeature');
const addMarkerComment = require('./handlers/addMarkerComment');

// Single Lambda fronting all /lad_v2/map-layers routes via API Gateway HTTP
// API (payload format 2.0) Lambda proxy integration. Routed by
// event.routeKey, which API Gateway sets to "<METHOD> <route path>" for
// whichever route matched (e.g. "GET /lad_v2/map-layers/{id}"). Every route
// except OPTIONS requires a valid `Authorization: Bearer <Beacon token>`
// header, verified against SES's identity server (see
// ./verifyBeaconToken.js).
const ROUTES = {
  'GET /lad_v2/map-layers': listLayers,
  'POST /lad_v2/map-layers': createLayer,
  'GET /lad_v2/map-layers/{id}': getLayer,
  'PUT /lad_v2/map-layers/{id}/features': upsertFeature,
  'DELETE /lad_v2/map-layers/{id}/features/{markerId}': deleteFeature,
  'POST /lad_v2/map-layers/{id}/features/{markerId}/comments': addMarkerComment,
};

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method;

  if (method === 'OPTIONS') return json(204, null);

  const routeKey = event.requestContext?.routeKey;
  const handler = ROUTES[routeKey];

  if (!handler) {
    return json(404, { error: 'Not found', routeKey });
  }

  let claims;
  try {
    claims = await verifyBeaconToken(event.headers?.authorization || event.headers?.Authorization);
  } catch (err) {
    return json(401, { error: 'Unauthorized', message: err?.message || String(err) });
  }
  console.log(JSON.stringify({ msg: 'beacon_auth', fn: 'map-layers-v2', userId: claims.sub || claims.client_id || 'unknown', route: routeKey }));

  try {
    return await handler(event);
  } catch (err) {
    console.error('map-layers-v2 handler error:', err, JSON.stringify({ routeKey }));
    return serverError();
  }
};
