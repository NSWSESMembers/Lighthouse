import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCatchUpScheduler } from './catchUp.js';

describe('createCatchUpScheduler', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const opts = { jitterMs: 5_000, minGapMs: 30_000 };

    it('runs once within the jitter window', () => {
        const run = vi.fn();
        createCatchUpScheduler(run, opts)();
        expect(run).not.toHaveBeenCalled();
        vi.advanceTimersByTime(5_000);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('coalesces requests made while one is pending', () => {
        const run = vi.fn();
        const request = createCatchUpScheduler(run, opts);
        request();
        request();
        request();
        vi.advanceTimersByTime(5_000);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('holds a later request back until the minimum gap has passed', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const run = vi.fn();
        const request = createCatchUpScheduler(run, opts);
        request();
        vi.advanceTimersByTime(0);
        expect(run).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(10_000);
        request();
        vi.advanceTimersByTime(19_999);
        expect(run).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(1);
        expect(run).toHaveBeenCalledTimes(2);
        vi.restoreAllMocks();
    });
});
