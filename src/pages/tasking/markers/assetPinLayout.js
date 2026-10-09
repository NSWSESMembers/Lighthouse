/**
 * Asset pin decluttering.
 *
 * Every asset pin keeps its tip on the asset's real position, but when pins
 * would overlap, their bodies swing around the tip (and, if rotating alone
 * can't find room, extend out on a thin stem) so they stop covering each
 * other. The label stays upright and follows the body.
 *
 * Each placement is an angle (body direction, clockwise from straight up)
 * and an extension (stem length between the tip and the body), written as
 * plain CSS transforms on the icon's parts (see writePlacement and
 * styles/pages/tasking.css) and animated by CSS transitions, so pins swing
 * smoothly into place instead of jumping.
 *
 * The layout re-runs every frame while a vehicle is moving, so it's built to
 * stay calm: pins that aren't moving hold their placement for as long as
 * it's clear, moving pins fit in around them, and a pin only moves to a
 * better spot once it's been available for a moment.
 */

// Must match the .asset-pin geometry in tasking.css.
export const PIN_TIP_TO_CENTRE = 20 * Math.SQRT2; // 40px teardrop rotated 45deg
export const STEM_STEP = 22;                      // px per extension level
const PIN_BODY_RADIUS = 20;
// The capability code tab (asset_icon.js CODE_TAB_PATH), on the far side of
// the body from the point, as a circle: centred this far out from the
// body's centre, this big. Only pins showing a tab (pin.tab) have one.
const TAB_OFFSET = 26;
const TAB_RADIUS = 12;
// Closest a tab may come to another pin's body or tab (centre to centre).
const TAB_BODY_GAP = PIN_BODY_RADIUS + TAB_RADIUS + 2;
const TAB_TAB_GAP = 2 * TAB_RADIUS + 2;
const MAX_EXT_LEVEL = 6;

// Body centres closer than this collide. Bodies are 40px across, so this
// leaves a 4px gap between neighbouring pins.
export const MIN_BODY_GAP = 44;
// A body must keep clear of every other asset's tip (where it points): the
// body's 20px radius plus a margin. Closer, and the tip is hidden, and every
// stem that pin could use would start inside the body, so it has nowhere to go.
const MIN_TIP_GAP = 26;
// Stems must clear other bodies (20px radius) by this much, so a line never
// runs across another pin.
const MIN_STEM_GAP = 24;
// When nothing fits cleanly, a line across a pin looks worse than two pins
// touching, so stem overlaps count extra.
const STEM_OVERLAP_WEIGHT = 4;
// Lines may not cross each other: a crossing scores like this much overlap.
const LINE_CROSS_PENALTY = 40;
// Lines prefer to keep this clear of other vehicles' positions (where their
// dot or point is), except vehicles at the line's own start (the same spot).
// A preference, not a rule: in a tight clump nearly every line passes near
// another position, and making it a rule leaves pins nowhere to go but on
// top of each other. Each px inside the gap adds this much to a spot's cost.
const LINE_TIP_GAP = 8;
const LINE_TIP_COST = 3;
const LINE_TIP_NEAR = 12;
const LINE_START_IGNORE = 3;
// Moving to a new placement needs this much extra clearance, so pins don't
// flicker between two placements when they're right on the edge.
const HYSTERESIS = 4;
// Tips within this distance count as neighbours when choosing which way to
// lean (away from the crowd).
const NEIGHBOUR_RADIUS = 80;
// After a zoom, a pin whose old spot is blocked is placed again, but turning
// away from the side it was on costs this much per 180deg (a full turn
// outweighs two line levels), so it stays on that side if there's room and
// its line just gets longer or shorter.
const HINT_SWING_COST = 25;

// Below this zoom level pins just overlap, pointing straight down: zoomed
// out, swinging and stems across a whole region is more noise than help.
// The default; it's a config option (AssetPinLayout.setOptions).
export const DECLUTTER_MIN_ZOOM = 15;

// Only pins on screen, or within this many px of it, are laid out.
const VIEW_MARGIN = 150;
// At most one layout per this many ms. While vehicles move it would
// otherwise run every frame; the 300ms swing transitions smooth over it.
const MIN_RUN_INTERVAL = 50;

