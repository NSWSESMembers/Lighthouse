'use strict';

const crypto = require('crypto');
const { updateIndex, putLayerObject } = require('../lib/s3Store');
const { json, badRequest } = require('../lib/response');
const { normalizeMode } = require('../lib/permissions');
const { sanitizeEvent, sanitizeHq } = require('../lib/attachment');

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

// POST /map-layers
// body: { apiUrl, name, createdBy, hq, markerMode?, deleteMode?, commentMode?, moderators?, event? }
//
// The permission modes default to 'anyone' here at creation time, but --
// like the moderator list -- can be changed later by the creator or a
// current moderator (see updateLayerPermissions.js / updateLayerModerators.js)
// since both who should moderate a layer and how open it should be can
// change over an incident's lifetime.
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
// belongs to -- every layer must have one, stored as hqId/hqName. Like the
// permission modes above, can be changed later by the creator or a current
// moderator (see updateLayerAttachment.js). Drives the layer list's default
// HQ filter (Config.js) -- layers created before this field existed simply
// have no hqId and so only ever show up under "All HQs".
//
// `event` (optional): { id, name, identifier } of a Beacon event this layer
// relates to, stored as eventId/eventName/eventIdentifier -- purely for
// display in the layer list (Config.js), also changeable later via
// updateLayerAttachment.js.
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
