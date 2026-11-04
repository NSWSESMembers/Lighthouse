/**
 * Knockout binding: fastTooltip
 *
 * Usage: data-bind="fastTooltip: someTextValue"
 *
 * Shows a fixed-position tooltip instantly on hover (0.1s fade).
 * Works inside overflow:hidden / scroll containers.
 */
import ko from 'knockout';


let bubble = null;

function getBubble() {
    if (!bubble) {
        bubble = document.createElement('div');
        bubble.className = 'fast-tooltip-bubble';
        document.body.appendChild(bubble);
    }
    return bubble;
}

function showTip(el, text) {
    if (!text) return;
    const b = getBubble();
    b.textContent = text;
    b.classList.remove('show');

    const rect = el.getBoundingClientRect();
    // Position off-screen to measure without flicker
    b.style.left = '-9999px';
    b.style.top = '-9999px';
    b.style.display = 'block';

    // measure
    void b.offsetWidth;
    const bRect = b.getBoundingClientRect();

    let top = rect.top - bRect.height - 6;
    let left = rect.right - bRect.width;

    if (top < 4) top = rect.bottom + 6;
    if (left < 4) left = 4;
    if (left + bRect.width > window.innerWidth - 4) {
        left = window.innerWidth - bRect.width - 4;
    }

    b.style.top = top + 'px';
    b.style.left = left + 'px';
    // Force reflow then fade in via class (no inline opacity override)
    void b.offsetWidth;
    b.classList.add('show');
}

function hideTip() {
    if (bubble) {
        bubble.classList.remove('show');
        bubble.style.display = 'none';
    }
}

// On a touch screen a tap fires mouseenter, but mouseleave only comes with the
// next tap somewhere else, so the bubble would sit over the page. After a
// touch, hide it again on its own, and on the next touch.
const TOUCH_TIP_MS = 1500;
let lastPointerWasTouch = false;
let touchHideTimer = 0;
document.addEventListener('pointerdown', function (e) {
    lastPointerWasTouch = e.pointerType === 'touch';
    if (lastPointerWasTouch) hideTip();
}, true);

ko.bindingHandlers.fastTooltip = {
    init: function (element, valueAccessor) {
        element.addEventListener('mouseenter', function () {
            const text = ko.unwrap(valueAccessor());
            showTip(element, text);
            clearTimeout(touchHideTimer);
            if (lastPointerWasTouch) touchHideTimer = setTimeout(hideTip, TOUCH_TIP_MS);
        });
        element.addEventListener('mouseleave', function () {
            hideTip();
        });

        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            hideTip();
        });
    },
    update: function () {
        // text is read live on mouseenter, nothing to do here
    }
};
