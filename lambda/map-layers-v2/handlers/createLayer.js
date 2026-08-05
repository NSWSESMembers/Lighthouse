'use strict';

const crypto = require('crypto');
const { updateIndex, putLayerObject } = require('../lib/s3Store');
const { json, badRequest } = require('../lib/response');
const { normalizeMode } = require('../lib/permissions');

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

/**
 * Sanitize the optional event attachment: { id, name } -> stored as
 * eventId/eventName, or both null if no event (or an incomplete one) was
 * given. eventId/eventName are pure display/bookkeeping (like createdBy) --
 * nothing in this feature authorizes against them.
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
 * unlike sanitizeEvent, there's no valid "no HQ" case for a layer).
 */
function sanitizeHq(input) {
  const id = String(input?.id || '').trim().slice(0, 50);
  if (!id) return { hqId: null, hqName: null };
  const name = String(input?.name || id).trim().slice(0, 200);
  return { hqId: id, hqName: name };
}

// POST /map-layers
// body: { apiUrl, name, createdBy, hq, markerMode?, deleteMode?, commentMode?, moderators?, event? }
//
// The permission modes and moderator list are fixed at creation time --
// there's no "edit layer settings" flow for the modes themselves, so every
// handler that reads them back off the stored layer/summary can treat them
// as immutable for that layer's lifetime. The moderator list itself *is*
// editable later by the creator (see updateLayerModerators.js) since who
// should moderate a layer can change over an incident's lifetime even when
// the permission structure doesn't.
//
// Each of markerMode/deleteMode/commentMode is one of 'anyone' | 'creator'
// | 'moderators' (default 'anyone' if omitted/invalid):
//   - markerMode: who may create/edit/delete markers. Enforced in
//     upsertFeature.js / deleteFeature.js.
//   - deleteMode: who may delete the layer itself. Enforced in
//     deleteLayer.js.
//   - commentMode: who may comment on markers. Enforced in
//     addMarkerComment.js.
// 'moderators' always additionally allows the creator (see
// lib/permissions.js isAuthorized).
//
// `hq` (required): { id, name } of the Beacon HQ (entity) this layer
// belongs to -- every layer must have one, stored as hqId/hqName. Also
// fixed at creation, no later "reassign HQ" flow. Drives the layer list's
// default HQ filter (Config.js) -- layers created before this field existed
// simply have no hqId and so only ever show up under "All HQs".
//
// `event` (optional): { id, name } of a Beacon event this layer relates to,
// stored as eventId/eventName -- purely for display in the layer list
// (Config.js), same "fixed at creation" rule as the permission modes above,
// no later "attach/detach event" flow.
//
// "The creator" for all of the above means `createdByMemberId` --
// `claims.sub`, the Beacon member id off the caller's own verified token --
// not the client-supplied `createdBy` (actorId/personId), which is only
// bookkeeping/display metadata a caller could set to anything. Moderator
// ids are the same Beacon member id space (see lib/permissions.js). See
// index.js, which passes the verified claims into every handler.
module.exports = async function createLayer(event, claims) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return badRequest('Invalid JSON body');
  }

  const apiUrl = body.apiUrl;
  const name = String(body.name || '').trim().slice(0, 200);
  const createdBy = String(body.createdBy || '').slice(0, 100);
  const createdByMemberId = String(claims?.sub || '');
  const markerMode = normalizeMode(body.markerMode) || 'anyone';
  const deleteMode = normalizeMode(body.deleteMode) || 'anyone';
  const commentMode = normalizeMode(body.commentMode) || 'anyone';
  const moderators = sanitizeModerators(body.moderators);
  const { eventId, eventName, eventIdentifier } = sanitizeEvent(body.event);
  const { hqId, hqName } = sanitizeHq(body.hq);

  if (!apiUrl || !name) return badRequest('apiUrl and name are required');
  if (!hqId) return badRequest('hq is required');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const summary = {
    id, name, createdBy, createdByMemberId, createdAt: now, lastUsedAt: now, markerCount: 0,
    markerMode, deleteMode, commentMode, moderators, eventId, eventName, eventIdentifier, hqId, hqName,
  };
  const layer = {
    id, apiUrl, name, createdBy, createdByMemberId, createdAt: now, lastUsedAt: now, markers: [],
    markerMode, deleteMode, commentMode, moderators, eventId, eventName, eventIdentifier, hqId, hqName,
  };

  await putLayerObject(apiUrl, id, layer);
  await updateIndex(apiUrl, (index) => {
    index.apiUrl = apiUrl;
    index.layers.push(summary);
  });

  return json(201, summary);
};
