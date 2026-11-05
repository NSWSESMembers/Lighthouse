/**
 * Knockout binding: fitInPane
 *
 * Usage: data-bind="fitInPane: true"
 *
 * Caps a scrolling list's height to the room left below it in the config
 * modal's pane (.config-panes), so a long list (Map > Layer order &
 * transparency) scrolls on its own instead of pushing the pane into a
 * scroll and its search box out of view. Re-measured whenever a collapse,
 * tab or modal finishes opening, and on window resize.
 */
import ko from 'knockout';

const MIN_HEIGHT = 160;
const GAP = 12; // breathing room above the pane's bottom edge

ko.bindingHandlers.fitInPane = {
    init: function (element) {
        const fit = () => {
            if (!element.offsetParent) return; // hidden: measure when it's shown
            const pane = element.closest('.config-panes');
            if (!pane) return;
            // Measure from the pane's top, so a scrolled pane doesn't skew it.
            const top = element.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
            const room = pane.clientHeight - top - GAP;
            element.style.maxHeight = `${Math.max(MIN_HEIGHT, Math.floor(room))}px`;
        };
        const events = ['shown.bs.collapse', 'shown.bs.tab', 'shown.bs.modal'];
        events.forEach(e => document.addEventListener(e, fit));
        window.addEventListener('resize', fit);

        ko.utils.domNodeDisposal.addDisposeCallback(element, () => {
            events.forEach(e => document.removeEventListener(e, fit));
            window.removeEventListener('resize', fit);
        });
    }
};
