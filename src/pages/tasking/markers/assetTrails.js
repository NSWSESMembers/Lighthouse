/**
 * Asset breadcrumb trails.
 *
 * Every position fix an asset reports is remembered for a short while (the
 * "trail length" config option, in minutes), and drawn behind the asset's
 * pin as a line through its recent positions with a dot at each fix. The
 * line fades out with age, so you can see which way the vehicle came and
 * roughly how long ago.
 *
 * Only the selected asset's trail is drawn (the one whose popup is open),
 * so the map stays clear. Fixes are recorded for every asset all the time,
 * so selecting one shows where it has been.
 *
 * Trails are kept in memory and in localStorage (so a page reload doesn't
 * lose them), never sent anywhere.
 */
var L = require('leaflet');
import { assetColor } from '../components/asset_icon.js';

const STORAGE_KEY = 'tasking.assetTrails';
const PANE = 'pane-asset-trails';

// Fixes closer than this to the last one are GPS jitter, not travel.
export const MIN_MOVE_M = 15;
// Cap per asset, whatever the trail length, so a chatty tracker can't grow
// a trail (or localStorage) without limit.
export const MAX_FIXES = 120;
// Trails fade (and old fixes drop off) on this tick, not just when a new
// fix arrives, so a vehicle that has stopped still loses its trail.
const REFRESH_INTERVAL = 30 * 1000;
const SAVE_DELAY = 5000;

/** Approximate distance in metres between two { lat, lng } (fine at these scales). */
export function distanceM(a, b) {
    const R = 6371000;
    const rad = Math.PI / 180;
    const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
    const y = (b.lat - a.lat) * rad;
    return Math.hypot(x, y) * R;
}

/**
 * Append a fix ({ lat, lng, t }) to a trail unless it's within minMove of
 * the last one, or older than it. Returns whether it was added.
 */
export function addFix(trail, fix, minMove = MIN_MOVE_M) {
    const last = trail[trail.length - 1];
    if (last && (fix.t < last.t || distanceM(last, fix) < minMove)) return false;
    trail.push(fix);
    if (trail.length > MAX_FIXES) trail.splice(0, trail.length - MAX_FIXES);
    return true;
}

/**
 * Drop fixes that only begin segments older than cutoff. A fix older than
 * cutoff stays while the next one is newer: fixes are minutes apart, so
 * dropping it would cut a whole segment that's still within the trail
 * length, rather than letting it fade out. The newest fix always stays: it's
 * where the asset is now, and where the line starts when it next moves.
 * Returns whether anything was dropped.
 */
export function pruneTrail(trail, cutoff) {
    let i = 0;
    while (i < trail.length - 1 && trail[i + 1].t < cutoff) i++;
    if (i) trail.splice(0, i);
    return i > 0;
}

/**
 * When a fix was taken: the asset's lastSeen, falling back to now if it's
 * missing, unparseable or in the future (clock skew).
 */
export function fixTime(lastSeen, now = Date.now()) {
    const t = lastSeen ? new Date(lastSeen).getTime() : NaN;
    return Number.isFinite(t) && t <= now ? t : now;
}

/** Opacity for something `age` ms old on a trail `windowMs` long. */
export function trailOpacity(age, windowMs) {
    const fresh = Math.min(1, Math.max(0, 1 - age / windowMs));
    return 0.15 + 0.65 * fresh;
}

// Trails are keyed by String(id): it round-trips through localStorage.
function keyOf(asset) {
    const id = asset?.id?.();
    return id == null ? null : String(id);
}

export class AssetTrails {
    constructor(map) {
        this.map = map;
        this.enabled = undefined; // set by Config; the first setEnabled always applies
        this.minutes = 30;
        this.trails = new Map();   // key -> [{ lat, lng, t }]
        this.tracked = new Map();  // key -> Asset
        this.selected = null;      // key of the asset whose trail is drawn
        this.group = null;         // its drawn trail

        const pane = map.getPane(PANE) || map.createPane(PANE);
        pane.style.pointerEvents = 'none';
        this.syncPaneZ();
        // One canvas for every trail: hundreds of short segments are much
        // cheaper there than as SVG paths.
        this.renderer = L.canvas({ pane: PANE, padding: 0.5 });
        this.layer = L.layerGroup();

        this._load();
        setInterval(() => this._refresh(), REFRESH_INTERVAL);
    }

    get windowMs() { return this.minutes * 60 * 1000; }

    /** Keep the trails just under the asset pins (pane-top), wherever the pane order puts them. */
    syncPaneZ() {
        const z = Number(this.map.getPane('pane-top')?.style.zIndex) || 600;
        this.map.getPane(PANE).style.zIndex = String(z - 1);
    }

