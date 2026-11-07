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
        dormancy.onReturn = vi.fn();
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
        expect(dormancy.onReturn).not.toHaveBeenCalled();
        expect(dormancy.isDormant()).toBe(false);
    });

    it('stays dormant when shown again', () => {
        setVisibility('hidden');
        vi.advanceTimersByTime(5000);
        setVisibility('visible');
        expect(dormancy.onReturn).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(5000);
        expect(dormancy.isDormant()).toBe(true);
    });

    it('stops being dormant when reset', () => {
        setVisibility('hidden');
        vi.advanceTimersByTime(5000);
        setVisibility('visible');
        dormancy.reset();
        expect(dormancy.isDormant()).toBe(false);
    });

    it('still notices if the dormant timer never got to run', () => {
        // A frozen tab: time passes but its timers don't fire.
        const now = vi.fn(() => 0);
        const frozen = createTabDormancy({ doc, now, afterMs: 1000 });
        frozen.onReturn = vi.fn();
        setVisibility('hidden');
        now.mockReturnValue(5000);
        setVisibility('visible');
        expect(frozen.onReturn).toHaveBeenCalledTimes(1);
        expect(frozen.isDormant()).toBe(true);
    });
});