// A pin whose spot is still clear only moves to a better one (e.g. back to
// upright) once that's been available for IMPROVE_DELAY, and not within
// CHANGE_COOLDOWN of its last move.
export const IMPROVE_DELAY = 500;
export const CHANGE_COOLDOWN = 1000;
// Looking for a better spot stops for this layout once this many spots
// have been scored; the rest wait for the next frame, so a crowd that all
// came due together doesn't stall one.
const SEARCH_BUDGET = 400;
// A look that finds nothing better doubles the wait before the next one, up
// to this (ms): in a spot too crowded to ever fit, pins stop searching
// almost entirely instead of re-trying every IMPROVE_DELAY.
const MAX_SEARCH_INTERVAL = 8000;
// Moving pins look for a better spot this often (ms), so they still
// straighten up promptly as they leave a crowd.
const MOVER_SEARCH_INTERVAL = 150;

// Clockwise from straight up, preferred first.
const ANGLES = [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180];
// Stems have to thread between the pins already around a spot, so they get
// finer steps.
const STEM_ANGLES = [0, 15, -15, 30, -30, 45, -45, 60, -60, 75, -75, 90, -90,
    105, -105, 120, -120, 135, -135, 150, -150, 165, -165, 180];

const CELL = 48;

// Numeric keys (strings are a hot spot here). Cell coords stay well inside
// +-2^15 for any on-screen layout.
function cellKey(cx, cy) { return cx * 65536 + cy; }

function makeGrid() {
    const cells = new Map();
    return {
        add(x, y, item) {
            const k = cellKey(Math.floor(x / CELL), Math.floor(y / CELL));
            let arr = cells.get(k);
            if (!arr) cells.set(k, (arr = []));
            arr.push(item);
            item._cell = k;
        },
        remove(item) {
            const arr = cells.get(item._cell);
            const i = arr ? arr.indexOf(item) : -1;
            if (i > -1) arr.splice(i, 1);
        },
        // Calls fn for every item in cells overlapping the radius; stops
        // early (returning true) if fn returns true.
        some(x, y, radius, fn) {
            const x0 = Math.floor((x - radius) / CELL), x1 = Math.floor((x + radius) / CELL);
            const y0 = Math.floor((y - radius) / CELL), y1 = Math.floor((y + radius) / CELL);
            for (let cx = x0; cx <= x1; cx++) {
                for (let cy = y0; cy <= y1; cy++) {
                    const arr = cells.get(cellKey(cx, cy));
                    if (!arr) continue;
                    for (const item of arr) if (fn(item)) return true;
                }
            }
            return false;
        },
    };
}

// Stems span several cells, so they're indexed in every cell their bounding
// box touches; a query stamps each stem so it's only counted once.
function makeSegmentGrid() {
    const cells = new Map();
    let stamp = 0;
    const span = (s, pad, fn) => {
        const x0 = Math.floor((Math.min(s.x1, s.x2) - pad) / CELL), x1 = Math.floor((Math.max(s.x1, s.x2) + pad) / CELL);
        const y0 = Math.floor((Math.min(s.y1, s.y2) - pad) / CELL), y1 = Math.floor((Math.max(s.y1, s.y2) + pad) / CELL);
        for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) fn(cellKey(cx, cy));
    };
    return {
        add(seg) {
            span(seg, 0, (k) => {
                let arr = cells.get(k);
                if (!arr) cells.set(k, (arr = []));
                arr.push(seg);
            });
        },
        remove(seg) {
            span(seg, 0, (k) => {
                const arr = cells.get(k);
                const i = arr ? arr.indexOf(seg) : -1;
                if (i > -1) arr.splice(i, 1);
            });
        },
        near(x, y, radius, fn) {
            stamp++;
            span({ x1: x, y1: y, x2: x, y2: y }, radius, (k) => {
                const arr = cells.get(k);
                if (!arr) return;
                for (const seg of arr) {
                    if (seg._stamp === stamp) continue;
                    seg._stamp = stamp;
                    fn(seg);
                }
            });
        },
    };
}

function distToSegment(px, py, s) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / len2)) : 0;
    return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
}

// The line as drawn: from the tip to the edge of the pushed-out circle.
function stemSegment(x, y, angleDeg, ext) {
    const a = angleDeg * Math.PI / 180;
    const len = ext + PIN_TIP_TO_CENTRE - PIN_BODY_RADIUS;
    return { x1: x, y1: y, x2: x + len * Math.sin(a), y2: y - len * Math.cos(a) };
}

