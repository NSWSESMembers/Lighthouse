'use strict';

const { getLayerObject, putLayerObject, updateIndex } = require('../lib/s3Store');
const { json, badRequest, notFound, forbidden } = require('../lib/response');
const { isAuthorized } = require('../lib/permissions');
const { sanitizeEvent, sanitizeHq } = require('../lib/attachment');

// PUT /map-layers/{id}/attachment   body: { apiUrl, hq: {id, name}, event: {id, name, identifier}|null }
//
// The HQ and event a layer's attached to turn out not to be fixed for its
// whole lifetime after all (same story as the moderator list and the three
// permission modes, see updateLayerModerators.js/updateLayerPermissions.js)
// -- a layer created against the wrong HQ, or one that should follow an
// incident from one Beacon event to the next, needs a way to be
// reassigned. Same authorization rule as those two: creator or any
// *current* moderator (isAuthorized('moderators', ...)).
//
// `hq` is required, exactly as at creation (createLayer.js) -- a layer can
// never end up with no HQ. `event`, if omitted or null, clears any existing
// event attachment; a given event replaces it outright (no partial-update
// shape, same as createLayer.js).
module.exports = async function updateLayerAttachment(event, claims) {
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
    return forbidden('Only the layer creator or a moderator can change the HQ or event');
  }

  const { hqId, hqName } = sanitizeHq(body.hq);
  if (!hqId) return badRequest('hq is required');
  const { eventId, eventName, eventIdentifier } = sanitizeEvent(body.event);

  const now = new Date().toISOString();
  layer.hqId = hqId;
  layer.hqName = hqName;
  layer.eventId = eventId;
  layer.eventName = eventName;
  layer.eventIdentifier = eventIdentifier;
  layer.lastUsedAt = now;
  await putLayerObject(apiUrl, layerId, layer);

  await updateIndex(apiUrl, (index) => {
    const entry = index.layers.find((l) => l.id === layerId);
    if (entry) {
      entry.hqId = hqId;
      entry.hqName = hqName;
      entry.eventId = eventId;
      entry.eventName = eventName;
      entry.eventIdentifier = eventIdentifier;
      entry.lastUsedAt = now;
    }
  });

  return json(200, { hqId, hqName, eventId, eventName, eventIdentifier });
};
