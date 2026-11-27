/**
 * A council's flood cameras as a dataset (tweed.mjs, clarence.mjs,
 * bellingen.mjs, coffsharbour.mjs):
 *
 *   {council}/flood-cameras        the cameras from the council module's own
 *                                  list, so it never calls the council's site
 *   {council}/flood-cameras/{id}   one camera's latest image: its `latest()`,
 *                                  only when someone opens that camera
 *
 * A camera is { id, name, lat, lng, gaugeUrl?, timelapseUrl?, liveUrl?,
 * approximate?, bearing?, fov?, latest(fetchers) -> { imageUrl, takenAt, offline? } },
 * `takenAt` ISO or null when the time is only stamped on the image. `imageUrl` is a link to the
 * image, or for a still cut from a video (videostill.mjs) the JPEG itself as a
 * data URL, or null with `offline` when the camera is off. `approximate` is a
 * position worked out from the road and place names, not published by the
 * council. `bearing` (degrees from north) and `fov` (how wide its view is, in
 * degrees) are which way it looks, worked out from its image: LAD draws them
 * as a cone.
 */

export function cameraDataset(council, cameras, { itemTtlSeconds = 5 * 60 } = {}) {
  const byId = new Map(cameras.map((c) => [c.id, c]));
  const point = (c, properties) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
    properties: {
      id: c.id,
      name: c.name,
      timelapseUrl: c.timelapseUrl || null,
      ...(c.liveUrl ? { liveUrl: c.liveUrl } : {}),
      ...(c.approximate ? { approximate: true } : {}),
      ...(Number.isFinite(c.bearing) ? { bearing: c.bearing, fov: c.fov || null } : {}),
      ...properties,
    },
  });
  return {
    ttlSeconds: 24 * 60 * 60,
    load: async () => cameras.map((c) => point(c, { gaugeUrl: c.gaugeUrl || null, latestPath: `${council}/flood-cameras/${c.id}` })),
    // A few minutes' cache keeps a flood's faster images current, and the
    // camera's site sees one request per camera however many people open it.
    item: {
      ttlSeconds: itemTtlSeconds,
      has: (id) => byId.has(id),
      load: async (id, fetchers) => {
        const c = byId.get(id);
        return [point(c, await c.latest(fetchers))];
      },
    },
  };
}
