'use strict';

const crypto = require('crypto');
const { updateIndex, putLayerObject } = require('../lib/s3Store');
const { json, badRequest } = require('../lib/response');

// POST /map-layers   body: { apiUrl, name, createdBy, readOnly?, allowDeleteByOthers?, disableComments? }
//
// The three permission flags are fixed at creation time -- there's no
// "edit layer settings" flow, so every handler that reads them back off the
// stored layer/summary can treat them as immutable for that layer's
// lifetime.
//   - readOnly (default false): only the creator may create/edit/delete
//     markers; everyone else may still comment (unless disableComments).
//     Enforced in upsertFeature.js / deleteFeature.js.
//   - allowDeleteByOthers (default true): whether anyone, vs. only the
//     creator, may delete the layer itself. Enforced in deleteLayer.js.
//   - disableComments (default false): blocks comments for everyone,
//     including the creator. Enforced in addMarkerComment.js.
//
// "The creator" for all of the above means `createdByMemberId` --
// `claims.sub`, the Beacon member id off the caller's own verified token --
// not the client-supplied `createdBy` (actorId/personId), which is only
// bookkeeping/display metadata a caller could set to anything. See
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
  const readOnly = body.readOnly === true;
  const allowDeleteByOthers = body.allowDeleteByOthers !== false;
  const disableComments = body.disableComments === true;

  if (!apiUrl || !name) return badRequest('apiUrl and name are required');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const summary = {
    id, name, createdBy, createdByMemberId, createdAt: now, lastUsedAt: now, markerCount: 0,
    readOnly, allowDeleteByOthers, disableComments,
  };
  const layer = {
    id, apiUrl, name, createdBy, createdByMemberId, createdAt: now, lastUsedAt: now, markers: [],
    readOnly, allowDeleteByOthers, disableComments,
  };

  await putLayerObject(apiUrl, id, layer);
  await updateIndex(apiUrl, (index) => {
    index.apiUrl = apiUrl;
    index.layers.push(summary);
  });

  return json(201, summary);
};
