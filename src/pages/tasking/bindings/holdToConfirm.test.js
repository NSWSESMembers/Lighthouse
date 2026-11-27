// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ko from 'knockout';
import { HOLD_GRACE_MS, HOLD_MS } from './holdToConfirm.js';

// jsdom has no PointerEvent, so dispatch plain events with the fields used.
function pointer(el, type, props = {}) {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, { pointerId: 1, button: 0, clientX: 5, clientY: 5, ...props });
    el.dispatchEvent(e);
}
function key(el, type, k, props = {}) {
    el.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, ...props }));
}

function setup(enabled) {
    document.body.innerHTML = '<button id="b">Clear</button>';
    const btn = document.getElementById('b');
    btn.getBoundingClientRect = () => ({ left: 0, top: 0, right: 60, bottom: 30 });
    const vm = { click: vi.fn(), action: vi.fn(), enabled };
    ko.applyBindingsToNode(btn, { click: vm.click, holdToConfirm: { action: vm.action, enabled: vm.enabled } });
    // Click after the release, as a browser would.
    const release = () => { pointer(btn, 'pointerup'); btn.click(); };
    return { btn, vm, release };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('holdToConfirm binding', () => {
    it('a quick click just clicks, with no countdown shown', () => {
        const { btn, vm, release } = setup();
        pointer(btn, 'pointerdown');
        vi.advanceTimersByTime(HOLD_GRACE_MS - 50);
        release();
        expect(btn.classList.contains('hold-arming')).toBe(false);
        expect(btn.textContent).toBe('Clear');
        expect(vm.click).toHaveBeenCalledTimes(1);
        expect(vm.action).not.toHaveBeenCalled();
    });

    it('holding counts down, runs the action, and swallows the click on release', () => {
        const { btn, vm, release } = setup();
        pointer(btn, 'pointerdown');
        vi.advanceTimersByTime(HOLD_GRACE_MS + 10);
        expect(btn.classList.contains('hold-arming')).toBe(true);
        expect(btn.textContent).toBe('1…');
        vi.advanceTimersByTime(HOLD_MS);
        expect(vm.action).toHaveBeenCalledTimes(1);
        expect(btn.textContent).toBe('Clear');
        expect(btn.classList.contains('hold-done')).toBe(true);

        vi.advanceTimersByTime(3000); // still held long after it finished
        release();
        expect(vm.click).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        btn.click(); // and the next ordinary click works again
        expect(vm.click).toHaveBeenCalledTimes(1);
    });

    it('letting go part way cancels', () => {
        const { btn, vm, release } = setup();
        pointer(btn, 'pointerdown');
        vi.advanceTimersByTime(HOLD_GRACE_MS + HOLD_MS / 2);
        release();
        vi.advanceTimersByTime(HOLD_MS);
        expect(vm.action).not.toHaveBeenCalled();
        expect(btn.textContent).toBe('Clear');
        expect(btn.classList.contains('hold-arming')).toBe(false);
    });

    it('moving off the button cancels', () => {
        const { btn, vm } = setup();
        pointer(btn, 'pointerdown');
        vi.advanceTimersByTime(HOLD_GRACE_MS + HOLD_MS / 2);
        pointer(btn, 'pointermove', { clientX: 200 });
        vi.advanceTimersByTime(HOLD_MS);
        expect(vm.action).not.toHaveBeenCalled();
    });

    it('holding Space works too', () => {
        const { btn, vm } = setup();
        key(btn, 'keydown', ' ');
        key(btn, 'keydown', ' ', { repeat: true });
        vi.advanceTimersByTime(HOLD_GRACE_MS + HOLD_MS + 10);
        expect(vm.action).toHaveBeenCalledTimes(1);
        key(btn, 'keyup', ' ');
        btn.click();
        expect(vm.click).not.toHaveBeenCalled();
    });

    it('does nothing while not enabled', () => {
        const { btn, vm } = setup(ko.observable(false));
        pointer(btn, 'pointerdown');
        vi.advanceTimersByTime(HOLD_GRACE_MS + HOLD_MS + 10);
        expect(vm.action).not.toHaveBeenCalled();
    });
});
