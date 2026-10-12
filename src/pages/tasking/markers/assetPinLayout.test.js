import { describe, it, expect } from 'vitest';
import { computePinPlacements, swingDelta, PIN_TIP_TO_CENTRE, MIN_BODY_GAP, IMPROVE_DELAY, CHANGE_COOLDOWN } from './assetPinLayout.js';

function centre(p, { angle, ext }) {
    const a = angle * Math.PI / 180;
    const len = PIN_TIP_TO_CENTRE + ext;
    return { x: p.x + len * Math.sin(a), y: p.y - len * Math.cos(a) };
}

function minBodyGap(pins, placements) {
    let min = Infinity;
    const cs = pins.map(p => centre(p, placements.get(p.id)));
    for (let i = 0; i < cs.length; i++) {
        for (let j = i + 1; j < cs.length; j++) {
            min = Math.min(min, Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y));
        }
    }
    return min;
}

describe('computePinPlacements', () => {
    it('leaves isolated pins pointing straight down at their position', () => {
        const pins = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 300, y: 0 }];
        const out = computePinPlacements(pins);
        expect(out.get('a')).toMatchObject({ angle: 0, ext: 0 });
        expect(out.get('b')).toMatchObject({ angle: 0, ext: 0 });
    });

    it('swings side-by-side pins apart, away from each other', () => {
        const pins = [{ id: 'left', x: 0, y: 0 }, { id: 'right', x: 10, y: 0 }];
        const out = computePinPlacements(pins);
        expect(minBodyGap(pins, out)).toBeGreaterThanOrEqual(MIN_BODY_GAP);
        // One may stay upright; whichever moves leans away from the other.
        const l = out.get('left'), r = out.get('right');
        expect(l.angle <= 0 && r.angle >= 0).toBe(true);
        expect(l.ext + r.ext).toBe(0);
    });

    it('fans out a crowd of co-located pins without overlapping bodies', () => {
        const pins = Array.from({ length: 12 }, (_, i) => ({ id: i, x: 100, y: 100 }));
        const out = computePinPlacements(pins);
        expect(minBodyGap(pins, out)).toBeGreaterThanOrEqual(MIN_BODY_GAP);
        // Rotation alone fits 3 at one spot; the rest need stems.
        expect([...out.values()].some(p => p.ext > 0)).toBe(true);
    });

    it('never runs a stem across another pin', () => {
        // A tight spot that can't fit cleanly: a stem may touch another
        // pin's coloured rim, but never reach its label disc (17px radius).
        const pins = Array.from({ length: 6 }, (_, i) => ({ id: i, x: 100 + (i % 3) * 12, y: 100 + Math.floor(i / 3) * 10 }));
        const out = computePinPlacements(pins);
        for (const p of pins) {
            const { angle, ext } = out.get(p.id);
            if (!ext) continue;
            const a = angle * Math.PI / 180;
            const s = { x1: p.x, y1: p.y, x2: p.x + ext * Math.sin(a), y2: p.y - ext * Math.cos(a) };
            for (const o of pins) {
                if (o === p) continue;
                const c = centre(o, out.get(o.id));
                const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
                const t = Math.max(0, Math.min(1, ((c.x - s.x1) * dx + (c.y - s.y1) * dy) / (dx * dx + dy * dy)));
                expect(Math.hypot(c.x - (s.x1 + t * dx), c.y - (s.y1 + t * dy))).toBeGreaterThanOrEqual(17);
            }
        }
    });

    it('keeps the previous placement while it still fits (no flicker)', () => {
        // Far enough apart that both could point up, but 'b' was already
        // swung right and still fits there.
        const pins = [
            { id: 'a', x: 0, y: 0 },
            { id: 'b', x: 46, y: 0, prev: { angle: 30, ext: 0 } },
        ];
        const out = computePinPlacements(pins);
        expect(out.get('b')).toMatchObject({ angle: 30, ext: 0 });
    });

    it('returns to upright only once the room has been clear for a moment', () => {
        const pins = (prev) => [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 200, y: 0, prev }];
        // Clear room appears: b waits rather than swinging straight away.
        let out = computePinPlacements(pins({ angle: 60, ext: 0, changedAt: -5000 }), 0);
        expect(out.get('b')).toMatchObject({ angle: 60, betterSince: 0 });
        // Still clear after the delay: now it goes upright.
        out = computePinPlacements(pins(out.get('b')), IMPROVE_DELAY);
        expect(out.get('b')).toMatchObject({ angle: 0, ext: 0, changedAt: IMPROVE_DELAY, betterSince: null });
    });

    it('does not move to a better spot within the cooldown of its last move', () => {
        const pins = (prev) => [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 200, y: 0, prev }];
        let out = computePinPlacements(pins({ angle: 60, ext: 0, changedAt: 0, betterSince: 0 }), IMPROVE_DELAY);
        expect(out.get('b').angle).toBe(60);
        out = computePinPlacements(pins(out.get('b')), CHANGE_COOLDOWN);
        expect(out.get('b').angle).toBe(0);
    });

    it('a moving pin fits in around the others instead of pushing them', () => {
        const still = computePinPlacements([{ id: 'a', x: 100, y: 100 }, { id: 'b', x: 110, y: 100 }], 0);
        // A vehicle drives right through them.
        for (let x = 40; x <= 180; x += 10) {
            const out = computePinPlacements([
                { id: 'a', x: 100, y: 100, prev: still.get('a') },
                { id: 'b', x: 110, y: 100, prev: still.get('b') },
                { id: 'm', x, y: 100, moving: true },
            ], x * 10);
            expect(out.get('a')).toMatchObject({ angle: still.get('a').angle, ext: still.get('a').ext });
            expect(out.get('b')).toMatchObject({ angle: still.get('b').angle, ext: still.get('b').ext });
        }
    });

    it('leaves everything upright and overlapping when decluttering is off (zoomed out)', () => {
        const pins = Array.from({ length: 12 }, (_, i) => ({ id: i, x: 100 + i, y: 100, prev: { angle: 60, ext: 22 } }));
        const out = computePinPlacements(pins, 0, { declutter: false });
        expect([...out.values()].every(p => p.angle === 0 && p.ext === 0)).toBe(true);
    });

    it('does not let lines cross each other', () => {
        // Eight vehicles scattered over ~60px: crowded enough to need lines.
        const tips = [[3, 41], [52, 8], [27, 57], [44, 33], [9, 12], [60, 50], [31, 22], [18, 35]];
        const pins = tips.map(([x, y], i) => ({ id: i, x, y }));
        const out = computePinPlacements(pins);
        const lines = pins.filter(p => out.get(p.id).ext).map(p => {
            const { angle, ext } = out.get(p.id);
            const a = angle * Math.PI / 180, len = ext + PIN_TIP_TO_CENTRE - 20;
            // skip the first 3px, where lines from one spot may meet
            return [[p.x + 3 * Math.sin(a), p.y - 3 * Math.cos(a)], [p.x + len * Math.sin(a), p.y - len * Math.cos(a)]];
        });
        expect(lines.length).toBeGreaterThan(1);
        const side = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
        for (let i = 0; i < lines.length; i++) {
            for (let j = i + 1; j < lines.length; j++) {
                const [a1, a2] = lines[i], [b1, b2] = lines[j];
                const crosses = (side(b1, b2, a1) > 0) !== (side(b1, b2, a2) > 0)
                    && (side(a1, a2, b1) > 0) !== (side(a1, a2, b2) > 0);
                expect(crosses).toBe(false);
            }
        }
    });

    it('keeps lines off other vehicles\' positions where it can', () => {
        const tips = [[3, 41], [52, 8], [27, 57], [44, 33], [9, 12], [60, 50], [31, 22], [18, 35]];
        const pins = tips.map(([x, y], i) => ({ id: i, x, y }));
        const out = computePinPlacements(pins);
        for (const p of pins) {
            const { angle, ext } = out.get(p.id);
            if (!ext) continue;
            const a = angle * Math.PI / 180, len = ext + PIN_TIP_TO_CENTRE - 20;
            const [x2, y2] = [p.x + len * Math.sin(a), p.y - len * Math.cos(a)];
            for (const o of pins) {
                // Positions right beside a line's start can't always be avoided.
                if (o === p || Math.hypot(o.x - p.x, o.y - p.y) <= 12) continue;
                const dx = x2 - p.x, dy = y2 - p.y;
                const t = Math.max(0, Math.min(1, ((o.x - p.x) * dx + (o.y - p.y) * dy) / (dx * dx + dy * dy)));
                expect(Math.hypot(o.x - p.x - t * dx, o.y - p.y - t * dy)).toBeGreaterThanOrEqual(8);
            }
        }
    });

    it('keeps bodies clear of other tips, so no pin is boxed in (zoom-out regression)', () => {
        // Six vehicles from a real overlap report: with bodies allowed close
        // to other tips, one pin had no clear spot or stem left.
        const tips = [[379, 444], [416, 477], [369, 500], [406, 522], [453, 482], [360, 567]];
        const pins = tips.map(([x, y], i) => ({ id: i, x, y }));
        const out = computePinPlacements(pins);
        expect(minBodyGap(pins, out)).toBeGreaterThanOrEqual(MIN_BODY_GAP);
        expect([...out.values()].every(p => p.overlap === 0)).toBe(true);
    });

    it('keeps pins on their positions when lines are turned off', () => {
        const pins = Array.from({ length: 8 }, (_, i) => ({ id: i, x: 100 + (i % 3) * 8, y: 100 + Math.floor(i / 3) * 8 }));
        const out = computePinPlacements(pins, 0, { allowLines: false });
        expect([...out.values()].every(p => p.ext === 0)).toBe(true);
        expect([...out.values()].some(p => p.angle !== 0)).toBe(true);
    });

    it('never covers another pin\'s tip with its body', () => {
        // b's tip sits right where a's upright body would be.
        const pins = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 0, y: -28 }];
        const out = computePinPlacements(pins);
        const c = centre(pins[0], out.get('a'));
        expect(Math.hypot(c.x - 0, c.y + 28)).toBeGreaterThanOrEqual(16);
    });

    it('keeps a placement from another zoom while it is still clear, then relaxes', () => {
        // A depot of 5 laid out, then zoomed in one level (positions double):
        // nobody swaps sides at the zoom itself.
        const geo = [[100, 100], [104, 100], [100, 104], [108, 102], [102, 108]];
        const before = computePinPlacements(geo.map(([x, y], id) => ({ id, x, y })), 0);
        const after = computePinPlacements(geo.map(([x, y], id) => ({ id, x: x * 2, y: y * 2, hint: before.get(id) })), 10000);
        for (const [id, pl] of before) expect(after.get(id)).toMatchObject({ angle: pl.angle, ext: pl.ext });
        // Kept spots then relax as usual, once room has been clear a moment.
        const tilted = [...after.values()].filter(p => p.angle || p.ext);
        expect(tilted.every(p => p.betterSince === null || p.betterSince === 10000)).toBe(true);
    });

    it('lays out afresh a placement from another zoom that no longer fits cleanly', () => {
        // b was upright when far from a; zoomed out it's right under a's body.
        const out = computePinPlacements([
            { id: 'a', x: 0, y: 0, hint: { angle: 0, ext: 0 } },
            { id: 'b', x: 10, y: 0, hint: { angle: 0, ext: 0 } },
        ]);
        expect(out.get('a').angle !== 0 || out.get('b').angle !== 0).toBe(true);
        expect([...out.values()].every(p => p.overlap === 0)).toBe(true);
    });

    it('keeps to its old side when its spot from another zoom is blocked', () => {
        // a was swung right; b now sits where a's body was. Swinging up-left
        // would be cheaper, but a stays on the right.
        const out = computePinPlacements([
            { id: 'a', x: 0, y: 0, hint: { angle: 90, ext: 0 } },
            { id: 'b', x: 28, y: -20, hint: { angle: 0, ext: 0 } },
        ]);
        expect(out.get('b')).toMatchObject({ angle: 0, ext: 0 });
        expect(out.get('a').angle).toBeGreaterThan(0);
        expect(out.get('a').overlap).toBe(0);
    });

    it('ignores a hint on a line once lines are turned off', () => {
        const out = computePinPlacements([{ id: 'a', x: 0, y: 0, hint: { angle: 30, ext: 44 } }], 0, { allowLines: false });
        expect(out.get('a')).toMatchObject({ angle: 0, ext: 0 });
    });
});

