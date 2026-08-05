'use strict';

const { getJson, indexKey } = require('../lib/s3Store');
const { json, badRequest } = require('../lib/response');

const STALE_MS = 120 * 24 * 60 * 60 * 1000; // 120 days

// GET /map-layers?apiUrl=...&hqId=...
// Lists layers for an org, excluding any unused for 120+ days. The
// underlying data is never deleted by this filter -- only omitted from
// the listing. `hqId`, if given, additionally restricts the list to layers
// attached to that HQ (see createLayer.js) -- omitted entirely for "All
// HQs" (Config.js's collabLayerHqFilterPicker cleared). Layers created
// before the HQ requirement existed have no hqId and so never match a
// specific hqId filter, only the unfiltered "All HQs" request.
module.exports = async function listLayers(event) {
  const apiUrl = event.queryStringParameters?.apiUrl;
  const hqId = event.queryStringParameters?.hqId || null;
  if (!apiUrl) return badRequest('apiUrl is required');

  const { data } = await getJson(indexKey(apiUrl));
  const layers = (data?.layers || []).filter((l) => {
    const lastUsed = new Date(l.lastUsedAt).getTime();
    if (!Number.isFinite(lastUsed) || Date.now() - lastUsed > STALE_MS) return false;
    if (hqId && l.hqId !== hqId) return false;
    return true;
  });

  return json(200, { layers });
};
