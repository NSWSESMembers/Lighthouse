/**
 * Knockout binding: holdHeight
 *
 * Usage: data-bind="holdHeight: someObservable"
 *
 * While its Bootstrap dropdown is open, the element never gets shorter when
 * the observable changes (e.g. the tasking status menu switching pages): just
 * before each change its min-height is set to its current height. A menu that
 * opened upwards is anchored to its button by its bottom edge, so shrinking
 * would move its top -- and whatever the mouse was over -- away. Cleared each
 * time the dropdown opens.
 */
import ko from 'knockout';

ko.bindingHandlers.holdHeight = {
    init: function (element, valueAccessor) {
        const source = valueAccessor();
        if (!ko.isSubscribable(source)) return;

        const reset = () => { element.style.minHeight = ''; };
        let dropdown = null;

        const sub = source.subscribe(() => {
            // Looked up lazily: the template may not be in the document yet
            // when this binding initialises.
            if (!dropdown) {
                dropdown = element.closest('.dropdown');
                if (dropdown) dropdown.addEventListener('show.bs.dropdown', reset);
            }
            const h = element.offsetHeight;
            if (h > (parseFloat(element.style.minHeight) || 0)) {
                element.style.minHeight = h + 'px';
            }
        }, null, 'beforeChange');

        ko.utils.domNodeDisposal.addDisposeCallback(element, () => {
            sub.dispose();
            if (dropdown) dropdown.removeEventListener('show.bs.dropdown', reset);
        });
    }
};
