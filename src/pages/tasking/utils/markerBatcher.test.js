// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMarkerBatcher } from './markerBatcher.js';

function stubRaf() {
    const callbacks = [];
    vi.stubGlobal('requestAnimationFrame', (cb) => { callbacks.push(cb); return callbacks.length; });
    return { flush: () => { const cbs = callbacks.splice(0); cbs.forEach((cb) => cb()); } };
}

beforeEach(() => {
    vi.unstubAllGlobals();
});

describe('createMarkerBatcher', () => {
    it('does not call addFn/removeFn synchronously -- defers to the next animation frame', () => {
        const raf = stubRaf();
        const addFn = vi.fn();
        const batcher = createMarkerBatcher({ addFn, removeFn: vi.fn() });
        batcher.scheduleAdd({ id: () => 'a1' });
        expect(addFn).not.toHaveBeenCalled();
        raf.flush();
        expect(addFn).toHaveBeenCalledWith({ id: expect.any(Function) });
    });

    it('coalesces multiple scheduleAdd calls for the same id into a single addFn call', () => {
        const raf = stubRaf();
        const addFn = vi.fn();
        const batcher = createMarkerBatcher({ addFn, removeFn: vi.fn() });
        const item1 = { id: () => 'a1', v: 1 };
        const item2 = { id: () => 'a1', v: 2 };
        batcher.scheduleAdd(item1);
        batcher.scheduleAdd(item2);
        raf.flush();
        expect(addFn).toHaveBeenCalledTimes(1);
        expect(addFn).toHaveBeenCalledWith(item2); // latest wins
    });

    it('a scheduleRemove after a pending scheduleAdd for the same id cancels the add', () => {
        const raf = stubRaf();
        const addFn = vi.fn();
        const removeFn = vi.fn();
        const batcher = createMarkerBatcher({ addFn, removeFn });
        const item = { id: () => 'a1' };
        batcher.scheduleAdd(item);
        batcher.scheduleRemove(item);
        raf.flush();
        expect(addFn).not.toHaveBeenCalled();
        expect(removeFn).toHaveBeenCalledWith(item);
    });

    it('a scheduleAdd after a pending scheduleRemove for the same id cancels the remove', () => {
        const raf = stubRaf();
        const addFn = vi.fn();
        const removeFn = vi.fn();
        const batcher = createMarkerBatcher({ addFn, removeFn });
        const item = { id: () => 'a1' };
        batcher.scheduleRemove(item);
        batcher.scheduleAdd(item);
        raf.flush();
        expect(removeFn).not.toHaveBeenCalled();
        expect(addFn).toHaveBeenCalledWith(item);
    });

    it('flushes all removes before all adds', () => {
        const raf = stubRaf();
        const order = [];
        const batcher = createMarkerBatcher({
            addFn: (i) => order.push(`add:${i.id()}`),
            removeFn: (i) => order.push(`remove:${i.id()}`),
        });
        batcher.scheduleAdd({ id: () => 'a1' });
        batcher.scheduleRemove({ id: () => 'a2' });
        raf.flush();
        expect(order).toEqual(['remove:a2', 'add:a1']);
    });

    it('schedules only one animation frame across multiple calls in the same tick', () => {
        const rafSpy = vi.fn((cb) => { cb(); return 1; });
        vi.stubGlobal('requestAnimationFrame', rafSpy);
        const batcher = createMarkerBatcher({ addFn: vi.fn(), removeFn: vi.fn() });
        batcher.scheduleAdd({ id: () => 'a1' });
        batcher.scheduleAdd({ id: () => 'a2' });
        expect(rafSpy).toHaveBeenCalledTimes(1);
    });

    it('calls addFn/removeFn immediately (bypassing batching) for an item with no usable id', () => {
        vi.stubGlobal('requestAnimationFrame', vi.fn());
        const addFn = vi.fn();
        const removeFn = vi.fn();
        const batcher = createMarkerBatcher({ addFn, removeFn });
        batcher.scheduleAdd({ notAnId: true });
        batcher.scheduleRemove(null);
        expect(addFn).toHaveBeenCalledWith({ notAnId: true });
        expect(removeFn).toHaveBeenCalledWith(null);
    });

    it('supports a plain (non-function) id property', () => {
        const raf = stubRaf();
        const addFn = vi.fn();
        const batcher = createMarkerBatcher({ addFn, removeFn: vi.fn() });
        batcher.scheduleAdd({ id: 'plain-id' });
        raf.flush();
        expect(addFn).toHaveBeenCalledWith({ id: 'plain-id' });
    });

    it('clears pending maps after a flush so a later schedule starts fresh', () => {
        const raf = stubRaf();
        const addFn = vi.fn();
        const batcher = createMarkerBatcher({ addFn, removeFn: vi.fn() });
        batcher.scheduleAdd({ id: () => 'a1' });
        raf.flush();
        batcher.scheduleAdd({ id: () => 'a1' });
        raf.flush();
        expect(addFn).toHaveBeenCalledTimes(2);
    });
});
