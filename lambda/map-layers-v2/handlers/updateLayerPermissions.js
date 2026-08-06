'use strict';

const { getLayerObject, putLayerObject, updateIndex } = require('../lib/s3Store');
const { json, badRequest, notFound, forbidden } = require('../lib/response');
const { normalizeMode, markerMode, deleteMode, commentMode, isAuthorized } = require('../lib/permissions');

// PUT /map-layers/{id}/permissions   body: { apiUrl, markerMode?, deleteMode?, commentMode? }
//
// Like the moderator list (updateLayerModerators.js), the three permission
// modes turn out not to be fixed for a layer's whole lifetime after all --
// this is what lets the creator or a moderator loosen/tighten them later
// (e.g. opening up marker creation once an incident calms down). Same
// authorization rule as updateLayerModerators: creator or any *current*
// moderator (isAuthorized('moderators', ...)), so a stranger can't reduce
// their own restrictions. Any mode omitted from the body, or not one of the
// valid 'anyone' | 'creator' | 'moderators' values, is left unchanged rather
// than silently reset to 'anyone'.
module.exports = async function updateLayerPermissions(event, claims) {
  const layerId = event.pathParameters?.id;
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return badRequest('Invalid JSON body');
  }

  const apiUrl = body.apiUrl;
  const memberId = String(claims?.sub || '');

  if (!apiUrl || !layerId) return badRequest('apiUrl and layer id are required');

  const layer = await getLayerObject(apiUrl, layerId);
  if (!layer) return notFound('Layer not found');

  if (!isAuthorized('moderators', layer, memberId)) {
    return forbidden('Only the layer creator or a moderator can manage permissions');
  }

  const newMarkerMode = normalizeMode(body.markerMode) || markerMode(layer);
  const newDeleteMode = normalizeMode(body.deleteMode) || deleteMode(layer);
  const newCommentMode = normalizeMode(body.commentMode) || commentMode(layer);

  const now = new Date().toISOString();
  layer.markerMode = newMarkerMode;
  layer.deleteMode = newDeleteMode;
  layer.commentMode = newCommentMode;
  layer.lastUsedAt = now;
  await putLayerObject(apiUrl, layerId, layer);

  await updateIndex(apiUrl, (index) => {
    const entry = index.layers.find((l) => l.id === layerId);
    if (entry) {
      entry.markerMode = newMarkerMode;
      entry.deleteMode = newDeleteMode;
      entry.commentMode = newCommentMode;
      entry.lastUsedAt = now;
    }
  });

  return json(200, { markerMode: newMarkerMode, deleteMode: newDeleteMode, commentMode: newCommentMode });
};