// Whether two lines cross. The first few px of each are ignored, so lines
// fanning out from the same spot (a yard of vehicles at one position) don't
// count as crossing where they start.
function segmentsCross(s, t) {
    const trim = (g) => {
        const dx = g.x2 - g.x1, dy = g.y2 - g.y1, len = Math.hypot(dx, dy);
        return { x1: g.x1 + dx * LINE_START_IGNORE / len, y1: g.y1 + dy * LINE_START_IGNORE / len, x2: g.x2, y2: g.y2 };
    };
    const a = trim(s), b = trim(t);
    const side = (px, py, g) => (g.x2 - g.x1) * (py - g.y1) - (g.y2 - g.y1) * (px - g.x1);
    return (side(a.x1, a.y1, b) > 0) !== (side(a.x2, a.y2, b) > 0)
        && (side(b.x1, b.y1, a) > 0) !== (side(b.x2, b.y2, a) > 0);
}

function bodyCentre(x, y, angleDeg, ext) {
    const a = angleDeg * Math.PI / 180;
    const len = PIN_TIP_TO_CENTRE + ext;
    return { x: x + len * Math.sin(a), y: y - len * Math.cos(a) };
}

function tabCentre(c, angleDeg) {
    const a = angleDeg * Math.PI / 180;
    return { x: c.x + TAB_OFFSET * Math.sin(a), y: c.y - TAB_OFFSET * Math.cos(a) };
}

const byScreen = (a, b) => (b.y - a.y) || (a.x - b.x);

/**
 * Pure placement step.
 *
 * @param {Array<{id:any, x:number, y:number, moving?:boolean, tab?:boolean, prev?:object, hint?:object}>} pins
 *        tip positions in screen pixels; `tab` if the pin shows a capability
 *        code tab, which then needs room too; `moving` while the asset is being
 *        animated to a new position; `prev` is this pin's result from the
 *        previous call (it carries the timers); `hint` is its result from a
 *        layout at another zoom, kept if it's still completely clear
 * @param {number} [now] ms clock for the improve/cooldown timers
 * @param {object} [opts]
 * @param {boolean} [opts.declutter=true] false leaves every pin upright
 *        (zoomed out, see DECLUTTER_MIN_ZOOM)
 * @param {boolean} [opts.allowLines=true] false keeps every pin on its
 *        position (rotation only); spots that can't fit just overlap
 * @returns {Map<any, {angle:number, ext:number, changedAt:number, betterSince:number|null,
 *          overlap:number, searchedAt:number, searchDue:boolean}>}
 *          angle in degrees ([-165..180], 0 = up, clockwise), ext in px;
 *          betterSince is set while a better spot is waiting out IMPROVE_DELAY;
 *          overlap > 0 when nothing clean was free (a crowded spot);
 *          searchDue when a look for a better spot was put off until
 *          searchedAt + IMPROVE_DELAY
 */
