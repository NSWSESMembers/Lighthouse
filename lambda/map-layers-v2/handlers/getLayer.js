'use strict';

const { getLayerObject, putLayerObject, updateIndex } = require('../lib/s3Store');
const { json, badRequest, notFound } = require('../lib/response');

// GET /map-layers/{id}?apiUrl=...
// Returns the full layer (including markers) and bumps lastUsedAt --
// viewing a layer counts as "use" so actively-watched-but-not-edited
// layers don't age out of listLayers() mid-incident.
module.exports = async function getLayer(event) {
  const apiUrl = event.queryStringParameters?.apiUrl;
  const layerId = event.pathParameters?.id;
  if (!apiUrl || !layerId) return badRequest('apiUrl and layer id are required');

  const layer = await getLayerObject(apiUrl, layerId);
  if (!layer) return notFound('Layer not found');

  const now = new Date().toISOString();
  layer.lastUsedAt = now;
  await putLayerObject(apiUrl, layerId, layer);
  await updateIndex(apiUrl, (index) => {
    const entry = index.layers.find((l) => l.id === layerId);
    if (entry) entry.lastUsedAt = now;
  });

  return json(200, layer);
};
