// Map layer stack: the draw order and opacity of each map layer, as set in
// the Configuration modal's Map layers tab.
//
// Each row is either one of LAD's own marker panes (incidents, assets) or a
// single overlay registered with Map.js registerPollingLayer. Every overlay
// is drawn into its own pane container (see installStackPaneRemap), so it
// can be moved and faded on its own.

/**
 * LAD's own panes, in their default order (top -> bottom), with the Leaflet
 * panes each row moves (bottom -> top within the row). Route lines, the
 * measuring tool and the HQ coverage outline use Leaflet's default panes.
 */
export const STACK_PANES = [
    { id: 'pane-tippy-top', name: 'Incident markers', panes: ['pane-tippy-top', 'pane-tippy-top-plus'] },
    { id: 'pane-top', name: 'Asset markers', panes: ['pane-top', 'pane-top-plus'] },
    { id: 'lh-drawn', name: 'Routes, measuring & HQ coverage', panes: ['overlayPane', 'shadowPane', 'markerPane'] },
];

/** Stack row id for an overlay key. */
export const overlayStackId = (key) => `ov:${key}`;

export const MIN_OPACITY_PCT = 10;

/** Clamp a stored or typed opacity to a whole percent (10-100). */
export function clampOpacityPct(v) {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return 100;
    return Math.max(MIN_OPACITY_PCT, Math.min(100, n));
}

/** Default stack ids before any overlay has registered. */
export const defaultStackIds = () => STACK_PANES.map(p => p.id);

/**
 * Insert a newly seen overlay id at its default slot.
 *  - 'collab': just above asset markers (where collaborative layer markers
 *    sat before overlays were ordered one by one)
 *  - 'tiles' (radar, satellite, forecast imagery): at the bottom
 *  - anything else (vector overlays): above the first tile overlay, else at
 *    the bottom
 *
 * @param {string[]} ids        current order, top -> bottom
 * @param {string} id           the id to insert (not already in ids)
 * @param {string} [stack]      'collab' | 'tiles' | 'vector'
 * @param {(id: string) => string|undefined} kindOf  stack kind of a known id
 * @returns {string[]}
 */
export function insertStackId(ids, id, stack, kindOf) {
    const out = ids.slice();
    let at = out.length;
    if (stack === 'collab') {
        const assets = out.indexOf('pane-top');
        if (assets >= 0) at = assets;
    } else if (stack !== 'tiles') {
        const firstTiles = out.findIndex(x => kindOf(x) === 'tiles');
        if (firstTiles >= 0) at = firstTiles;
    }
    out.splice(at, 0, id);
    return out;
}

/**
 * Put a reordered subset back into the full order: each slot held by a
 * known id takes the next id from `knownOrder`, and ids not shown in the
 * list (an overlay saved earlier that hasn't registered, e.g. an
 * unsubscribed collaborative layer) keep their slot.
 */
export function mergeKnownOrder(ids, knownOrder) {
    const known = new Set(knownOrder);
    let k = 0;
    const out = ids.map(id => (known.has(id) ? knownOrder[k++] : id));
    // Known ids that weren't in `ids` yet go on the end.
    while (k < knownOrder.length) out.push(knownOrder[k++]);
    return out;
}

