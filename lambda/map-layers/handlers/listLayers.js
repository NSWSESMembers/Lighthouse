'use strict';

const { getJson, indexKey } = require('../lib/s3Store');
const { json, badRequest } = require('../lib/response');

const STALE_MS = 120 * 24 * 60 * 60 * 1000; // 120 days

// GET /map-layers?apiUrl=...
// Lists layers for an org, excluding any unused for 120+ days. The
// underlying data is never deleted by this filter -- only omitted from
// the listing.
module.exports = async function listLayers(event) {
  const apiUrl = event.queryStringParameters?.apiUrl;
  if (!apiUrl) return badRequest('apiUrl is required');

  const { data } = await getJson(indexKey(apiUrl));
  const layers = (data?.layers || []).filter((l) => {
    const lastUsed = new Date(l.lastUsedAt).getTime();
    return Number.isFinite(lastUsed) && Date.now() - lastUsed <= STALE_MS;
  });

  return json(200, { layers });
};
