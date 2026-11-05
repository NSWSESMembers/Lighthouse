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
    const hide = vi.fn(() => menu.classList.remove('show'));
    const instance = { _menu: menu, _config: { autoClose: 'outside' }, update, hide };
    const bootstrap = { Dropdown: { getInstance: (el) => (el === toggle ? instance : null) } };
    const open = () => {
        menu.classList.add('show');
        toggle.dispatchEvent(new Event('shown.bs.dropdown', { bubbles: true }));
    };
    return { toggle, menu, update, hide, instance, bootstrap, open };
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

    it('closes on an outside click even when something stops it bubbling', async () => {
        const { menu, hide, bootstrap, open } = setup();
        document.body.insertAdjacentHTML('beforeend', '<button id="elsewhere"></button>');
        const elsewhere = document.getElementById('elsewhere');
        elsewhere.addEventListener('click', (e) => e.stopPropagation()); // Leaflet control, clickBubble: false
        uninstall = installDropdownPortal(bootstrap);
        open();

        document.getElementById('item').click(); // inside: stays open
        document.getElementById('toggle').click(); // toggle: Bootstrap's to handle
        expect(hide).not.toHaveBeenCalled();

        elsewhere.click();
        expect(hide).toHaveBeenCalledTimes(1);
        await flush();
        expect(menu.parentElement.id).toBe('dd');
    });

    it('leaves autoClose false/inside menus to Bootstrap', () => {
        const { hide, instance, bootstrap, open } = setup();
        instance._config.autoClose = false;
        uninstall = installDropdownPortal(bootstrap);
        open();
        document.body.click();
        expect(hide).not.toHaveBeenCalled();
    });

    it('drops a menu orphaned by its toggle going away on the next outside click', async () => {
        const { menu, bootstrap, open } = setup();
        uninstall = installDropdownPortal(bootstrap);
        open();
        document.querySelector('.pane').remove(); // team card collapsed
        menu.click(); // still usable while open
        expect(menu.isConnected).toBe(true);
        document.body.click();
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
