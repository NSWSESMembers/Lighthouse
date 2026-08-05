'use strict';

const { getLayerObject, putLayerObject, updateIndex } = require('../lib/s3Store');
const { json, badRequest, notFound, forbidden } = require('../lib/response');
const { commentMode, isAuthorized } = require('../lib/permissions');

// POST /map-layers/{id}/features/{markerId}/comments
// body: { apiUrl, actorId, opsLogId }
//
// Appends the id of a client-side-created Operations Log entry to the
// marker's comment thread. Like upsertFeature's opsLogId, this Lambda only
// stores the pointer -- the comment's text/author lives entirely in that
// Ops Log entry and is resolved via BeaconClient.operationslog.get().
module.exports = async function addMarkerComment(event, claims) {
  const layerId = event.pathParameters?.id;
  const markerId = event.pathParameters?.markerId;
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return badRequest('Invalid JSON body');
  }

  const apiUrl = body.apiUrl;
  const actorId = String(body.actorId || '').slice(0, 100);
  const opsLogId = Number(body.opsLogId);
  const memberId = String(claims?.sub || '');

  if (!apiUrl || !layerId || !markerId) {
    return badRequest('apiUrl, layer id and marker id are required');
  }
  if (!Number.isFinite(opsLogId)) return badRequest('opsLogId must be a number');

  const layer = await getLayerObject(apiUrl, layerId);
  if (!layer) return notFound('Layer not found');

  const marker = layer.markers.find((m) => m.id === markerId);
  if (!marker) return notFound('Marker not found');

  if (!isAuthorized(commentMode(layer), layer, memberId)) {
    return forbidden('You do not have permission to comment on this layer');
  }

  marker.commentOpsLogIds = Array.isArray(marker.commentOpsLogIds) ? marker.commentOpsLogIds : [];
  marker.commentOpsLogIds.push(opsLogId);

  const now = new Date().toISOString();
  marker.updatedBy = actorId || marker.updatedBy;
  marker.updatedAt = now;

  layer.lastUsedAt = now;
  await putLayerObject(apiUrl, layerId, layer);

  await updateIndex(apiUrl, (index) => {
    const entry = index.layers.find((l) => l.id === layerId);
    if (entry) entry.lastUsedAt = now;
  });

  return json(200, marker);
};
