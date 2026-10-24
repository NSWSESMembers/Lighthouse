// Load a row of basemap tiles beyond each edge of the map before it is
// panned into view, so ordinary drags don't show grey squares while tiles
// load. (Same idea as the Leaflet.EdgeBuffer plugin, but per layer: that
// plugin patches every GridLayer, overlays included.) keepBuffer
// (basemapKeepBuffer.js) is the other half: it keeps tiles already loaded.
//
// Prefetching costs extra tile requests, so it is skipped on slow or
// data-saving connections. Chrome's navigator.connection is read on every
// tile update, so moving from a LAN to a phone hotspot takes effect
// without a reload.

const SLOW_CONNECTIONS = new Set(['slow-2g', '2g', '3g']);

/**
 * @param {{saveData?: boolean, effectiveType?: string}|undefined} connection - navigator.connection
 * @returns {number} tile rows to load past each edge
 */
export function basemapEdgeBufferRows(connection) {
  if (!connection) return 1; // not reported
  if (connection.saveData) return 0;
  if (SLOW_CONNECTIONS.has(connection.effectiveType)) return 0;
  return 1;
}

/**
 * @param {L.GridLayer} layer - raster basemap layer; patched in place
 * @param {() => number} [getRows] - tile rows to load past each edge
 * @returns {L.GridLayer} the same layer
 */
export function withEdgeBuffer(layer, getRows = () => basemapEdgeBufferRows(globalThis.navigator?.connection)) {
  const getTiledPixelBounds = layer._getTiledPixelBounds;
  layer._getTiledPixelBounds = function (center) {
    const bounds = getTiledPixelBounds.call(this, center);
    const rows = getRows();
    if (!(rows > 0)) return bounds;
    const pad = this.getTileSize().multiplyBy(rows);
    return bounds.extend(bounds.min.subtract(pad)).extend(bounds.max.add(pad));
  };
  return layer;
}
