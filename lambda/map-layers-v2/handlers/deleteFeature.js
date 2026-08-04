'use strict';

const { getLayerObject, putLayerObject, updateIndex } = require('../lib/s3Store');
const { json, badRequest, notFound, forbidden } = require('../lib/response');

// DELETE /map-layers/{id}/features/{markerId}?apiUrl=...&actorId=...
// Soft-deletes the marker (sets deleted: true) rather than removing it, so
// a concurrent stale edit can't resurrect a corrupted record and deletes
// are recoverable by a human editing S3 directly if needed.
module.exports = async function deleteFeature(event, claims) {
  const layerId = event.pathParameters?.id;
  const markerId = event.pathParameters?.markerId;
  const apiUrl = event.queryStringParameters?.apiUrl;
  // actorId is client-supplied bookkeeping (stamped as updatedBy) -- never
  // used for authorization, see memberId below.
  const actorId = String(event.queryStringParameters?.actorId || '').slice(0, 100);
  const memberId = String(claims?.sub || '');

  if (!apiUrl || !layerId || !markerId) {
    return badRequest('apiUrl, layer id and marker id are required');
  }

  const layer = await getLayerObject(apiUrl, layerId);
  if (!layer) return notFound('Layer not found');

  const marker = layer.markers.find((m) => m.id === markerId);
  if (!marker) return notFound('Marker not found');

  // Same rule as upsertFeature.js: a read-only layer restricts marker
  // writes (including delete) to the layer's creator, authorized against
  // the verified token's memberId.
  if (layer.readOnly && memberId !== layer.createdByMemberId) {
    return forbidden('Only the layer creator can delete markers on this read-only layer');
  }

  const now = new Date().toISOString();
  marker.deleted = true;
  marker.updatedBy = actorId || marker.updatedBy;
  marker.updatedAt = now;

  layer.lastUsedAt = now;
  await putLayerObject(apiUrl, layerId, layer);

  const markerCount = layer.markers.filter((m) => !m.deleted).length;
  await updateIndex(apiUrl, (index) => {
    const entry = index.layers.find((l) => l.id === layerId);
    if (entry) {
      entry.lastUsedAt = now;
      entry.markerCount = markerCount;
    }
  });

  return json(204, null);
};
