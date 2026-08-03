'use strict';

const crypto = require('crypto');
const { updateIndex, putLayerObject } = require('../lib/s3Store');
const { json, badRequest } = require('../lib/response');

// POST /map-layers   body: { apiUrl, name, createdBy }
module.exports = async function createLayer(event) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return badRequest('Invalid JSON body');
  }

  const apiUrl = body.apiUrl;
  const name = String(body.name || '').trim().slice(0, 200);
  const createdBy = String(body.createdBy || '').slice(0, 100);

  if (!apiUrl || !name) return badRequest('apiUrl and name are required');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const summary = { id, name, createdBy, createdAt: now, lastUsedAt: now, markerCount: 0 };
  const layer = { id, apiUrl, name, createdBy, createdAt: now, lastUsedAt: now, markers: [] };

  await putLayerObject(apiUrl, id, layer);
  await updateIndex(apiUrl, (index) => {
    index.apiUrl = apiUrl;
    index.layers.push(summary);
  });

  return json(201, summary);
};
