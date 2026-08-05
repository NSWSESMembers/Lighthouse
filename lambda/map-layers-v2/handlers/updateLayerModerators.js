'use strict';

const { getLayerObject, putLayerObject, updateIndex } = require('../lib/s3Store');
const { json, badRequest, notFound, forbidden } = require('../lib/response');
const { isAuthorized } = require('../lib/permissions');

const MAX_MODERATORS = 100;

/** Sanitize the client-supplied moderator list: [{id, name}], deduped by id. */
function sanitizeModerators(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const m of input) {
    const id = String(m?.id || '').trim().slice(0, 100);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: String(m?.name || id).trim().slice(0, 200) });
    if (out.length >= MAX_MODERATORS) break;
  }
  return out;
}

// PUT /map-layers/{id}/moderators   body: { apiUrl, moderators: [{id, name}] }
//
// Unlike markerMode/deleteMode/commentMode (fixed at creation, see
// createLayer.js), the moderator list itself can be updated later -- who
// should moderate a layer changes over an incident's lifetime even when the
// permission structure doesn't. The creator or any *current* moderator may
// change it (isAuthorized('moderators', ...) -- same rule as the
// marker/delete/comment 'moderators' mode: creator plus anyone already on
// the list), so a stranger still can't silently add themselves. Replaces
// the full list rather than diffing (simpler, and the client always sends
// its complete current list -- see collabLayerSync.js's
// updateLayerModerators). A moderator removing themselves (or every other
// moderator) is allowed -- same trust level as the creator over this list.
module.exports = async function updateLayerModerators(event, claims) {
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
    return forbidden('Only the layer creator or a moderator can manage moderators');
  }

  const moderators = sanitizeModerators(body.moderators);
  const now = new Date().toISOString();
  layer.moderators = moderators;
  layer.lastUsedAt = now;
  await putLayerObject(apiUrl, layerId, layer);

  await updateIndex(apiUrl, (index) => {
    const entry = index.layers.find((l) => l.id === layerId);
    if (entry) {
      entry.moderators = moderators;
      entry.lastUsedAt = now;
    }
  });

  return json(200, { moderators });
};
