import L from 'leaflet';

// Floor for the padding on each edge -- matches the old hardcoded
// `autoPanPadding: [16, 16]` that every popup used to set individually.
const MIN_PADDING = 16;
// Small breathing room beyond the edge of whatever control is docked there,
// so a re-panned popup doesn't sit flush against it.
const EXTRA_MARGIN = 8;
// Cap how much of the map's own width/height a single corner control is
// allowed to claim as padding, on each axis -- a first-pass sanity bound
// against one oversized control.
const MAX_PADDING_SHARE = 0.35;

// Leaflet's autoPan can only pan a popup fully into view when the two
// opposite paddings plus the popup itself fit across the map -- i.e.
// `paddingTopLeft + paddingBottomRight + popupSize <= mapSize` on that
// axis. When the corner chrome (alerts banner, legend, the wide Esri
// attribution line, ...) is big enough that they don't, Leaflet's
// pan-to-fit math can't satisfy both edges and silently stops panning on
// that axis: the popup opens clipped instead of pushed into view. On a
// tall map the vertical padding almost always fits, so this shows up as
// "vertical auto-pan works, horizontal doesn't" on a narrow map.
//
// To keep both axes satisfiable we reserve room for a popup of at least
// this size and shrink the corner-derived padding (proportionally, never
// below MIN_PADDING) to fit around it. A popup wider/taller than this
// still degrades gracefully -- Leaflet pins it against the top-left
// padding, clipping the far edge -- instead of not panning at all.
const MIN_POPUP_WIDTH = 430;
const MIN_POPUP_HEIGHT = 320;

// Scale a pair of opposite paddings down so their sum leaves `reserve`
// px free across `extent`, holding each at MIN_PADDING or above.
function fitPadding(tl, br, extent, reserve) {
    const budget = extent - reserve - 2 * MIN_PADDING;
    const excess = (tl - MIN_PADDING) + (br - MIN_PADDING);
    if (excess <= 0) return [tl, br];           // already at the floor
    if (budget <= 0) return [MIN_PADDING, MIN_PADDING];
    if (excess <= budget) return [tl, br];      // fits as-is
    const k = budget / excess;
    return [MIN_PADDING + (tl - MIN_PADDING) * k, MIN_PADDING + (br - MIN_PADDING) * k];
}

/**
 * Shared, mutable autoPan padding, kept in sync with whatever's docked in
 * the map's corners (see initPopupAutoPan below). Exported so other code
 * that needs to reason about how much of the map is actually free -- e.g.
 * jobMarker's popup-widen decision -- reads the same numbers autoPan
 * itself uses, instead of a separate, disagreeing guess.
 */
export const popupPadding = {
    topLeft: L.point(MIN_PADDING, MIN_PADDING),
    bottomRight: L.point(MIN_PADDING, MIN_PADDING),
};

/**
 * Keeps popup auto-pan padding in sync with whatever Leaflet corner
 * controls are actually on screen -- the alerts banner stack (topright),
 * zoom/measure/search tools (topleft), the legend (bottomleft),
 * attribution (bottomright), etc.
 *
 * Without this, `autoPan` only keeps a popup inside the map's pixel
 * bounds; it has no idea those controls are floating on top of the map,
 * so a popup can be "in bounds" and still open underneath them.
 *
 * This works by installing `popupPadding`'s two points as the *default*
 * autoPan padding for every L.Popup (via Popup.mergeOptions) and keeping
 * them updated from the real, live-measured size of each corner. Leaflet
 * re-reads these point objects (by reference) every time it pans a popup
 * into view, so individual bindPopup()/L.popup() call sites don't need to
 * know about any of this -- they just need to not set their own
 * autoPanPaddingTopLeft/BottomRight (or autoPanPadding, which takes
 * precedence if present).
 *
 * Call once, right after the map is created.
 */
export function initPopupAutoPan(map) {
    const { topLeft, bottomRight } = popupPadding;

    L.Popup.mergeOptions({
        autoPan: true,
        autoPanPaddingTopLeft: topLeft,
        autoPanPaddingBottomRight: bottomRight,
    });

    const container = map.getContainer();

    function recompute() {
        const mapRect = container.getBoundingClientRect();
        let left = MIN_PADDING, top = MIN_PADDING, right = MIN_PADDING, bottom = MIN_PADDING;

        container.querySelectorAll('.leaflet-top, .leaflet-bottom').forEach((corner) => {
            const rect = corner.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return; // nothing docked in this corner

            if (corner.classList.contains('leaflet-top')) {
                top = Math.max(top, rect.bottom - mapRect.top + EXTRA_MARGIN);
            } else {
                bottom = Math.max(bottom, mapRect.bottom - rect.top + EXTRA_MARGIN);
            }
            if (corner.classList.contains('leaflet-left')) {
                left = Math.max(left, rect.right - mapRect.left + EXTRA_MARGIN);
            } else {
                right = Math.max(right, mapRect.right - rect.left + EXTRA_MARGIN);
            }
        });

        const maxVertical = mapRect.height * MAX_PADDING_SHARE;
        const maxHorizontal = mapRect.width * MAX_PADDING_SHARE;

        left = Math.min(left, maxHorizontal);
        right = Math.min(right, maxHorizontal);
        top = Math.min(top, maxVertical);
        bottom = Math.min(bottom, maxVertical);

        // Keep opposite paddings + a popup fitting across each axis, so
        // Leaflet's autoPan never stalls on that axis (see MIN_POPUP_* above).
        [left, right] = fitPadding(left, right, mapRect.width, MIN_POPUP_WIDTH);
        [top, bottom] = fitPadding(top, bottom, mapRect.height, MIN_POPUP_HEIGHT);

        topLeft.x = left;
        topLeft.y = top;
        bottomRight.x = right;
        bottomRight.y = bottom;
    }

    recompute();

    // Corner containers resize whenever a control is added/removed, the
    // alerts banner stack grows/shrinks, or a control collapses/expands --
    // a ResizeObserver on the four corner divs catches all of that without
    // polling.
    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(recompute);
        container.querySelectorAll('.leaflet-top, .leaflet-bottom').forEach((corner) => ro.observe(corner));
    }
    window.addEventListener('resize', recompute);

    return { topLeft, bottomRight, recompute };
}
