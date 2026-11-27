/**
 * Knockout binding: holdToConfirm
 *
 * Usage: data-bind="click: clear, holdToConfirm: { action: clearAll, enabled: someObservable }"
 *
 * Pressing and holding the button (mouse, touch, pen, or Space) runs
 * `action` instead of the normal click. A short grace period keeps an
 * ordinary click from showing anything; after it a fill sweeps across the
 * button and the label counts down the seconds left. Releasing early, or
 * moving off the button, cancels. The click that follows a completed hold is
 * swallowed so the normal click handler doesn't undo it. Enter isn't
 * supported: holding it repeats the click.
 */
import ko from 'knockout';

export const HOLD_GRACE_MS = 300;
export const HOLD_MS = 1000;
const SLOP_PX = 12;
const DONE_FLASH_MS = 700;

ko.bindingHandlers.holdToConfirm = {
    init: function (element, valueAccessor) {
        const opts = valueAccessor() || {};
        const enabled = () => opts.enabled === undefined || !!ko.unwrap(opts.enabled);
        const graceMs = opts.graceMs ?? HOLD_GRACE_MS;
        const holdMs = opts.holdMs ?? HOLD_MS;

        let graceTimer = null;
        let doneTimer = null;
        let tickTimer = null;
        let flashTimer = null;
        let pointerId = null;
        let key = null;
        let savedHtml = null;
        let swallowClick = false;

        element.classList.add('hold-confirm');
        element.style.setProperty('--hold-ms', holdMs + 'ms');

        const showCountdown = (endsAt) => {
            const left = Math.max(1, Math.ceil((endsAt - Date.now()) / 1000));
            element.textContent = left + '…';
        };

        const restoreLabel = () => {
            if (savedHtml === null) return;
            element.innerHTML = savedHtml;
            element.style.minWidth = '';
            savedHtml = null;
        };

        const cancel = () => {
            clearTimeout(graceTimer);
            clearTimeout(doneTimer);
            clearInterval(tickTimer);
            graceTimer = doneTimer = tickTimer = null;
            if (pointerId !== null && element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
            pointerId = null;
            key = null;
            element.classList.remove('hold-arming');
            restoreLabel();
        };

        const complete = () => {
            cancel();
            // Until the button is let go (see onRelease).
            swallowClick = true;
            element.classList.add('hold-done');
            clearTimeout(flashTimer);
            flashTimer = setTimeout(() => element.classList.remove('hold-done'), DONE_FLASH_MS);
            try { navigator.vibrate?.(40); } catch { /* not supported */ }
            opts.action?.();
        };

        const start = () => {
            graceTimer = setTimeout(() => {
                graceTimer = null;
                const endsAt = Date.now() + holdMs;
                savedHtml = element.innerHTML;
                element.style.minWidth = element.offsetWidth + 'px';
                element.classList.add('hold-arming');
                showCountdown(endsAt);
                tickTimer = setInterval(() => showCountdown(endsAt), 100);
                doneTimer = setTimeout(complete, holdMs);
            }, graceMs);
        };

        const onPointerDown = (e) => {
            if (e.button !== 0 || !enabled() || element.disabled) return;
            cancel();
            pointerId = e.pointerId;
            element.setPointerCapture?.(pointerId);
            start();
        };
        const onPointerMove = (e) => {
            if (e.pointerId !== pointerId) return;
            const r = element.getBoundingClientRect();
            if (e.clientX < r.left - SLOP_PX || e.clientX > r.right + SLOP_PX ||
                e.clientY < r.top - SLOP_PX || e.clientY > r.bottom + SLOP_PX) cancel();
        };
        const onPointerEnd = (e) => { if (e.pointerId === pointerId) cancel(); };
        // The click (if any) fires straight after the release, before this timer.
        const onRelease = () => {
            if (swallowClick) setTimeout(() => { swallowClick = false; }, 50);
        };

        const onKeyDown = (e) => {
            if (e.repeat || e.key !== ' ' || !enabled() || element.disabled) return;
            cancel();
            key = e.key;
            start();
        };
        const onKeyUp = (e) => { if (e.key === key) cancel(); };

        // Capture phase, so it runs before knockout's click handler.
        const onClick = (e) => {
            if (!swallowClick) return;
            swallowClick = false;
            e.preventDefault();
            e.stopImmediatePropagation();
        };
        // A long press on touch otherwise opens the context menu.
        const onContextMenu = (e) => { if (pointerId !== null || swallowClick) e.preventDefault(); };

        element.addEventListener('pointerdown', onPointerDown);
        element.addEventListener('pointermove', onPointerMove);
        element.addEventListener('pointerup', onPointerEnd);
        element.addEventListener('pointercancel', onPointerEnd);
        element.addEventListener('lostpointercapture', onPointerEnd);
        element.addEventListener('keydown', onKeyDown);
        element.addEventListener('keyup', onKeyUp);
        element.addEventListener('blur', cancel);
        element.addEventListener('pointerup', onRelease);
        element.addEventListener('keyup', onRelease);
        element.addEventListener('click', onClick, true);
        element.addEventListener('contextmenu', onContextMenu);

        ko.utils.domNodeDisposal.addDisposeCallback(element, () => {
            cancel();
            clearTimeout(flashTimer);
            element.removeEventListener('pointerdown', onPointerDown);
            element.removeEventListener('pointermove', onPointerMove);
            element.removeEventListener('pointerup', onPointerEnd);
            element.removeEventListener('pointercancel', onPointerEnd);
            element.removeEventListener('lostpointercapture', onPointerEnd);
            element.removeEventListener('keydown', onKeyDown);
            element.removeEventListener('keyup', onKeyUp);
            element.removeEventListener('blur', cancel);
            element.removeEventListener('pointerup', onRelease);
            element.removeEventListener('keyup', onRelease);
            element.removeEventListener('click', onClick, true);
            element.removeEventListener('contextmenu', onContextMenu);
        });
    },
};