    setEnabled(on) {
        on = !!on;
        if (on === this.enabled) return;
        this.enabled = on;
        if (on) {
            this.layer.addTo(this.map);
            this.tracked.forEach(a => this._record(a));
            this._draw();
        } else {
            // Off means no history is kept, not just hidden.
            this.layer.clearLayers();
            this.group = null;
            this.layer.remove();
            this.trails.clear();
            this._save();
        }
    }

    setMinutes(minutes) {
        this.minutes = Number(minutes) || 30;
        this._refresh();
    }

    /** Start recording an asset's position fixes. Call once per asset. */
    track(asset) {
        const id = keyOf(asset);
        if (id == null || this.tracked.has(id)) return;
        this.tracked.set(id, asset);
        // A fix writes latLng then lastSeen (Asset.updateFromJson), so
        // record on lastSeen: by then both are the new fix's.
        asset._trailSub = asset.lastSeen.subscribe(() => {
            if (this._record(asset) && id === this.selected) this._draw();
        });
        this._record(asset);
    }

    untrack(asset) {
        const id = keyOf(asset);
        asset?._trailSub?.dispose();
        if (id === this.selected) this.select(null);
        this.tracked.delete(id);
        this.trails.delete(id);
        this._scheduleSave();
    }

    /** Draw this asset's trail (and only this one's); null for none. */
    select(asset) {
        const id = keyOf(asset);
        if (id === this.selected) return;
        this.selected = id;
        this._draw();
    }

    _record(asset) {
        if (!this.enabled) return false;
        const lat = +asset.latitude?.(), lng = +asset.longitude?.();
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
        const id = keyOf(asset);
        let trail = this.trails.get(id);
        if (!trail) this.trails.set(id, trail = []);
        if (!addFix(trail, { lat, lng, t: fixTime(asset.lastSeen?.()) })) return false;
        this._scheduleSave();
        return true;
    }

    _draw() {
        if (this.group) this.layer.removeLayer(this.group);
        this.group = null;

        const id = this.selected;
        const trail = this.trails.get(id);
        const asset = this.tracked.get(id);
        if (!this.enabled || !asset || !trail || trail.length < 2) return;

        const color = assetColor(asset);
        const now = Date.now();
        const windowMs = this.windowMs;
        const opts = { renderer: this.renderer, interactive: false };
        const group = L.layerGroup();

        // Segments, each faded by the age of its newer end, over a pale
        // casing so they read on imagery and dark basemaps alike.
        for (let i = 1; i < trail.length; i++) {
            const a = trail[i - 1], b = trail[i];
            const opacity = trailOpacity(now - b.t, windowMs);
            const pts = [[a.lat, a.lng], [b.lat, b.lng]];
            L.polyline(pts, { ...opts, color: '#fff', weight: 6, opacity: opacity * 0.5, lineCap: 'round' }).addTo(group);
            L.polyline(pts, { ...opts, color, weight: 3, opacity, lineCap: 'round' }).addTo(group);
        }
        // A dot at each past fix (the newest is under the pin).
        for (let i = 0; i < trail.length - 1; i++) {
            const f = trail[i];
            const opacity = trailOpacity(now - f.t, windowMs);
            L.circleMarker([f.lat, f.lng], {
                ...opts, radius: 3.5, weight: 1.5,
                color: '#fff', opacity, fillColor: color, fillOpacity: opacity,
            }).addTo(group);
        }

        group.addTo(this.layer);
        this.group = group;
    }

    _refresh() {
        const cutoff = Date.now() - this.windowMs;
        let changed = false;
        this.trails.forEach((trail, id) => {
            if (pruneTrail(trail, cutoff)) changed = true;
            // A stationary asset that dropped to a single fix that has
            // aged out isn't worth storing.
            if (trail.length === 1 && trail[0].t < cutoff && !this.tracked.has(id)) this.trails.delete(id);
        });
        if (this.enabled) this._draw();
        if (changed) this._scheduleSave();
    }

    _scheduleSave() {
        if (this._saveTimer) return;
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            this._save();
        }, SAVE_DELAY);
    }

    _save() {
        try {
            if (!this.trails.size) {
                localStorage.removeItem(STORAGE_KEY);
                return;
            }
            const out = {};
            this.trails.forEach((trail, id) => {
                out[id] = trail.map(f => [+f.lat.toFixed(5), +f.lng.toFixed(5), Math.round(f.t / 1000)]);
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
        } catch { /* storage full or blocked: trails just won't survive a reload */ }
    }

    _load() {
        try {
            const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            Object.entries(raw).forEach(([id, fixes]) => {
                if (!Array.isArray(fixes)) return;
                const trail = fixes
                    .filter(f => Array.isArray(f) && f.length === 3 && f.every(Number.isFinite))
                    .map(([lat, lng, t]) => ({ lat, lng, t: t * 1000 }));
                if (trail.length) this.trails.set(id, trail);
            });
        } catch { /* corrupt or blocked: start empty */ }
    }
}