export function computePinPlacements(pins, now = 0, { declutter = true, allowLines = true } = {}) {
    const maxLevel = allowLines ? MAX_EXT_LEVEL : 0;
    const result = new Map();

    const tips = makeGrid();
    for (const p of pins) tips.add(p.x, p.y, p);

    const still = pins.filter((p) => !p.moving).sort(byScreen);
    const movers = pins.filter((p) => p.moving).sort(byScreen);

    const finish = (p, pl) => {
        const prev = p.prev;
        const same = prev && prev.angle === pl.angle && prev.ext === pl.ext;
        result.set(p.id, {
            angle: pl.angle,
            ext: pl.ext,
            changedAt: same ? (prev.changedAt ?? -Infinity) : now,
            betterSince: pl.betterSince ?? null,
            overlap: pl.overlap ?? 0,
            searchedAt: pl.searchedAt ?? (same ? (prev.searchedAt ?? -Infinity) : now),
            searchInterval: pl.searchInterval ?? (same ? (prev.searchInterval ?? IMPROVE_DELAY) : IMPROVE_DELAY),
            searchDue: !!pl.searchDue,
        });
    };

    if (!declutter) {
        for (const p of pins) finish(p, { angle: 0, ext: 0 });
        return result;
    }

    const bodies = makeGrid();
    const tabs = makeGrid();
    const stems = makeSegmentGrid();
    const placed = new Map(); // pin -> { body, tab, stem }

    const place = (p, c, stem, tc) => {
        const body = { x: c.x, y: c.y, owner: p };
        bodies.add(c.x, c.y, body);
        const tab = tc ? { x: tc.x, y: tc.y, owner: p } : null;
        if (tab) tabs.add(tab.x, tab.y, tab);
        const st = stem ? { ...stem, owner: p } : null;
        if (st) stems.add(st);
        placed.set(p, { body, tab, stem: st });
    };
    const unplace = (p) => {
        const it = placed.get(p);
        if (!it) return;
        bodies.remove(it.body);
        if (it.tab) tabs.remove(it.tab);
        if (it.stem) stems.remove(it.stem);
        placed.delete(p);
    };

    // --- Scoring ---
    const leanCache = new Map();
    const leanOf = (p) => {
        let v = leanCache.get(p);
        if (v) return v;
        let ax = 0, ay = 0;
        tips.some(p.x, p.y, NEIGHBOUR_RADIUS, (o) => {
            if (o === p || (o.moving && !p.moving)) return false;
            const dx = p.x - o.x, dy = p.y - o.y;
            const d = Math.hypot(dx, dy);
            if (d > NEIGHBOUR_RADIUS || d < 0.5) return false; // co-located: no useful direction
            ax += dx / d; ay += dy / d;
            return false;
        });
        const al = Math.hypot(ax, ay);
        v = al > 0 ? { x: ax / al, y: ay / al } : null;
        leanCache.set(p, v);
        return v;
    };

    // Overlaps are scored rather than rejected outright, so a spot too
    // crowded to fit everyone settles on the least-bad layout instead of
    // stacking pins on top of each other. Anything `p` itself has placed is
    // ignored, so a pin can be re-scored where it stands.
    let evals = 0;
    const evaluate = (p, angle, ext, margin) => {
        evals++;
        const c = bodyCentre(p.x, p.y, angle, ext);
        let overlap = 0, soft = 0;

        const bodyGap = MIN_BODY_GAP + margin;
        bodies.some(c.x, c.y, bodyGap, (b) => {
            if (b.owner !== p) overlap += Math.max(0, bodyGap - Math.hypot(b.x - c.x, b.y - c.y));
            return false;
        });

        // Code tabs: this body clear of other pins' tabs, and this pin's tab
        // clear of their bodies, tabs, positions and lines.
        const tabBodyGap = TAB_BODY_GAP + margin;
        tabs.some(c.x, c.y, tabBodyGap, (t) => {
            if (t.owner !== p) overlap += Math.max(0, tabBodyGap - Math.hypot(t.x - c.x, t.y - c.y));
            return false;
        });
        const tc = p.tab ? tabCentre(c, angle) : null;
        if (tc) {
            bodies.some(tc.x, tc.y, tabBodyGap, (b) => {
                if (b.owner !== p) overlap += Math.max(0, tabBodyGap - Math.hypot(b.x - tc.x, b.y - tc.y));
                return false;
            });
            const tabTabGap = TAB_TAB_GAP + margin;
            tabs.some(tc.x, tc.y, tabTabGap, (t) => {
                if (t.owner !== p) overlap += Math.max(0, tabTabGap - Math.hypot(t.x - tc.x, t.y - tc.y));
                return false;
            });
            const tabTipGap = TAB_RADIUS + margin;
            tips.some(tc.x, tc.y, tabTipGap, (o) => {
                if (o !== p && (p.moving || !o.moving)) overlap += Math.max(0, tabTipGap - Math.hypot(o.x - tc.x, o.y - tc.y));
                return false;
            });
            stems.near(tc.x, tc.y, TAB_RADIUS + 2, (st) => {
                if (st.owner !== p) overlap += STEM_OVERLAP_WEIGHT * Math.max(0, TAB_RADIUS + 2 - distToSegment(tc.x, tc.y, st));
            });
        }

        // Not on top of another asset's tip (pins that aren't moving ignore
        // moving ones, which are only passing through)...
        const tipGap = MIN_TIP_GAP + margin;
        tips.some(c.x, c.y, tipGap, (o) => {
            if (o !== p && (p.moving || !o.moving)) overlap += Math.max(0, tipGap - Math.hypot(o.x - c.x, o.y - c.y));
            return false;
        });

        // ...nor on an existing stem, and its own stem mustn't cross a
        // placed body. (No hysteresis margin here: the slots between a
        // spot's first few pins only just fit a stem.)
        stems.near(c.x, c.y, MIN_STEM_GAP, (st) => {
            if (st.owner !== p) overlap += STEM_OVERLAP_WEIGHT * Math.max(0, MIN_STEM_GAP - distToSegment(c.x, c.y, st));
        });
        const stem = ext > 0 ? stemSegment(p.x, p.y, angle, ext) : null;
        if (stem) {
            const mx = (stem.x1 + stem.x2) / 2, my = (stem.y1 + stem.y2) / 2;
            const half = Math.hypot(stem.x2 - stem.x1, stem.y2 - stem.y1) / 2;
            bodies.some(mx, my, half + MIN_STEM_GAP, (b) => {
                if (b.owner !== p) overlap += STEM_OVERLAP_WEIGHT * Math.max(0, MIN_STEM_GAP - distToSegment(b.x, b.y, stem));
                return false;
            });
            tabs.some(mx, my, half + TAB_RADIUS + 2, (t) => {
                if (t.owner !== p) overlap += STEM_OVERLAP_WEIGHT * Math.max(0, TAB_RADIUS + 2 - distToSegment(t.x, t.y, stem));
                return false;
            });
            // ...nor cross another line...
            stems.near(mx, my, half, (st) => {
                if (st.owner !== p && segmentsCross(stem, st)) overlap += LINE_CROSS_PENALTY;
            });
            // ...nor run over another vehicle's position.
            tips.some(mx, my, half + LINE_TIP_GAP, (o) => {
                if (o === p || (o.moving && !p.moving)) return false;
                if (Math.hypot(o.x - p.x, o.y - p.y) < LINE_START_IGNORE) return false;
                const into = Math.max(0, LINE_TIP_GAP - distToSegment(o.x, o.y, stem));
                // Near the line's start it's often unavoidable (a vehicle
                // parked alongside); further along, another direction would
                // miss it, so there it's a rule.
                if (Math.hypot(o.x - p.x, o.y - p.y) > LINE_TIP_NEAR) overlap += STEM_OVERLAP_WEIGHT * into;
                else soft += LINE_TIP_COST * into;
                return false;
            });
        }

        const lean = leanOf(p);
        const a = angle * Math.PI / 180;
        const away = lean ? (1 - (Math.sin(a) * lean.x - Math.cos(a) * lean.y)) / 2 : 0;
        const cost = (ext / STEM_STEP) * 10 + Math.abs(angle) / 30 + 0.9 * away + soft + hintSwing(p, angle, ext);
        return { angle, ext, c, tc, stem, overlap, cost };
    };

    const isPrev = (p, angle, ext) => !!p.prev && p.prev.angle === angle && p.prev.ext === ext;
    // Only for pins being placed afresh after a zoom (a kept hint becomes
    // prev). Upright has no side, so going upright is never held back, and a
    // pin that was upright has no side to keep.
    const hintSwing = (p, angle, ext) => {
        const h = p.hint;
        if (!h || p.prev || (!angle && !ext) || (!h.angle && !h.ext)) return 0;
        return HINT_SWING_COST * Math.abs((((angle - h.angle) % 360) + 540) % 360 - 180) / 180;
    };

    // Best clean placement (new spots need HYSTERESIS extra clearance), or
    // the least-bad one if nothing is clean. With `below`, only clean spots
    // cheaper than that are of interest (null if there are none).
    const bestFor = (p, below = Infinity) => {
        let best = null, leastBad = null;
        // Further out costs 10 per level, so stop once that alone can't beat
        // the best clean spot found (a closer one can still cost more, e.g.
        // a line over another vehicle's position).
        for (let level = 0; level <= maxLevel && (!best || level * 10 - 0.5 < best.cost); level++) {
            for (const angle of (level ? STEM_ANGLES : ANGLES)) {
                const mine = isPrev(p, angle, level * STEM_STEP);
                // Cost without the lean term (0..0.9): skip spots that can't
                // beat what we already have. Angles are in rising order.
                const floor = level * 10 + Math.abs(angle) / 30 - (mine ? 0.5 : 0);
                if (floor >= below || (best && floor >= best.cost)) continue;
                const e = evaluate(p, angle, level * STEM_STEP, mine ? 0 : HYSTERESIS);
                if (mine) e.cost -= 0.5;
                if (e.overlap === 0) {
                    if (!best || e.cost < best.cost) best = e;
                } else if (!leastBad || e.overlap < leastBad.overlap
                    || (e.overlap === leastBad.overlap && e.cost < leastBad.cost)) {
                    leastBad = e;
                }
            }
        }
        return below < Infinity ? best : best || leastBad;
    };

    const kept = [];

    // 1. Pins that aren't moving keep their spot while it's still clear (or,
    //    in a spot too crowded for anything to be clear, no worse than it was).
    //    After a zoom, a pin keeps its old spot only if it's completely
    //    clear (a least-bad spot from a tighter zoom would otherwise count as
    //    "no worse" and never sort itself out). It then relaxes from there
    //    like any other kept pin (step 3) rather than every pin being laid
    //    out afresh at once, which reshuffles the whole crowd.
    for (const p of still) {
        const prev = p.prev ?? (p.hint?.ext <= maxLevel * STEM_STEP ? p.hint : null);
        if (!prev) continue;
        const e = evaluate(p, prev.angle, prev.ext, 0);
        if (e.overlap > (p.prev ? (prev.overlap || 0) + 0.01 : 0)) continue;
        // From here on it's this pin's previous placement like any other.
        if (!p.prev) {
            p.prev = {
                angle: prev.angle, ext: prev.ext, overlap: 0, changedAt: prev.changedAt,
                betterSince: null, searchedAt: -Infinity, searchInterval: IMPROVE_DELAY,
            };
        }
        place(p, e.c, e.stem, e.tc);
        kept.push([p, e]);
    }

    // 2. The rest (new, or their spot got blocked) find one now.
    for (const p of still) {
        if (placed.has(p)) continue;
        const b = bestFor(p);
        place(p, b.c, b.stem, b.tc);
        finish(p, { angle: b.angle, ext: b.ext, overlap: b.overlap });
    }

    // 3. Kept pins move to a better spot only once it's been there for
    //    IMPROVE_DELAY, and not within CHANGE_COOLDOWN of their last move.
    //    Looking for one is the expensive part of a layout, and this runs
    //    every frame while anything moves: going back upright (one spot) is
    //    checked every time, but a full look happens at most every
    //    searchInterval, which backs off while looks keep finding nothing.
    const budgetEnd = evals + SEARCH_BUDGET;
    for (const [p, cur] of kept) {
        const prev = p.prev;
        const keep = (extra) => finish(p, { angle: prev.angle, ext: prev.ext, overlap: cur.overlap, ...extra });
        // Upright and clear is the cheapest spot there is.
        if (prev.angle === 0 && prev.ext === 0 && cur.overlap === 0) {
            keep();
            continue;
        }
        // Its spot got less crowded, so something moved away: look again now.
        const easing = cur.overlap < (prev.overlap || 0) - 0.01;
        let interval = easing ? IMPROVE_DELAY : (prev.searchInterval ?? IMPROVE_DELAY);
        let b = null, searched = false;
        const up = evaluate(p, 0, 0, HYSTERESIS);
        if (up.overlap === 0) {
            b = up;
        } else if ((easing || now - (prev.searchedAt ?? -Infinity) >= interval) && evals < budgetEnd) {
            searched = true;
            // Overlapping: any clear spot is better. Clear: only a cheaper one.
            const found = cur.overlap > 0 ? bestFor(p) : bestFor(p, cur.cost - 0.25);
            if (found && found.overlap === 0 && !isPrev(p, found.angle, found.ext)) b = found;
            else interval = Math.min(interval * 2, MAX_SEARCH_INTERVAL);
        }
        if (!b) {
            keep(searched
                ? { searchedAt: now, searchInterval: interval }
                : { betterSince: prev.betterSince, searchInterval: interval, searchDue: true });
            continue;
        }
        const since = prev.betterSince ?? now;
        const ready = now - since >= IMPROVE_DELAY && now - (prev.changedAt ?? -Infinity) >= CHANGE_COOLDOWN;
        if (ready) {
            unplace(p);
            place(p, b.c, b.stem, b.tc);
            finish(p, { angle: b.angle, ext: b.ext, overlap: 0, searchedAt: now });
        } else {
            keep({ betterSince: since, searchedAt: now, searchInterval: IMPROVE_DELAY });
        }
    }

    // 4. Moving pins fit in around everything else; they never push a pin
    //    that isn't moving out of its spot.
    //    Like the others, a moving pin keeps its spot unless that got
    //    worse, and only looks for a better one every MOVER_SEARCH_INTERVAL.
    for (const p of movers) {
        const prev = p.prev;
        if (prev) {
            const cur = evaluate(p, prev.angle, prev.ext, 0);
            const settled = prev.angle === 0 && prev.ext === 0 && cur.overlap === 0;
            const recent = now - (prev.searchedAt ?? -Infinity) < MOVER_SEARCH_INTERVAL;
            if (cur.overlap <= (prev.overlap || 0) + 0.01 && (settled || recent)) {
                place(p, cur.c, cur.stem, cur.tc);
                finish(p, { angle: prev.angle, ext: prev.ext, overlap: cur.overlap, searchDue: !settled });
                continue;
            }
        }
        const b = bestFor(p);
        place(p, b.c, b.stem, b.tc);
        finish(p, { angle: b.angle, ext: b.ext, overlap: b.overlap, searchedAt: now });
    }

    return result;
}

