import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTabDormancy } from './tabDormancy.js';

describe('createTabDormancy', () => {
    let doc, dormancy;
    const setVisibility = (state) => {
        doc.visibilityState = state;
        doc.dispatchEvent(new Event('visibilitychange'));
    };

    beforeEach(() => {
        vi.useFakeTimers();
        doc = new EventTarget();
        doc.visibilityState = 'visible';
        dormancy = createTabDormancy({ doc, afterMs: 1000 });
        dormancy.onDormant = vi.fn();
        dormancy.onWake = vi.fn();
    });
    afterEach(() => vi.useRealTimers());

    it('goes dormant once hidden for the full time', () => {
        setVisibility('hidden');
        vi.advanceTimersByTime(999);
        expect(dormancy.isDormant()).toBe(false);
        expect(dormancy.onDormant).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(dormancy.isDormant()).toBe(true);
        expect(dormancy.onDormant).toHaveBeenCalledTimes(1);
    });

    it('changes nothing after a shorter hide', () => {
        setVisibility('hidden');
        vi.advanceTimersByTime(500);
        setVisibility('visible');
        vi.advanceTimersByTime(5000);
        expect(dormancy.onDormant).not.toHaveBeenCalled();
        expect(dormancy.onWake).not.toHaveBeenCalled();
        expect(dormancy.isDormant()).toBe(false);
    });

    it('wakes with the time away when shown again', () => {
        setVisibility('hidden');
        vi.advanceTimersByTime(5000);
        setVisibility('visible');
        expect(dormancy.onWake).toHaveBeenCalledWith(5000);
        expect(dormancy.isDormant()).toBe(false);
    });

    it('still wakes if the dormant timer never got to run', () => {
        // A frozen tab: time passes but its timers don't fire.
        const now = vi.fn(() => 0);
        const frozen = createTabDormancy({ doc, now, afterMs: 1000 });
        frozen.onWake = vi.fn();
        setVisibility('hidden');
        now.mockReturnValue(5000);
        setVisibility('visible');
        expect(frozen.onWake).toHaveBeenCalledWith(5000);
    });
});
