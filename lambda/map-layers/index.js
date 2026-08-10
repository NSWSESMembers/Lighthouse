'use strict';

const { json, serverError } = require('./lib/response');
const listLayers = require('./handlers/listLayers');
const createLayer = require('./handlers/createLayer');
const getLayer = require('./handlers/getLayer');
const upsertFeature = require('./handlers/upsertFeature');
const deleteFeature = require('./handlers/deleteFeature');

// Single Lambda fronting all /lad/map-layers routes via API Gateway HTTP
// API (payload format 2.0) Lambda proxy integration. Routed by
// event.routeKey, which API Gateway sets to "<METHOD> <route path>" for
// whichever route matched (e.g. "GET /lad/map-layers/{id}") -- see the
// README for how these routes are created. The routes themselves are
// defined with the "/lad" prefix (matching the other Lighthouse Lambdas at
// lambda.lighthouse-extension.com/lad/...), not added by a base path
// mapping, so the custom domain's API mapping should not add another one.
const ROUTES = {
  'GET /lad/map-layers': listLayers,
  'POST /lad/map-layers': createLayer,
  'GET /lad/map-layers/{id}': getLayer,
  'PUT /lad/map-layers/{id}/features': upsertFeature,
  'DELETE /lad/map-layers/{id}/features/{markerId}': deleteFeature,
};

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method;

  if (method === 'OPTIONS') return json(204, null);

  const routeKey = event.requestContext?.routeKey;
  const handler = ROUTES[routeKey];

  if (!handler) {
    return json(404, { error: 'Not found', routeKey });
  }

  try {
    return await handler(event);
  } catch (err) {
    console.error('map-layers handler error:', err, JSON.stringify({ routeKey }));
    return serverError();
  }
};
