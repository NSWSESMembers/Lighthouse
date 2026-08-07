'use strict';

const { json, serverError } = require('./lib/response');
const { verifyBeaconToken } = require('./verifyBeaconToken');
const listLayers = require('./handlers/listLayers');
const createLayer = require('./handlers/createLayer');
const getLayer = require('./handlers/getLayer');
const upsertFeature = require('./handlers/upsertFeature');
const deleteFeature = require('./handlers/deleteFeature');
const addMarkerComment = require('./handlers/addMarkerComment');
const deleteLayer = require('./handlers/deleteLayer');
const updateLayerModerators = require('./handlers/updateLayerModerators');
const updateLayerPermissions = require('./handlers/updateLayerPermissions');
const updateLayerAttachment = require('./handlers/updateLayerAttachment');

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
  'DELETE /lad_v2/map-layers/{id}': deleteLayer,
  'PUT /lad_v2/map-layers/{id}/moderators': updateLayerModerators,
  'PUT /lad_v2/map-layers/{id}/permissions': updateLayerPermissions,
  'PUT /lad_v2/map-layers/{id}/attachment': updateLayerAttachment,
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
    // `claims` (the verified token payload) is passed through so
    // permission-sensitive handlers (createLayer, upsertFeature,
    // deleteFeature, deleteLayer) can authorize against claims.sub -- the
    // Beacon member id, tamper-proof since it comes from a signature-
    // verified JWT -- rather than any client-supplied actorId field, which
    // a caller could set to whatever it wants.
    return await handler(event, claims);
  } catch (err) {
    console.error('map-layers-v2 handler error:', err, JSON.stringify({ routeKey }));
    return serverError();
  }
};
