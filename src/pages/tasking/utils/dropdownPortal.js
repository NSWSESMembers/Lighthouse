/*
  Lift the position:fixed dropdown menus out of the scrolling team/incident
  lists while they're open.

  Those menus use position:fixed (see .tasking-dropdown-menu and friends in
  tasking.css) to escape the lists' overflow clipping. Desktop browsers let
  them out, but iPadOS WebKit still clips a fixed element to its scrolling
  ancestor, so a tasking status menu opened low in the Teams list was cut off
  at the list's edge instead of showing over the Incidents list.

  So the menu moves to <body> once it has opened -- after
  'show.bs.dropdown' listeners (sector refresh, holdHeight) have seen it in
  place -- and goes back as soon as it loses .show, whether Bootstrap closed it
  or code stripped the class (Tasking.closeStatusDropdown does). It does this
  in every browser, not just on iPads, so there's one code path to keep
  working; on desktop the menu looks and sits exactly where it did.
*/

export const LIFTED_MENUS = '.tasking-dropdown-menu, .jobstatusDropdown, .sectorDropdown, .job-taskteam-dropdown';

const HOME = Symbol('dropdownHome');

/** The .dropdown an element's menu belongs to, even while the menu is lifted. */
export function dropdownHomeOf(el) {
    const own = el.closest('.dropdown');
    if (own) return own;
    const menu = el.closest('.dropdown-menu');
    return (menu && menu[HOME]) || null;
}

/** @param {object} bootstrap  the Bootstrap 5 module (for Dropdown.getInstance) */
export function installDropdownPortal(bootstrap) {
    const lifted = new Map(); // menu -> { placeholder, observer }

    const putBack = (menu) => {
        const entry = lifted.get(menu);
        if (!entry) return;
        lifted.delete(menu);
        entry.observer.disconnect();
        // Its row may have gone (list refreshed) while it was open: drop it.
        if (entry.placeholder.isConnected) entry.placeholder.replaceWith(menu);
        else menu.remove();
        delete menu[HOME];
        menu.style.whiteSpace = '';
        menu.classList.remove('lifted-from-pane');
    };

    const onShown = (e) => {
        const toggle = e.target;
        const instance = bootstrap.Dropdown.getInstance(toggle);
        const menu = instance?._menu;
        if (!menu || !menu.matches(LIFTED_MENUS) || lifted.has(menu)) return;

        // The menu's own .dropdown: the task-team toggle sits outside it.
        menu[HOME] = menu.closest('.dropdown');
        // Keep it looking as it did in place: its line wrapping comes from its
        // table cell, and `.pane .small` styles its small print (tasking.css).
        menu.style.whiteSpace = getComputedStyle(menu).whiteSpace;
        menu.classList.toggle('lifted-from-pane', !!menu.closest('.pane'));
        const placeholder = document.createComment(' lifted dropdown menu ');
        menu.replaceWith(placeholder);
        document.body.appendChild(menu);

        const observer = new MutationObserver(() => {
            if (!menu.classList.contains('show')) putBack(menu);
        });
        observer.observe(menu, { attributes: true, attributeFilter: ['class'] });
        lifted.set(menu, { placeholder, observer });

        // Re-place it now it's out. forceUpdate is synchronous; Bootstrap's
        // update() is deferred, and a first placement computed inside a
        // transformed ancestor (a Leaflet popup) would otherwise stick.
        try {
            if (instance._popper?.forceUpdate) instance._popper.forceUpdate();
            else instance.update();
        } catch { /* popper already torn down */ }
    };

    document.addEventListener('shown.bs.dropdown', onShown);
    return () => {
        document.removeEventListener('shown.bs.dropdown', onShown);
        [...lifted.keys()].forEach(putBack);
    };
}