function writePlacement(marker) {
    const el = marker.getElement?.()?.querySelector('.asset-pin');
    const st = marker._pinState;
    if (!el || !st) return;
    const angle = marker._pinAngleRaw || 0;
    const ext = st.ext;
    // Upright pins get no transforms at all (see tasking.css). An angle
    // unwrapped to 360 etc. stays as a rotate, so it doesn't spin back to 0.
    el.querySelector('.asset-pin__rot').style.transform = angle ? `rotate(${angle}deg)` : '';
    el.querySelector('.asset-pin__label').style.transform = angle ? `rotate(${-angle}deg)` : '';
    el.querySelector('.asset-pin__head').style.transform = ext ? `translateY(${-ext}px)` : '';
    // The code tab swings with the head; past sideways, turn its code over
    // so it doesn't read upside down.
    el.querySelector('.asset-pin__code')?.classList.toggle('is-flipped', Math.abs(st.angle) > 90);
    // Pushed out: a circle, with a dot on the true position and a line from
    // the dot to the circle's edge (see tasking.css). Only rotated: the
    // point still sits on the true position, so it keeps it.
    el.classList.toggle('has-stem', ext > 0);
    const line = PIN_TIP_TO_CENTRE + ext - PIN_BODY_RADIUS;
    const stem = el.querySelector('.asset-pin__stem');
    stem.style.height = line + 'px';
    stem.style.top = -line + 'px';

    // The popup opens over the pin's body wherever it has swung to, not over
    // the tip. Leaflet puts the popup's tip at anchor + popupAnchor + offset;
    // the icon's popupAnchor is [0, -42] and Leaflet's default offset is
    // [0, 7], i.e. 6.7px above an upright body's centre. Keep that. While
    // the code tab shows, popupAnchor is higher by the tab's height so the
    // popup meets the tab; the tab swings with the head, so only keep as
    // much of that lift as the tab still points up (none once it's sideways
    // or below).
    const popup = marker.getPopup?.();
    if (popup) {
        const a = st.angle * Math.PI / 180;
        const len = PIN_TIP_TO_CENTRE + ext;
        const anchorY = marker.options?.icon?.options?.popupAnchor?.[1] ?? -42;
        const codeLift = Math.max(0, -42 - anchorY);
        const drop = codeLift * (1 - Math.max(0, Math.cos(a)));
        popup.options.offset = [len * Math.sin(a), -len * Math.cos(a) + PIN_TIP_TO_CENTRE + 7 + drop];
        if (popup.isOpen()) popup.update();
    }
}

