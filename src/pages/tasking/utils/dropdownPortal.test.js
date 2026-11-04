// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { installDropdownPortal, dropdownHomeOf } from './dropdownPortal.js';

// A stand-in for bootstrap.Dropdown: getInstance(toggle) -> { _menu, update }.
function setup(menuClass = 'tasking-dropdown-menu') {
    document.body.innerHTML = `
        <div class="pane"><table><tr><td>
            <div class="dropdown" id="dd">
                <button id="toggle"></button>
                <div class="dropdown-menu ${menuClass}" id="menu"><span id="item"></span></div>
            </div>
        </td></tr></table></div>`;
    const toggle = document.getElementById('toggle');
    const menu = document.getElementById('menu');
    const update = vi.fn();
    const bootstrap = { Dropdown: { getInstance: (el) => (el === toggle ? { _menu: menu, update } : null) } };
    const open = () => {
        menu.classList.add('show');
        toggle.dispatchEvent(new Event('shown.bs.dropdown', { bubbles: true }));
    };
    return { toggle, menu, update, bootstrap, open };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

let uninstall = () => {};
afterEach(() => uninstall());

describe('installDropdownPortal', () => {
    it('lifts an opened fixed menu to <body>, re-places it, and puts it back where it was on close', async () => {
        const { menu, update, bootstrap, open } = setup();
        uninstall = installDropdownPortal(bootstrap);

        open();
        expect(menu.parentElement).toBe(document.body);
        expect(update).toHaveBeenCalled();
        // Items inside still know which dropdown they belong to.
        expect(dropdownHomeOf(document.getElementById('item'))).toBe(document.getElementById('dd'));

        // Keeps the in-place look: the pane's small-print rule and wrapping.
        expect(menu.classList.contains('lifted-from-pane')).toBe(true);
        expect(menu.style.whiteSpace).not.toBe('');

        menu.classList.remove('show'); // Bootstrap hide, or closeStatusDropdown()
        await flush();
        expect(menu.parentElement).toBe(document.getElementById('dd'));
        expect(menu.classList.contains('lifted-from-pane')).toBe(false);
        expect(menu.style.whiteSpace).toBe('');
        expect(menu.previousElementSibling.id).toBe('toggle');
        expect(document.getElementById('dd').childNodes.length).toBe(5); // no leftover placeholder
    });

    it('drops a lifted menu whose row went away while it was open', async () => {
        const { menu, bootstrap, open } = setup();
        uninstall = installDropdownPortal(bootstrap);
        open();
        document.querySelector('.pane').remove();
        menu.classList.remove('show');
        await flush();
        expect(menu.isConnected).toBe(false);
    });

    it('leaves other menus in place', () => {
        const other = setup('some-other-menu');
        uninstall = installDropdownPortal(other.bootstrap);
        other.open();
        expect(other.menu.parentElement.id).toBe('dd');
    });
});
