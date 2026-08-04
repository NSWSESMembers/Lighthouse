'use strict';

const crypto = require('crypto');
const { getLayerObject, putLayerObject, updateIndex } = require('../lib/s3Store');
const { json, badRequest, notFound, forbidden } = require('../lib/response');

// Must stay in sync with the icon keys in
// src/pages/tasking/components/collab_marker_icons.js (MARKER_ICON_GROUPS).
const ICON_KEYS = new Set([
  'exclamation-triangle', 'fire-alt', 'cloud-showers-heavy', 'wind', 'snowflake', 'water', 'gas-pump',
  'ambulance', 'car-side', 'truck-monster', 'shuttle-van', 'helicopter', 'ship', 'plane',
  'users', 'dog',
  'utensils', 'shopping-cart',
  'eye', 'camera', 'comments',
  'flag', 'thumbtack', 'times', 'minus-circle', 'question-circle',
]);
const DEFAULT_ICON = 'thumbtack';
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

// PUT /map-layers/{id}/features   body: { apiUrl, marker: {id?, lat, lng, icon, fill, opsLogId}, actorId }
// Missing/unknown marker.id creates a new marker; a known id overwrites it
// (last-write-wins, same convention as the existing default-assets Lambda).
//
// The marker record itself only holds GPS position, style (icon/fill), and
// pointers into the Operations Log -- opsLogId for the title/description
// entry and commentOpsLogIds for the comment thread. The Ops Log is the
// source of truth for all of that text; the client resolves the pointers
// via BeaconClient.operationslog.get() when rendering a marker.
module.exports = async function upsertFeature(event, claims) {
  const layerId = event.pathParameters?.id;
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return badRequest('Invalid JSON body');
  }

  const apiUrl = body.apiUrl;
  // actorId is client-supplied bookkeeping (stamped onto the marker as
  // createdBy/updatedBy for display) -- never used for authorization, see
  // memberId below.
  const actorId = String(body.actorId || '').slice(0, 100);
  const memberId = String(claims?.sub || '');
  const input = body.marker || {};

  if (!apiUrl || !layerId) return badRequest('apiUrl and layer id are required');
  if (typeof input.lat !== 'number' || typeof input.lng !== 'number') {
    return badRequest('marker.lat and marker.lng must be numbers');
  }

  const layer = await getLayerObject(apiUrl, layerId);
  if (!layer) return notFound('Layer not found');

  // On a read-only layer, only the layer's creator may create/edit markers
  // -- everyone else is limited to commenting (see addMarkerComment.js).
  // Authorized against the verified token's memberId, not the
  // client-supplied actorId.
  if (layer.readOnly && memberId !== layer.createdByMemberId) {
    return forbidden('Only the layer creator can add or edit markers on this read-only layer');
  }

  const now = new Date().toISOString();
  const icon = ICON_KEYS.has(input.icon) ? input.icon : DEFAULT_ICON;
  const fill = HEX_COLOR.test(input.fill || '') ? input.fill : '#2b7bbb';

  // Id of the Operations Log entry logged (client-side) for this drop/edit,
  // stamped onto the marker so the title/description can be looked up
  // later via BeaconClient.operationslog.get(). A Beacon Ops Log entry
  // can't be edited by anyone but its author, so editing a marker always
  // creates a *new* entry client-side and points opsLogId at it rather
  // than mutating the old one. Omitted/invalid values leave the marker's
  // existing opsLogId (if any) untouched.
  const opsLogId = Number.isFinite(Number(input.opsLogId)) && input.opsLogId !== '' ? Number(input.opsLogId) : undefined;

  const existingIdx = input.id ? layer.markers.findIndex((m) => m.id === input.id) : -1;
  let marker;

  if (existingIdx >= 0) {
    marker = {
      ...layer.markers[existingIdx],
      lat: input.lat,
      lng: input.lng,
      icon,
      fill,
      updatedBy: actorId,
      updatedAt: now,
      deleted: false,
    };
    if (opsLogId !== undefined) marker.opsLogId = opsLogId;
    layer.markers[existingIdx] = marker;
  } else {
    marker = {
      id: crypto.randomUUID(),
      lat: input.lat,
      lng: input.lng,
      icon,
      fill,
      commentOpsLogIds: [],
      createdBy: actorId,
      createdAt: now,
      updatedBy: actorId,
      updatedAt: now,
      deleted: false,
    };
    if (opsLogId !== undefined) marker.opsLogId = opsLogId;
    layer.markers.push(marker);
  }

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

  return json(200, marker);
};