/**
 * Re-apply a marker's current placement to a freshly built icon (setIcon
 * replaces the icon's HTML, which drops the inline custom properties).
 */
export function restorePinPlacement(marker) {
    if (marker?._pinState) writePlacement(marker);
    // Keep the open-popup highlight (see focusWhilePopupOpen) across rebuilds.
    if (marker?.isPopupOpen?.()) marker.getElement()?.querySelector('.asset-pin')?.classList.add('is-focused');
}

export class AssetPinLayout {
    /**
     * @param {L.Map} map
     * @param {L.LayerGroup[]} layers asset layers whose markers are laid out together
     */
    constructor(map, layers) {
        this.map = map;
        this.layers = layers;
        this._raf = null;
        this._timer = null;
        this._lastRun = -Infinity;
        // The "spread out overlapping asset markers" config options.
        this._enabled = true;
        this._minZoom = DECLUTTER_MIN_ZOOM;
        this._allowLines = true;
        // Whether capability code tabs are showing (config option); a pin
        // with a code then needs room for its tab too.
        this._codeTabs = true;
        // Markers currently swung or on a stem: zoomed out, these are all
        // that need touching (back to upright).
        this._tilted = new Set();

        this.schedule = this.schedule.bind(this);
        // Only on-screen pins are laid out, so a pan (moveend) brings new
        // ones in; zooms and markers coming/going/moving do too.
        map.on('zoomend viewreset moveend resize', this.schedule);
        map.on('layeradd layerremove', (e) => {
            if (e.layer?._assetId !== undefined || this.layers.includes(e.layer)) this.schedule();
        });
    }

