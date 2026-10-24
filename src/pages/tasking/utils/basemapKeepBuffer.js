// How many rows of basemap tiles Leaflet keeps loaded beyond each edge of the
// map (`keepBuffer`, Leaflet default 2). Panning back over ground just seen
// otherwise rebuilds those tiles and flashes grey squares while they decode
// and fade in. Kept tiles stay decoded in memory, so scale with the device:
// Chrome's navigator.deviceMemory is approximate RAM in GB, capped at 8.

/**
 * @param {number|undefined} deviceMemory - navigator.deviceMemory (GB)
 * @returns {number} keepBuffer for basemap tile layers
 */
export function basemapKeepBuffer(deviceMemory) {
  if (!(deviceMemory > 0)) return 4; // not reported
  if (deviceMemory >= 8) return 6;
  if (deviceMemory >= 4) return 4;
  return 2;
}
