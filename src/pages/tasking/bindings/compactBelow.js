/**
 * Knockout binding: compactBelow
 *
 * Usage: data-bind="compactBelow: 540"
 *
 * Adds .is-compact to the element while it is narrower than the given width
 * in px. The lists sit in a resizable sidebar, so a viewport media query
 * can't tell when they're narrow, and making the list a CSS container would
 * clip the position:fixed dropdown menus inside its rows (see .pane-toolbar
 * in tasking.css).
 */
import ko from 'knockout';

ko.bindingHandlers.compactBelow = {
    init: function (element, valueAccessor) {
        if (typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(() => {
            const width = element.clientWidth;
            if (!width) return; // hidden (other tab): keep the last state
            element.classList.toggle('is-compact', width < ko.unwrap(valueAccessor()));
        });
        ro.observe(element);
        ko.utils.domNodeDisposal.addDisposeCallback(element, () => ro.disconnect());
    }
};