    schedule() {
        // Off or zoomed out with everything upright there's nothing to do,
        // however many markers move.
        if (this._raf || (!this._active() && !this._tilted.size)) return;
        const frame = () => {
            this._raf = requestAnimationFrame(() => {
                this._raf = null;
                this._lastRun = performance.now();
                this.run();
            });
        };
        const wait = this._lastRun + MIN_RUN_INTERVAL - performance.now();
        if (wait > 16) {
            this._raf = setTimeout(frame, wait - 16);
        } else {
            frame();
        }
    }

    /** Asset markers on screen (plus a margin), with their layer points. */
    _markers() {
        const map = this.map;
        const size = map.getSize();
        const markers = [], points = [];
        for (const layer of this.layers) {
            if (!map.hasLayer(layer)) continue;
            layer.eachLayer((m) => {
                if (!m.getElement?.()) return;
                const pt = map.latLngToLayerPoint(m.getLatLng());
                const c = map.layerPointToContainerPoint(pt);
                if (c.x < -VIEW_MARGIN || c.y < -VIEW_MARGIN
                    || c.x > size.x + VIEW_MARGIN || c.y > size.y + VIEW_MARGIN) return;
                markers.push(m);
                points.push(pt);
            });
        }
        return { markers, points };
    }

    run() {
        const map = this.map;
        const zoom = map.getZoom();
        // Placements carry over between layouts at the same zoom and
        // options; from another zoom they're only a hint (see below).
        const layoutKey = zoom + '|' + this._allowLines + '|' + this._codeTabs;
        if (!this._active()) {
            this._straightenAll();
            return;
        }
        const { markers, points } = this._markers();
        if (!markers.length) return;

        const now = performance.now();
        const pins = markers.map((m, i) => (
            {
                id: i, x: points[i].x, y: points[i].y, moving: !!m._pinMoving,
                // asset_icon.js puts the code on the icon's options.
                tab: this._codeTabs && !!m.options?.icon?.options?.capabilityCode,
                // The keep-your-spot rules are for vehicles moving at a fixed
                // zoom. A placement from another zoom (or other options) is
                // kept only if it's still completely clear (a least-bad spot
                // in a tight crowd would count as "no worse" once zoomed in
                // and things spread out); laying every pin out afresh instead
                // reshuffles the whole map on each zoom step.
                prev: m._pinState?.layoutKey === layoutKey ? m._pinState : undefined,
                hint: m._pinState?.layoutKey === layoutKey ? undefined : m._pinState,
            }));
        const placements = computePinPlacements(pins, now, { allowLines: this._allowLines });

        let wake = Infinity;
        markers.forEach((m, i) => {
            const st = placements.get(i);
            const old = m._pinState;
            m._pinState = { ...st, layoutKey };

            // A better spot is waiting out its delay, or a look for one was
            // put off: come back when it's due.
            if (st.betterSince !== null) {
                wake = Math.min(wake, Math.max(st.betterSince + IMPROVE_DELAY, st.changedAt + CHANGE_COOLDOWN) - now);
            }
            if (st.searchDue) wake = Math.min(wake, st.searchedAt + st.searchInterval - now);

            if (st.angle || st.ext) this._tilted.add(m);
            else this._tilted.delete(m);
            if (old && old.angle === st.angle && old.ext === st.ext) return;
            // Unwrap so the CSS transition takes the short way round
            // (150 -> -150 is a 60deg swing, not 300deg).
            const raw = m._pinAngleRaw || 0;
            m._pinAngleRaw = raw + ((((st.angle - raw) % 360) + 540) % 360 - 180);
            writePlacement(m);
        });

        clearTimeout(this._timer);
        this._timer = wake < Infinity ? setTimeout(this.schedule, Math.max(16, wake)) : null;
    }

