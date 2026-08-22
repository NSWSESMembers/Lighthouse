'use strict';

const { json, serverError } = require('./lib/response');
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
// header — enforced by the LH-BeaconAuthorizerV2 API Gateway authorizer
// before this Lambda is ever invoked (see lambda/authorizer-v2).
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

  // `sub` is the verified Beacon member id, passed through from the
  // LH-BeaconAuthorizerV2 authorizer's context.
  const userId = event.requestContext?.authorizer?.lambda?.sub || 'unknown';
  console.log(JSON.stringify({ msg: 'beacon_auth', fn: 'map-layers-v2', userId, route: routeKey }));

  try {
    // `claims` is passed through so permission-sensitive handlers
    // (createLayer, upsertFeature, deleteFeature, deleteLayer) can
    // authorize against claims.sub -- tamper-proof since it comes from the
    // gateway's signature-verified JWT -- rather than any client-supplied
    // actorId field, which a caller could set to whatever it wants.
    return await handler(event, { sub: userId });
  } catch (err) {
    console.error('map-layers-v2 handler error:', err, JSON.stringify({ routeKey }));
    return serverError();
  }
};
