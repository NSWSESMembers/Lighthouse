'use strict';

const crypto = require('crypto');
const { getLayerObject, putLayerObject, updateIndex } = require('../lib/s3Store');
const { json, badRequest, notFound } = require('../lib/response');

// Must stay in sync with the icon keys in
// src/pages/tasking/components/collab_marker_icons.js (MARKER_ICON_GROUPS).
const ICON_KEYS = new Set([
  'fire', 'fire-extinguisher', 'water', 'house-damage', 'exclamation-triangle',
  'skull-crossbones', 'biohazard', 'radiation', 'bolt', 'wind', 'smog',
  'car-crash', 'tree', 'gas-pump', 'ban',
  'ambulance', 'first-aid', 'hospital', 'user-md', 'user-injured', 'syringe',
  'user', 'users', 'wheelchair', 'baby-carriage', 'paw',
  'campground', 'home', 'warehouse', 'tint', 'shower',
  'road', 'route', 'broadcast-tower', 'plug',
  'truck', 'helicopter', 'ship', 'life-ring',
  'map-marker-alt', 'flag', 'check-circle', 'question-circle',
]);
const DEFAULT_ICON = 'map-marker-alt';
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

// PUT /map-layers/{id}/features   body: { apiUrl, marker: {id?, lat, lng, icon, fill, description}, actorId }
// Missing/unknown marker.id creates a new marker; a known id overwrites it
// (last-write-wins, same convention as the existing default-assets Lambda).
module.exports = async function upsertFeature(event) {
  const layerId = event.pathParameters?.id;
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return badRequest('Invalid JSON body');
  }

  const apiUrl = body.apiUrl;
  const actorId = String(body.actorId || '').slice(0, 100);
  const input = body.marker || {};

  if (!apiUrl || !layerId) return badRequest('apiUrl and layer id are required');
  if (typeof input.lat !== 'number' || typeof input.lng !== 'number') {
    return badRequest('marker.lat and marker.lng must be numbers');
  }

  const layer = await getLayerObject(apiUrl, layerId);
  if (!layer) return notFound('Layer not found');

  const now = new Date().toISOString();
  const icon = ICON_KEYS.has(input.icon) ? input.icon : DEFAULT_ICON;
  const fill = HEX_COLOR.test(input.fill || '') ? input.fill : '#2b7bbb';
  const description = String(input.description || '').slice(0, 2000);

  const existingIdx = input.id ? layer.markers.findIndex((m) => m.id === input.id) : -1;
  let marker;

  if (existingIdx >= 0) {
    marker = {
      ...layer.markers[existingIdx],
      lat: input.lat,
      lng: input.lng,
      icon,
      fill,
      description,
      updatedBy: actorId,
      updatedAt: now,
      deleted: false,
    };
    layer.markers[existingIdx] = marker;
  } else {
    marker = {
      id: crypto.randomUUID(),
      lat: input.lat,
      lng: input.lng,
      icon,
      fill,
      description,
      createdBy: actorId,
      createdAt: now,
      updatedBy: actorId,
      updatedAt: now,
      deleted: false,
    };
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