    _active() {
        return this._enabled && this.map.getZoom() >= this._minZoom;
    }

    /** Turn the layout on or off; off, every pin goes back upright. */
    setEnabled(on) {
        if (this._enabled === on) return;
        this._enabled = on;
        this.schedule();
    }

    /**
     * Config options: the zoom level spreading starts at, and whether pins
     * may move out on lines. A change re-lays every pin out from scratch.
     */
    setOptions({ minZoom = this._minZoom, allowLines = this._allowLines } = {}) {
        if (minZoom === this._minZoom && allowLines === this._allowLines) return;
        this._minZoom = minZoom;
        this._allowLines = allowLines;
        this.schedule();
    }

    /**
     * Capability code tabs shown or hidden (config option): re-lay pins out
     * so they make room for tabs, or stop doing so.
     */
    setCodeTabs(on) {
        if (this._codeTabs === !!on) return;
        this._codeTabs = !!on;
        this.schedule();
    }

    /** Off or zoomed out: swing every tilted pin back upright, then stop. */
    _straightenAll() {
        clearTimeout(this._timer);
        this._timer = null;
        for (const m of this._tilted) {
            m._pinState = { ...m._pinState, angle: 0, ext: 0, overlap: 0, betterSince: null, searchDue: false };
            const raw = m._pinAngleRaw || 0;
            m._pinAngleRaw = raw + ((((0 - raw) % 360) + 540) % 360 - 180);
            writePlacement(m);
        }
        this._tilted.clear();
    }
}