describe('computePinPlacements with code tabs', () => {
    // Mirrors TAB_OFFSET / TAB_RADIUS / TAB_BODY_GAP in assetPinLayout.js.
    const TAB_OFFSET = 26, TAB_BODY_GAP = 34;
    const tabCentre = (p, pl) => {
        const c = centre(p, pl), a = pl.angle * Math.PI / 180;
        return { x: c.x + TAB_OFFSET * Math.sin(a), y: c.y - TAB_OFFSET * Math.cos(a) };
    };
    const minTabToBody = (pins, out) => {
        let min = Infinity;
        for (const p of pins) {
            if (!p.tab) continue;
            const t = tabCentre(p, out.get(p.id));
            for (const q of pins) {
                if (q === p) continue;
                const c = centre(q, out.get(q.id));
                min = Math.min(min, Math.hypot(t.x - c.x, t.y - c.y));
            }
        }
        return min;
    };

    // B's position sits 59px above A's: both bodies fit upright, but A's tab
    // would then sit under B's body.
    const stacked = (tab) => [{ id: 'a', x: 100, y: 100, tab }, { id: 'b', x: 100, y: 41, tab }];

    it('leaves the stacked pair upright when they have no tabs', () => {
        const out = computePinPlacements(stacked(false));
        expect(out.get('a')).toMatchObject({ angle: 0, ext: 0 });
        expect(out.get('b')).toMatchObject({ angle: 0, ext: 0 });
    });

    it('moves one of the pair so a tab is not covered by the other body', () => {
        const pins = stacked(true);
        const out = computePinPlacements(pins);
        expect(out.get('a').angle !== 0 || out.get('b').angle !== 0 || out.get('a').ext || out.get('b').ext).toBeTruthy();
        expect(minTabToBody(pins, out)).toBeGreaterThanOrEqual(TAB_BODY_GAP);
        expect(minBodyGap(pins, out)).toBeGreaterThanOrEqual(MIN_BODY_GAP);
    });

    it('keeps tabs clear in a spread-out crowd', () => {
        const pins = Array.from({ length: 8 }, (_, i) => ({ id: i, x: 100 + (i % 4) * 30, y: 100 + Math.floor(i / 4) * 40, tab: true }));
        const out = computePinPlacements(pins);
        expect(minTabToBody(pins, out)).toBeGreaterThanOrEqual(TAB_BODY_GAP);
    });
});

