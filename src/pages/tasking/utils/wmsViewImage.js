// Size and bbox of a single WMS GetMap image covering the map view.
//
// Used for BOM layers that are re-rendered server side every few minutes but
// have no WMS time dimension (radar, thunderstorm tracking, satellite,
// lightning). Tiles fetched at different moments then come from different
// frames and tear at their joins; one image per view always shows one frame.

/** Web Mercator half-extent in metres (EPSG:3857 y is clamped to this). */
export const MERCATOR_MAX = 20037508.342789244;

/**
 * @param {{min: {x: number, y: number}, max: {x: number, y: number}}} view
 *   the visible area in projected metres
 * @param {{x: number, y: number}} size  the map size in CSS pixels
 * @param {{pad?: number, maxPx?: number}} [opts]
 *   pad: extra fraction of the view on each side, so small pans don't show
 *   a blank edge before the next image loads; maxPx: largest image side
 * @returns {{bbox: number[], width: number, height: number}}
 *   bbox as minx,miny,maxx,maxy (EPSG:3857 axis order)
 */
export function viewImageRequest(view, size, { pad = 0.25, maxPx = 4096 } = {}) {
    const w = view.max.x - view.min.x;
    const h = view.max.y - view.min.y;
    const minx = view.min.x - w * pad;
    const maxx = view.max.x + w * pad;
    const miny = Math.max(-MERCATOR_MAX, view.min.y - h * pad);
    const maxy = Math.min(MERCATOR_MAX, view.max.y + h * pad);

    // Keep the view's metres-per-pixel, so the image matches the map scale
    // even where the y clamp trimmed the padding.
    const mPerPx = w / size.x;
    let width = (maxx - minx) / mPerPx;
    let height = (maxy - miny) / mPerPx;
    const scale = Math.min(1, maxPx / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    return { bbox: [minx, miny, maxx, maxy], width, height };
}
