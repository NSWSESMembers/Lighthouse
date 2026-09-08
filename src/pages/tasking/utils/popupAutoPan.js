import L from 'leaflet';

// Floor for the padding on each edge -- matches the old hardcoded
// `autoPanPadding: [16, 16]` that every popup used to set individually.
const MIN_PADDING = 16;
// Small breathing room beyond the edge of whatever control is docked there,
// so a re-panned popup doesn't sit flush against it.
const EXTRA_MARGIN = 8;
// Cap how much of the map's own width/height the corner controls are
// allowed to claim as padding, on each axis. Leaflet's autoPan can't
// satisfy both the top and bottom (or left and right) padding at once if
// together they leave no room for the popup -- it just snaps between
// them, cutting the popup off. Keeping a comfortable share of the
// viewport free of padding, no matter how much chrome piles into the
// corners, keeps that always satisfiable.
const MAX_PADDING_SHARE = 0.35;

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

        topLeft.x = Math.min(left, maxHorizontal);
        topLeft.y = Math.min(top, maxVertical);
        bottomRight.x = Math.min(right, maxHorizontal);
        bottomRight.y = Math.min(bottom, maxVertical);
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