/** Saved order, dropping unknown pane ids and duplicates, with every built-in pane present. */
export function normaliseStackIds(saved) {
    const paneIds = new Set(STACK_PANES.map(p => p.id));
    const seen = new Set();
    const out = [];
    for (const id of Array.isArray(saved) ? saved : []) {
        if (typeof id !== 'string' || seen.has(id)) continue;
        if (!id.startsWith('ov:') && !paneIds.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    // A built-in pane missing from the saved order goes in at its default
    // position relative to the panes that are there.
    STACK_PANES.forEach((p, i) => {
        if (seen.has(p.id)) return;
        const next = STACK_PANES.slice(i + 1).find(d => seen.has(d.id));
        out.splice(next ? out.indexOf(next.id) : out.length, 0, p.id);
        seen.add(p.id);
    });
    return out;
}

/**
 * z-index for each of `n` rows (top -> bottom), spread over 300-700 like
 * the old fixed panes. A row's panes take z, z+1, z+2 (see STACK_PANES),
 * and asset trails use z-1 under asset markers, so rows are at least 4
 * apart.
 */
export function stackZIndexes(n) {
    if (n <= 0) return [];
    if (n === 1) return [700];
    const step = Math.max(4, Math.floor(400 / (n - 1)));
    return Array.from({ length: n }, (_, i) => 700 - step * i);
}

// Panes an overlay's layers draw into, and their stacking inside the
// overlay's own container. Popup and tooltip panes are left alone so
// popups still open above everything.
const SUB_PANE_Z = {
    tilePane: 200,
    'pane-lowest': 300,
    'pane-lowest-plus': 301,
    overlayPane: 400,
    'pane-middle': 402,
    'pane-middle-plus': 403,
    shadowPane: 500,
    markerPane: 600,
    'pane-top': 600,
    'pane-top-plus': 601,
    'pane-collab': 650,
    'pane-collab-plus': 651,
};

const paneSafe = (key) => String(key).replace(/[^A-Za-z0-9_-]/g, '_');

/** Name of an overlay's container pane. */
export const overlayPaneName = (key) => `ov-${paneSafe(key)}`;

/**
 * Route every layer added to a registered overlay's layer group into that
 * overlay's own pane container. Drawing code keeps naming the shared panes
 * (pane-lowest, pane-middle, tilePane...); this rewrites `options.pane` to
 * a sub-pane of the overlay's container before the layer reaches the map,
 * keeping their relative order inside it.
 *
 * Patches L.LayerGroup.prototype.addLayer once; groups without a stack key
 * are untouched.
 */
export function installStackPaneRemap(L, map) {
    const subPane = (key, original) => {
        if (!(original in SUB_PANE_Z)) return original;
        const container = overlayPaneName(key);
        const name = `${container}--${original}`;
        if (!map.getPane(name)) {
            const parent = map.getPane(container) || map.createPane(container);
            map.createPane(name, parent).style.zIndex = String(SUB_PANE_Z[original]);
        }
        return name;
    };

    const ownOptions = (layer) => {
        if (!Object.prototype.hasOwnProperty.call(layer, 'options')) {
            layer.options = Object.create(layer.options || {});
        }
        return layer.options;
    };

    const mark = (layer, key) => {
        if (!layer || layer._lhStackKey !== undefined) return layer;
        layer._lhStackKey = key;
        const opts = ownOptions(layer);
        if (opts.pane) opts.pane = subPane(key, opts.pane);
        if (opts.shadowPane) opts.shadowPane = subPane(key, opts.shadowPane);
        // esri-leaflet feature layers build polygons from their own options
        // (pane already remapped above) but add pointToLayer markers to the
        // map directly, later.
        if (typeof opts.pointToLayer === 'function' && typeof layer._requestFeatures === 'function') {
            const ptl = opts.pointToLayer;
            opts.pointToLayer = (geojson, latlng) => mark(ptl(geojson, latlng), key);
        }
        if (typeof layer.eachLayer === 'function') layer.eachLayer(child => mark(child, key));
        return layer;
    };

    if (!L.LayerGroup.prototype._lhStackPatched) {
        const addLayer = L.LayerGroup.prototype.addLayer;
        L.LayerGroup.prototype.addLayer = function (layer) {
            if (this._lhStackKey !== undefined) mark(layer, this._lhStackKey);
            return addLayer.call(this, layer);
        };
        L.LayerGroup.prototype._lhStackPatched = true;
    }

    /** Make `group` an overlay's root group: its layers go to the overlay's panes. */
    return function attachOverlayGroup(group, key) {
        group._lhStackKey = key;
        if (!map.getPane(overlayPaneName(key))) map.createPane(overlayPaneName(key));
    };
}
