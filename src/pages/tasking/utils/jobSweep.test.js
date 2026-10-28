import { describe, it, expect } from 'vitest';
import { selectJobsToDrop, SWEEP_GRACE_MS } from './jobSweep.js';

const job = (id) => ({ id });

describe('selectJobsToDrop', () => {
    it('drops a job only after it has been droppable for the grace period', () => {
        const a = job(1);
        const outSince = new Map();
        const keep = () => false;
        expect(selectJobsToDrop([a], { now: 0, outSince, keep })).toEqual([]);
        expect(selectJobsToDrop([a], { now: SWEEP_GRACE_MS - 1, outSince, keep })).toEqual([]);
        expect(selectJobsToDrop([a], { now: SWEEP_GRACE_MS, outSince, keep })).toEqual([a]);
        expect(outSince.has(a)).toBe(false);
    });

    it('never drops a job that is kept, and restarts its clock when it is kept again', () => {
        const a = job(1);
        const outSince = new Map();
        let kept = false;
        const keep = () => kept;
        selectJobsToDrop([a], { now: 0, outSince, keep });
        kept = true;
        expect(selectJobsToDrop([a], { now: SWEEP_GRACE_MS, outSince, keep })).toEqual([]);
        expect(outSince.has(a)).toBe(false);
        kept = false;
        expect(selectJobsToDrop([a], { now: SWEEP_GRACE_MS + 1, outSince, keep })).toEqual([]);
        expect(selectJobsToDrop([a], { now: 2 * SWEEP_GRACE_MS + 1, outSince, keep })).toEqual([a]);
    });

    it('forgets jobs that are no longer tracked', () => {
        const a = job(1), b = job(2);
        const outSince = new Map();
        const keep = () => false;
        selectJobsToDrop([a, b], { now: 0, outSince, keep });
        selectJobsToDrop([b], { now: 1, outSince, keep });
        expect([...outSince.keys()]).toEqual([b]);
    });

    it('decides per job', () => {
        const a = job(1), b = job(2);
        const outSince = new Map();
        const keep = (j) => j === b;
        selectJobsToDrop([a, b], { now: 0, outSince, keep, graceMs: 5 });
        expect(selectJobsToDrop([a, b], { now: 5, outSince, keep, graceMs: 5 })).toEqual([a]);
    });
});
