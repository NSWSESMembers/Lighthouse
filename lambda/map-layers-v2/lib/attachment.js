'use strict';

// Shared by createLayer.js (fixed at creation) and updateLayerAttachment.js
// (changed later, see that handler's doc comment for why a layer's HQ/event
// turned out not to be fixed for its whole lifetime after all).

/**
 * Sanitize the optional event attachment: { id, name, identifier } ->
 * { eventId, eventName, eventIdentifier }, all null if no event (or an
 * incomplete one) was given. eventId/eventName/eventIdentifier are pure
 * display/bookkeeping (like createdBy) -- nothing in this feature
 * authorizes against them.
 */
function sanitizeEvent(input) {
  const id = String(input?.id || '').trim().slice(0, 50);
  if (!id) return { eventId: null, eventName: null, eventIdentifier: null };
  const name = String(input?.name || id).trim().slice(0, 200);
  const identifier = String(input?.identifier || '').trim().slice(0, 50) || null;
  return { eventId: id, eventName: name, eventIdentifier: identifier };
}

/**
 * Sanitize the required HQ attachment: { id, name } -> { hqId, hqName }, or
 * both null if missing/incomplete (caller must then reject the request --
 * there's no valid "no HQ" case for a layer).
 */
function sanitizeHq(input) {
  const id = String(input?.id || '').trim().slice(0, 50);
  if (!id) return { hqId: null, hqName: null };
  const name = String(input?.name || id).trim().slice(0, 200);
  return { hqId: id, hqName: name };
}

module.exports = { sanitizeEvent, sanitizeHq };
