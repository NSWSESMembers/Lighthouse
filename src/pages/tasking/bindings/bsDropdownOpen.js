/**
 * bsDropdownOpen – Knockout custom binding
 *
 * Bridges Bootstrap 5 dropdown show/hide events to a KO observable.
 * Apply to the parent element that contains the toggle button and the
 * `.dropdown-menu`.  The observable is set to `true` on `shown.bs.dropdown`
 * and `false` on `hidden.bs.dropdown`.
 *
 * Usage:
 *   <div data-bind="bsDropdownOpen: myObservable"> … </div>
 *
 * @module bindings/bsDropdownOpen
 */

var ko = require('knockout');

ko.bindingHandlers.bsDropdownOpen = {
    init(element, valueAccessor) {
        const obs = valueAccessor();

        const onShown  = () => obs(true);
        const onHidden = () => obs(false);

        element.addEventListener('shown.bs.dropdown',  onShown);
        element.addEventListener('hidden.bs.dropdown', onHidden);

        // Clean up listeners when the element is removed from the DOM
        ko.utils.domNodeDisposal.addDisposeCallback(element, () => {
            element.removeEventListener('shown.bs.dropdown',  onShown);
            element.removeEventListener('hidden.bs.dropdown', onHidden);
        });
    },
};
