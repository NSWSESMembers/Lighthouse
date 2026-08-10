'use strict';

const { getLayerObject, putLayerObject, updateIndex } = require('../lib/s3Store');
const { json, badRequest, notFound, forbidden } = require('../lib/response');
const { deleteMode, isAuthorized } = require('../lib/permissions');

// DELETE /map-layers/{id}?apiUrl=...&actorId=...
//
// Soft-deletes the layer: marks it `deleted: true` on the S3 object (so
// getLayerObject treats it as not-found everywhere -- get/upsert/delete
// feature, add comment) and drops it from the org's index so it stops
// appearing in listLayers(). The object itself is never removed from S3,
// matching the same "never truly delete" recoverability the marker
// soft-delete and the listLayers staleness filter already rely on.
module.exports = async function deleteLayer(event, claims) {
  const layerId = event.pathParameters?.id;
  const apiUrl = event.queryStringParameters?.apiUrl;
  // actorId is client-supplied bookkeeping (stamped as deletedBy) -- never
  // used for authorization, see memberId below.
  const actorId = String(event.queryStringParameters?.actorId || '').slice(0, 100);
  const memberId = String(claims?.sub || '');

  if (!apiUrl || !layerId) return badRequest('apiUrl and layer id are required');

  const layer = await getLayerObject(apiUrl, layerId);
  if (!layer) return notFound('Layer not found');

  if (!isAuthorized(deleteMode(layer), layer, memberId)) {
    return forbidden('You do not have permission to delete this layer');
  }

  const now = new Date().toISOString();
  layer.deleted = true;
  layer.deletedBy = actorId;
  layer.deletedAt = now;
  await putLayerObject(apiUrl, layerId, layer);

  await updateIndex(apiUrl, (index) => {
    index.layers = (index.layers || []).filter((l) => l.id !== layerId);
  });

  return json(204, null);
};