describe('swingDelta', () => {
    const tip = { x: 0, y: 0 };
    // A parked pin's head straight above this pin's head (upright).
    const above = [{ x: 0, y: -PIN_TIP_TO_CENTRE - 6 }];

    it('takes the short way round when nothing is in the way', () => {
        expect(swingDelta(tip, -60, 90, 0, 0, [])).toBe(150);
        expect(swingDelta(tip, 150, -150, 0, 0, [])).toBe(60);
        expect(swingDelta(tip, 30, 30, 0, 0, above)).toBe(0);
    });

    it('swings round underneath rather than over a pin in the way', () => {
        // -60 -> 90 the short way passes upright, through the pin above.
        expect(swingDelta(tip, -60, 90, 0, 0, above)).toBe(-210);
        expect(swingDelta(tip, 90, -60, 0, 0, above)).toBe(210);
    });

    it('works from an unwrapped angle', () => {
        expect(swingDelta(tip, 300, 90, 0, 0, above)).toBe(-210);
    });

    it('keeps the short way when the long way is no clearer', () => {
        const allRound = [0, 90, 180, 270].map((a) => ({
            x: PIN_TIP_TO_CENTRE * Math.sin(a * Math.PI / 180), y: -PIN_TIP_TO_CENTRE * Math.cos(a * Math.PI / 180),
        }));
        expect(swingDelta(tip, -60, 60, 0, 0, allRound)).toBe(120);
    });
});
