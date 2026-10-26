// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import ko from 'knockout';
import './holdHeight.js';

// jsdom has no layout, so give the element a settable offsetHeight.
function setup() {
    document.body.innerHTML = '<div class="dropdown"><div class="menu"><div id="frame"></div></div></div>';
    const frame = document.getElementById('frame');
    let height = 0;
    Object.defineProperty(frame, 'offsetHeight', { get: () => height });
    const page = ko.observable('status');
    ko.applyBindingsToNode(frame, { holdHeight: page });
    return { frame, page, setHeight: (h) => { height = h; } };
}

describe('holdHeight binding', () => {
    it('keeps the height from before each change as a minimum, never shrinking it', () => {
        const { frame, page, setHeight } = setup();
        setHeight(340);
        page('details');
        expect(frame.style.minHeight).toBe('340px');

        setHeight(180); // the shorter page, but min-height holds it at 340
        page('status');
        expect(frame.style.minHeight).toBe('340px');

        setHeight(400); // a taller page raises it
        page('correct');
        expect(frame.style.minHeight).toBe('400px');
    });

    it('clears when the dropdown opens again', () => {
        const { frame, page, setHeight } = setup();
        setHeight(340);
        page('details');
        frame.closest('.dropdown').dispatchEvent(new Event('show.bs.dropdown'));
        expect(frame.style.minHeight).toBe('');
    });
});
