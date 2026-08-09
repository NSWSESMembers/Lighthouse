/* eslint-disable @typescript-eslint/no-this-alias */
import ko from 'knockout';

import * as bootstrap from 'bootstrap5'; // Modal, Tooltip, etc.
import { Enum } from '../utils/enum.js';
import {
    createCollabLayer, deleteCollabLayer, updateCollabLayerModerators, updateCollabLayerPermissions,
    updateCollabLayerAttachment,
    refreshSubscribedLayers, searchLayersForHq, subscribeToLayer, unsubscribeFromLayer,
} from '../mapLayers/collabLayer.js';



const FUNCTION_URL = "https://lambda.lighthouse-extension.com/lad_v2/share";

/**
 * Reusable search-and-pick-multiple-members widget backing a layer's
 * moderator list -- used both for the "new layer" form and, later, for
 * editing an existing layer's moderators per row (only the layer creator
 * can, mirroring the server-side check in updateLayerModerators.js).
 * Mirrors the recipient search/picker pattern in SMSTeamModalVM.js.
 *
 * Each picked entry is `{ id, name }`, `id` being the Beacon member id
 * (Username) -- the same identity space as getMemberId()/createdByMemberId
 * (see mapLayers/collabLayer.js's permissions section for why), resolved
 * via `searchMembers` (Config.js's deps.searchMembers ->
 * BeaconClient.users.search) rather than the PersonId space
 * resolvePersonName()/getSimplePerson() use elsewhere on this page.
 */
function makeModeratorPicker(searchMembers, initial = []) {
    const picker = {};
    picker.moderators = ko.observableArray(initial.map(m => ({ ...m })));
    picker.searchQuery = ko.observable('');
    picker.searchResults = ko.observableArray([]);
    picker.dropdownOpen = ko.observable(false);
    picker.loading = ko.observable(false);
    picker.hasFocus = ko.observable(false);

    let searchTimer = null;

    picker.clearSearch = () => {
        picker.searchQuery('');
        picker.searchResults([]);
        picker.dropdownOpen(false);
    };
    picker.closeDropdown = () => {
        // Delay lets a click on a dropdown item fire before it's hidden.
        setTimeout(() => picker.dropdownOpen(false), 150);
    };
    picker.onSearchKeydown = (_vm, e) => {
        if (e.key === 'Escape') { picker.clearSearch(); return true; }
        if (e.key === 'Enter') {
            const first = picker.searchResults()[0];
            if (first) picker.addFromSearch(first);
            return false;
        }
        return true;
    };
    picker.runSearch = async () => {
        const q = (picker.searchQuery() || '').trim();
        if (q.length < 2) {
            picker.searchResults([]);
            picker.dropdownOpen(false);
            return;
        }
        // Opens immediately (loading state) rather than waiting for the
        // response and gating on hasFocus() at that point -- matches the
        // proven locationSearch pattern elsewhere in this file (self.query's
        // subscribe), which found that fragile: a focus/blur timing quirk
        // could leave a real, non-empty result list stuck hidden (reported
        // as "the HQ picker doesn't drop down when there's only 1 result",
        // same bug in every picker built from this same shape).
        picker.searchResults([]);
        picker.dropdownOpen(true);
        picker.loading(true);
        try {
            const rows = await searchMembers(q);
            // Username is required -- it's the member-id space moderator
            // checks are authorized against (see collabLayer.js's
            // permissions section), so a result without one can't actually
            // be added as a moderator. Disabled accounts are still shown
            // (just filtering them silently made real results disappear
            // when a Disabled flag was set on training/test accounts).
            const cleaned = (rows || [])
                .filter(r => r.Username)
                .map(r => {
                    const entity = r.Entity ? String(r.Entity).trim() : '';
                    return {
                        id: String(r.Username),
                        name: [r.Firstname, r.Lastname].filter(Boolean).join(' ') || String(r.Username),
                        // Unit name alongside the member number disambiguates
                        // same-named members across different units.
                        detail: entity ? `${entity} · ${r.Username}` : String(r.Username),
                    };
                });
            picker.searchResults(cleaned);
        } catch (err) {
            console.error('Member search failed:', err);
            picker.searchResults([]);
        } finally {
            picker.loading(false);
        }
    };
    picker.searchQuery.subscribe(() => {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(picker.runSearch, 250);
    });
    picker.addFromSearch = (result) => {
        if (!result) return;
        if (!picker.moderators().some(m => m.id === result.id)) {
            picker.moderators.push({ id: result.id, name: result.name });
        }
        picker.clearSearch();
    };
    picker.removeModerator = (moderator) => {
        picker.moderators.remove(m => m.id === moderator.id);
    };
    /** Discards any in-progress edits, restoring the picker to `next`. */
    picker.reset = (next = []) => {
        picker.moderators(next.map(m => ({ ...m })));
        picker.clearSearch();
    };
    return picker;
}

/**
 * Single-select counterpart to makeModeratorPicker, backing a layer's
 * "attach to event" field (see createCollabLayer's `event` param, and
 * updateCollabLayerAttachment for changing it later). Same search/debounce
 * shape, but holds at most one picked `{id, name, identifier}` rather than
 * a list.
 */
function makeEventPicker(searchEvents, initial = null) {
    const picker = {};
    picker.selected = ko.observable(initial ? { ...initial } : null);
    picker.searchQuery = ko.observable('');
    picker.searchResults = ko.observableArray([]);
    picker.dropdownOpen = ko.observable(false);
    picker.loading = ko.observable(false);
    picker.hasFocus = ko.observable(false);
    // Precomputed (rather than a ternary in the data-bind attribute)
    // because knockout-secure-binding's expression grammar doesn't support
    // the conditional (?:) operator. Shows the identifier alongside the
    // name (e.g. "6/1718 — Flood response") rather than name alone, since
    // the name is often generic (see the create-layer form's chip and
    // -- once the identifier is round-tripped through the layer object,
    // see createLayer.js's eventIdentifier -- the layer list's own badge).
    picker.selectedLabel = ko.pureComputed(() => {
        const s = picker.selected();
        if (!s) return '';
        return s.identifier ? `${s.identifier} — ${s.name}` : s.name;
    });

    let searchTimer = null;

    picker.clearSearch = () => {
        picker.searchQuery('');
        picker.searchResults([]);
        picker.dropdownOpen(false);
    };
    picker.closeDropdown = () => {
        setTimeout(() => picker.dropdownOpen(false), 150);
    };
    picker.onSearchKeydown = (_vm, e) => {
        if (e.key === 'Escape') { picker.clearSearch(); return true; }
        if (e.key === 'Enter') {
            const first = picker.searchResults()[0];
            if (first) picker.selectFromSearch(first);
            return false;
        }
        return true;
    };
    picker.runSearch = async () => {
        const q = (picker.searchQuery() || '').trim();
        if (q.length < 2) {
            picker.searchResults([]);
            picker.dropdownOpen(false);
            return;
        }
        // Opens immediately (loading state) rather than waiting for the
        // response and gating on hasFocus() at that point -- see
        // makeModeratorPicker above for why (same bug, same fix, shared
        // across every picker built from this shape).
        picker.searchResults([]);
        picker.dropdownOpen(true);
        picker.loading(true);
        try {
            const rows = await searchEvents(q);
            const cleaned = (rows || [])
                .filter(r => r.Id != null)
                .map(r => ({
                    id: String(r.Id),
                    name: r.Name || `Event ${r.Id}`,
                    identifier: r.Identifier || '',
                }));
            picker.searchResults(cleaned);
        } catch (err) {
            console.error('Event search failed:', err);
            picker.searchResults([]);
        } finally {
            picker.loading(false);
        }
    };
    picker.searchQuery.subscribe(() => {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(picker.runSearch, 250);
    });
    picker.selectFromSearch = (result) => {
        if (!result) return;
        picker.selected(result);
        picker.clearSearch();
    };
    picker.clearSelection = () => picker.selected(null);
    /** Discards any in-progress edits, restoring the picker to `next`. */
    picker.reset = (next = null) => {
        picker.selected(next ? { ...next } : null);
        picker.clearSearch();
    };
    return picker;
}

/**
 * Single-select entity picker scoped to Headquarters-type entities, backing
 * both a layer's required HQ attachment and the layer list's HQ filter
 * (Config.js). Same search/debounce shape as makeEventPicker, but searches
 * Beacon entities (deps.entitiesSearch, i.e. BeaconClient.entities.search)
 * rather than events.
 *
 * Filtered to results carrying a HeadquartersStatusTypeId -- confirmed
 * against a live Entities/Search response as the actual "this entity is an
 * HQ" signal (a real HQ came back with EntityTypeId: 2, e.g. a Zone HQ
 * under State Headquarters' EntityTypeId: 1 -- EntityTypeId varies by
 * level in the org hierarchy and is *not* a reliable "is this an HQ" check
 * on its own, unlike HeadquartersStatusTypeId which only ever appears on
 * HQ-type entities).
 */
function makeHqPicker(searchEntities, initial = null) {
    const picker = {};
    picker.selected = ko.observable(initial ? { ...initial } : null);
    picker.searchQuery = ko.observable('');
    picker.searchResults = ko.observableArray([]);
    picker.dropdownOpen = ko.observable(false);
    picker.loading = ko.observable(false);
    picker.hasFocus = ko.observable(false);

    let searchTimer = null;

    picker.clearSearch = () => {
        picker.searchQuery('');
        picker.searchResults([]);
        picker.dropdownOpen(false);
    };
    picker.closeDropdown = () => {
        setTimeout(() => picker.dropdownOpen(false), 150);
    };
    picker.onSearchKeydown = (_vm, e) => {
        if (e.key === 'Escape') { picker.clearSearch(); return true; }
        if (e.key === 'Enter') {
            const first = picker.searchResults()[0];
            if (first) picker.selectFromSearch(first);
            return false;
        }
        return true;
    };
    picker.runSearch = async () => {
        const q = (picker.searchQuery() || '').trim();
        if (q.length < 2) {
            picker.searchResults([]);
            picker.dropdownOpen(false);
            return;
        }
        // Opens immediately (loading state) rather than waiting for the
        // response and gating on hasFocus() at that point -- see
        // makeModeratorPicker above for why (same bug, same fix, shared
        // across every picker built from this shape).
        picker.searchResults([]);
        picker.dropdownOpen(true);
        picker.loading(true);
        try {
            const rows = await searchEntities(q);
            const cleaned = (rows || [])
                .filter(r => r.Id != null && r.HeadquartersStatusTypeId != null)
                .map(r => ({ id: String(r.Id), name: r.Name || `HQ ${r.Id}` }));
            picker.searchResults(cleaned);
        } catch (err) {
            console.error('HQ search failed:', err);
            picker.searchResults([]);
        } finally {
            picker.loading(false);
        }
    };
    picker.searchQuery.subscribe(() => {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(picker.runSearch, 250);
    });
    picker.selectFromSearch = (result) => {
        if (!result) return;
        picker.selected(result);
        picker.clearSearch();
    };
    picker.clearSelection = () => picker.selected(null);
    /** Discards any in-progress edits, restoring the picker to `next`. */
    picker.reset = (next = null) => {
        picker.selected(next ? { ...next } : null);
        picker.clearSearch();
    };
    return picker;
}



export function ConfigVM(root, deps) {
    const self = this;

    // Exposed publicly so code holding a ConfigVM reference (e.g.
    // InstantTaskViewModel's `config`) can get the current Beacon token
    // without its own deps plumbing.
    self.getToken = deps.getToken;

    const LAYOUT_PRESETS = [
        'map-right-teams-top',
        'map-right-tasking-top',
        'map-left-teams-top',
        'map-left-tasking-top',
        'map-right-teams-only',
        'map-right-tasking-only',
        'map-left-teams-only',
        'map-left-tasking-only',
        'map-only'
    ];
    const DEFAULT_LAYOUT_PRESET = 'map-right-teams-top';
    const normalizeLayoutPreset = (value) => {
        const key = String(value || '').trim();
        return LAYOUT_PRESETS.includes(key) ? key : DEFAULT_LAYOUT_PRESET;
    };
    const applyLayoutPresetClass = (preset) => {
        const appEl = document.querySelector('.app');
        if (!appEl) return;

        LAYOUT_PRESETS.forEach(layout => appEl.classList.remove(`layout-${layout}`));
        appEl.classList.add(`layout-${preset}`);

        localStorage.setItem('lh.layoutPreset', preset);
        window.dispatchEvent(new CustomEvent('lh:layoutPresetChanged', { detail: { preset } }));
    };

    // UI state
    self.query = ko.observable('');
    self.results = ko.observableArray([]);
    self.searching = ko.observable(false);
    self.dropdownOpen = ko.observable(false);
    self.inputHasFocus = ko.observable(false);

    // Share / load shared config state
    self.shareId = ko.observable('');          // last successful share key
    self.shareError = ko.observable('');       // error message (if any)
    self.sharing = ko.observable(false);       // POST in progress
    self.loadingShared = ko.observable(false); // GET in progress
    self.shareKeyInput = ko.observable('');    // bound to header input
    self.loadExpanded = ko.observable(false);

    // Selected location filters
    self.teamFilters = ko.observableArray([]);     // [{id, name, entityType}]
    self.incidentFilters = ko.observableArray([]); // [{id, name, entityType}]
    self.allowedIncidentTypeIds = ko.pureComputed(() =>
        new Set(self.incidentTypeFilter()
            .map(t => Enum.IncidentType[t]?.Id)
            .filter(Boolean))
    );

    //Sectors
    self.sectorFilters = ko.observableArray([]);   // [{id, name}]
    self.includeIncidentsWithoutSector = ko.observable(true);
    self.applySectorsToIncidents = ko.observable(false);
    self.applySectorsToTeams = ko.observable(false);

    //Map layer order

    self.paneDefs = [
        { id: 'pane-tippy-top', name: 'Incident markers' },
        { id: 'pane-collab', name: 'Collaborative layer markers' },
        { id: 'pane-top', name: 'Asset markers' },
        { id: 'pane-middle', name: 'Map overlay markers & labels' },
        { id: 'pane-lowest', name: 'Map overlay polygons & drawings' }
    ];

    // UI list (objects so bindings are property-only)
    self.paneOrder = ko.observableArray(self.paneDefs.map(p => ({ id: p.id, name: p.name })));

    self.rebuildPaneOrderFromIds = function (ids) {
        const byId = new Map(self.paneDefs.map(p => [p.id, p]));
        const list = (ids || [])
            .map(id => byId.get(id))
            .filter(Boolean)
            .map(p => ({ id: p.id, name: p.name }));

        // Ensure all panes exist. Panes missing from a saved order (e.g. one
        // introduced after the config was last saved) are inserted at their
        // default position relative to paneDefs, rather than always at the
        // bottom, so a newly-added pane keeps its intended default stacking.
        self.paneDefs.forEach((p, defIdx) => {
            if (list.some(x => x.id === p.id)) return;
            const nextKnownDef = self.paneDefs.slice(defIdx + 1).find(d => list.some(x => x.id === d.id));
            const insertAt = nextKnownDef ? list.findIndex(x => x.id === nextKnownDef.id) : list.length;
            list.splice(insertAt, 0, { id: p.id, name: p.name });
        });

        self.paneOrder(list);
    }

    // Other settings
    self.refreshInterval = ko.observable(60);
    // Guard for reckless refresh interval changes
    let lastRefreshInterval = self.refreshInterval();
    let suppressRecklessModal = false;
    self.refreshInterval.subscribe(function(newVal) {
        if (suppressRecklessModal) {
            lastRefreshInterval = newVal;
            return;
        }
        // Only trigger if the value is being changed to something different
        if (Number(newVal) !== Number(lastRefreshInterval)) {
            showRecklessModal({
                onConfirm: () => {
                    lastRefreshInterval = newVal;
                },
                onCancel: () => {
                    // Revert to previous value
                    suppressRecklessModal = true;
                    self.refreshInterval(lastRefreshInterval);
                    suppressRecklessModal = false;
                }
            });
        }
    });

    // Modal logic for reckless confirmation
    function showRecklessModal({ onConfirm, onCancel }) {
        // Create modal HTML if not present
        let modal = document.getElementById('recklessModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'recklessModal';
            modal.className = 'modal fade';
            modal.tabIndex = -1;
            modal.innerHTML = `
                <div class="modal-dialog modal-dialog-centered">
                  <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                      <h5 class="modal-title">Are you sure?</h5>
                      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                      <p>Changing the refresh interval can have unintended consequences. To proceed, type <b>reckless</b> below and press Confirm.</p>
                      <input id="recklessInput" type="text" class="form-control" placeholder="Type 'reckless' to confirm">
                      <div id="recklessError" class="text-danger mt-2" style="display:none;">You must type 'reckless' to confirm.</div>
                    </div>
                    <div class="modal-footer">
                      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" id="recklessCancel">Cancel</button>
                      <button type="button" class="btn btn-danger" id="recklessConfirm">Confirm</button>
                    </div>
                  </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        const bsModal = bootstrap.Modal.getOrCreateInstance(modal);
        bsModal.show();

        // Reset input and error
        const input = modal.querySelector('#recklessInput');
        const error = modal.querySelector('#recklessError');
        input.value = '';
        error.style.display = 'none';
        input.focus();

        // Remove previous listeners
        const confirmBtn = modal.querySelector('#recklessConfirm');
        const cancelBtn = modal.querySelector('#recklessCancel');
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;

        confirmBtn.onclick = function() {
            if (input.value.trim().toLowerCase() === 'reckless') {
                bsModal.hide();
                onConfirm && onConfirm();
            } else {
                error.style.display = '';
                input.focus();
            }
        };
        cancelBtn.onclick = function() {
            bsModal.hide();
            onCancel && onCancel();
        };
        // Also handle modal close (X button)
        modal.querySelector('.btn-close').onclick = function() {
            bsModal.hide();
            onCancel && onCancel();
        };
    }
    // ── Collaborative map layers ──
    //
    // Two independent concerns, deliberately kept apart rather than merged
    // into one HQ-scoped list-with-a-view-toggle (the earlier design here,
    // which made a layer impossible to find/unsubscribe from once its HQ
    // fell outside whatever filter happened to be selected):
    //   - "My layers" (self.collabLayers/collabLayerRows below) -- every
    //     layer this user is *subscribed* to (see collabLayerSync.js's
    //     localStorage-backed subscription helpers; subscribing is a
    //     client preference, not org data). Always lists every
    //     subscription regardless of HQ, so managing/unsubscribing from
    //     one never requires knowing which HQ it came from. You get here
    //     either by creating a layer (auto-subscribes you) or by
    //     subscribing to one found via "Find a layer" below.
    //   - "Find a layer" (self.discoverHqPicker/discoverRows below) --
    //     search one HQ at a time to discover layers to subscribe to. Pure
    //     browse/discovery; never touches My layers except via an explicit
    //     Subscribe click.
    // Whether a subscribed layer is actually drawn on the map is the map's
    // own Layers control's job entirely (LayersDrawer, main.js) -- this
    // panel has no View/show-hide toggle of its own anymore. The one
    // exception: creating a layer auto-shows it (see collabLayer.js's
    // createCollabLayer) since whoever just made one almost certainly
    // wants to see it immediately.
    self.collabLayers = root.mapVM?.collabLayers || ko.observableArray([]);
    // The whole "create a layer" flow (name, HQ, advanced options) is
    // collapsed behind a single "+ New layer" toggle by default -- it's a
    // lot of controls (mandatory HQ, optional event, 3 permission modes,
    // moderators) to have permanently on-screen above what's usually the
    // more-often-used layer list below.
    self.showCreateLayerForm = ko.observable(false);
    self.toggleCreateLayerForm = () => self.showCreateLayerForm(!self.showCreateLayerForm());
    self.newLayerName = ko.observable('');
    // Every layer must belong to an HQ -- defaults to whatever HQ this
    // Lighthouse instance was launched for (?hq=<entity id>, resolved below
    // into self.defaultHq), but can be changed via search before creating.
    // Required (unlike the event picker below), enforced both here
    // (createCollabLayer) and server-side (createLayer.js).
    self.newLayerHqPicker = makeHqPicker(deps.entitiesSearch);
    // Optional Beacon event this layer relates to -- purely display
    // metadata (like createdBy), fixed at creation with no later
    // "attach/detach event" flow (unlike the permission modes below, which
    // -- like the moderator list -- can be changed later).
    self.newLayerEventPicker = makeEventPicker(deps.searchEvents);
    // Each mode defaults to 'anyone' here at creation time, but -- like the
    // moderator list -- can be changed later by the creator or a current
    // moderator, via each row's own "Manage permissions" control in
    // collabLayerRows below (see mapLayers/collabLayer.js's
    // updateCollabLayerPermissions). Each backed by a 3-way radio group in
    // tasking.html: 'anyone' | 'creator' | 'moderators', all following the
    // same "Anyone can ___" / "Only I can ___" / "Moderators can ___" shape
    // for a consistent mental model across the three permissions. The
    // moderator *list* itself is edited separately -- see
    // newLayerModeratorPicker below and each row's own moderatorPicker in
    // collabLayerRows.
    self.newLayerMarkerMode = ko.observable('anyone'); // who can add/edit/delete markers
    self.newLayerDeleteMode = ko.observable('anyone'); // who can delete the layer itself
    self.newLayerCommentMode = ko.observable('anyone'); // who can comment on markers
    self.newLayerModeratorPicker = makeModeratorPicker(deps.searchMembers);
    // Shown only once at least one permission above is set to 'moderators'
    // -- the moderator list is meaningless (and hidden) otherwise.
    self.showNewLayerModeratorPicker = ko.pureComputed(() =>
        self.newLayerMarkerMode() === 'moderators' ||
        self.newLayerDeleteMode() === 'moderators' ||
        self.newLayerCommentMode() === 'moderators');
    self.creatingCollabLayer = ko.observable(false);
    self.collabLayerError = ko.observable('');
    self.collabLayerSearch = ko.observable(''); // filters "My layers" by name -- mainly useful once you've subscribed to a lot of them
    self.refreshingCollabLayers = ko.observable(false);
    self.deletingCollabLayerId = ko.observable(null); // id of the row currently mid-delete, if any

    // The row currently being edited in the standalone #collabPermissionsModal
    // (tasking.html), or null when it's closed. A single shared observable
    // (rather than a per-row "editing" flag rendered inline) so editing
    // permissions doesn't nest one scroll area inside another -- the row
    // list this modal is opened from is itself a small scrolling box
    // (.collab-layer-list-scroll), and an expanding-in-place panel there
    // forced a scrollbar-within-a-scrollbar. `with: config.permissionsModalRow`
    // in the modal's markup means its contents simply don't exist in the DOM
    // while this is null.
    self.permissionsModalRow = ko.observable(null);
    self.openPermissionsModal = (row) => {
        row.permissionsError('');
        row.editMarkerMode(row.markerMode);
        row.editDeleteMode(row.deleteMode);
        row.editCommentMode(row.commentMode);
        row.hqEditPicker?.reset(row.hqId ? { id: row.hqId, name: row.hqName } : null);
        row.eventEditPicker?.reset(row.eventId ? { id: row.eventId, name: row.eventName, identifier: row.eventIdentifier } : null);
        row.moderatorPicker?.reset(row.moderators);
        self.permissionsModalRow(row);
        const modalEl = document.getElementById('collabPermissionsModal');
        if (!modalEl) return;
        // Attached lazily on first open (rather than at Config() construction
        // time) since that's the first point this element is guaranteed to
        // exist -- guarded so a second open doesn't stack a duplicate
        // listener. Clears permissionsModalRow on every close, however it
        // was triggered (Save, Cancel, the X button, backdrop click, Esc),
        // so a row's draft state doesn't leak into the next layer opened.
        if (!modalEl.dataset.permissionsListenerAttached) {
            modalEl.dataset.permissionsListenerAttached = 'true';
            modalEl.addEventListener('hidden.bs.modal', () => self.permissionsModalRow(null));
        }
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    };

    // ── Find a layer (discover/subscribe) ──
    // Collapsed behind its own toggle by default, same reasoning as
    // showCreateLayerForm above.
    self.showDiscoverForm = ko.observable(false);
    self.toggleDiscoverForm = () => {
        self.showDiscoverForm(!self.showDiscoverForm());
        // Fetch on first open (rather than requiring a search/HQ pick
        // first) so opening this immediately shows something -- no HQ
        // picked means "all HQs", not "nothing", see runDiscoverSearch.
        if (self.showDiscoverForm() && self.discoverResults().length === 0 && !self.discoverLoading()) {
            self.runDiscoverSearch();
        }
    };
    // Browses one HQ's layers at a time to find something to subscribe to
    // -- deliberately not the same picker as newLayerHqPicker above (that
    // one's "what HQ does my new layer belong to", this one's "what HQ am
    // I browsing"), even though both default to the same launch HQ.
    self.discoverHqPicker = makeHqPicker(deps.entitiesSearch);
    self.discoverSearch = ko.observable(''); // filters the picked HQ's results by name
    self.discoverLoading = ko.observable(false);
    self.discoverResults = ko.observableArray([]); // raw layer objects for the picked HQ
    self.discoverError = ko.observable('');

    // Resolves ?hq=<entity id> (deps.defaultHqId) once at startup and seeds
    // both HQ pickers below with it -- the "new layer" picker so creating a
    // layer defaults to this HQ, the "Find a layer" picker so discovery
    // defaults to browsing this HQ's layers. Kept separately (self.defaultHq)
    // so createCollabLayer can reset newLayerHqPicker back to it after each
    // creation instead of clearing it to nothing (users creating several
    // layers in a row are almost always doing it for the same HQ).
    self.defaultHq = ko.observable(null);
    if (deps.defaultHqId) {
        Promise.resolve(deps.entity(deps.defaultHqId)).then(entity => {
            if (!entity?.Id) return;
            const hq = { id: String(entity.Id), name: entity.Name || String(entity.Id) };
            self.defaultHq(hq);
            self.newLayerHqPicker.reset(hq);
            self.discoverHqPicker.reset(hq);
        }).catch(err => console.warn('Failed to resolve default HQ:', err));
    }

    function relativeTime(iso) {
        if (!iso) return 'never';
        const ms = Date.now() - new Date(iso).getTime();
        if (!Number.isFinite(ms) || ms < 0) return 'just now';
        const mins = Math.round(ms / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.round(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.round(hrs / 24)}d ago`;
    }

    // Layers created before the moderators feature only carry the old
    // readOnly / allowDeleteByOthers / disableComments booleans and no mode
    // fields -- derive the equivalent mode so old layers display and behave
    // the same as before (mirrors lambda/map-layers-v2/lib/permissions.js
    // and collabLayer.js's effective*Mode() helpers, which every
    // permission-enforcing Lambda handler and the map popup gating also
    // fall back to).
    function effectiveMarkerMode(layer) {
        return layer.markerMode || (layer.readOnly ? 'creator' : 'anyone');
    }
    function effectiveDeleteMode(layer) {
        return layer.deleteMode || (layer.allowDeleteByOthers === false ? 'creator' : 'anyone');
    }
    function effectiveCommentMode(layer) {
        return layer.commentMode || (layer.disableComments ? 'creator' : 'anyone');
    }
    const MODE_LABELS = { anyone: 'Anyone', creator: 'Only the creator', moderators: 'The creator and moderators' };

    // Sorted alphabetically so a long list stays scannable; filtered by
    // collabLayerSearch below for the same reason.
    self.collabLayerRows = ko.pureComputed(() => self.collabLayers()
        .slice()
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map(layer => {
            const memberId = deps.getMemberId?.();
            const isCreator = !!memberId && memberId === layer.createdByMemberId;
            const moderators = Array.isArray(layer.moderators) ? layer.moderators : [];
            const isModerator = !!memberId && moderators.some(m => m?.id === memberId);
            const markerMode = effectiveMarkerMode(layer);
            const deleteMode = effectiveDeleteMode(layer);
            const commentMode = effectiveCommentMode(layer);
            const canDeleteByMode = deleteMode === 'anyone' || isCreator || (deleteMode === 'moderators' && isModerator);
            // Creator or any current moderator can manage the moderator
            // list (see lambda updateLayerModerators.js's isAuthorized
            // check) -- a moderator can add/remove others, including
            // themselves.
            const canManageModerators = isCreator || isModerator;
            const row = {
                layer,
                name: layer.name,
                markerCount: layer.markerCount || 0,
                lastUsedLabel: relativeTime(layer.lastUsedAt),
                markerMode,
                deleteMode,
                commentMode,
                markerRestricted: markerMode !== 'anyone',
                commentRestricted: commentMode !== 'anyone',
                markerModeTitle: `${MODE_LABELS[markerMode]} can add, edit or delete markers`,
                commentModeTitle: `${MODE_LABELS[commentMode]} can comment`,
                moderators,
                moderatorCount: moderators.length,
                // Precomputed (rather than a ternary in the data-bind
                // attribute) because knockout-secure-binding's expression
                // grammar doesn't support the conditional (?:) operator.
                moderatorCountLabel: `${moderators.length} moderator${moderators.length === 1 ? '' : 's'}`,
                moderatorNamesLabel: moderators.map(m => m.name).join(', '),
                eventId: layer.eventId || null,
                eventName: layer.eventName || null,
                eventIdentifier: layer.eventIdentifier || null,
                // Precomputed (rather than a ternary in the data-bind
                // attribute) because knockout-secure-binding's expression
                // grammar doesn't support the conditional (?:) operator.
                eventLabel: layer.eventName
                    ? (layer.eventIdentifier ? `${layer.eventIdentifier} — ${layer.eventName}` : layer.eventName)
                    : null,
                hqId: layer.hqId || null,
                hqName: layer.hqName || null,
                isCreator,
                canDelete: canDeleteByMode,
                confirmingDelete: ko.observable(false),
                // layer.createdBy is a raw Beacon person id -- resolved
                // asynchronously (and cached) to a display name via
                // root.resolvePersonName, same as marker/comment authorship
                // elsewhere on this page.
                authorName: ko.observable(''),
                // Creator or any current moderator can manage moderators
                // (enforced server-side too, see updateLayerModerators.js)
                // -- everyone else doesn't get the moderator picker in
                // #collabPermissionsModal at all. Edited in that same modal
                // as permissions/HQ/event (see saveRowPermissions), not its
                // own separate inline panel.
                canManageModerators,
                moderatorPicker: canManageModerators ? makeModeratorPicker(deps.searchMembers, moderators) : null,
                // Same authorization as moderator management -- creator or
                // any current moderator (see lambda
                // updateLayerPermissions.js) -- so this reuses
                // canManageModerators rather than a second computed flag.
                canManagePermissions: canManageModerators,
                savingPermissions: ko.observable(false),
                permissionsError: ko.observable(''),
                // Separate observables (rather than binding the radios
                // straight to row.markerMode/deleteMode/commentMode above)
                // so opening the modal doesn't retroactively change what the
                // row displays until Save is actually clicked -- same
                // "draft, then commit" shape as moderatorPicker.
                editMarkerMode: ko.observable(markerMode),
                editDeleteMode: ko.observable(deleteMode),
                editCommentMode: ko.observable(commentMode),
                // HQ/event reassignment shares the same modal and the same
                // authorization as the permission modes above (see
                // updateLayerAttachment.js) -- same "draft, then commit"
                // pickers as newLayerHqPicker/newLayerEventPicker in the
                // create-layer form above, just seeded from this layer's
                // current attachment instead of starting empty.
                hqEditPicker: canManageModerators
                    ? makeHqPicker(deps.entitiesSearch, layer.hqId ? { id: layer.hqId, name: layer.hqName } : null)
                    : null,
                eventEditPicker: canManageModerators
                    ? makeEventPicker(deps.searchEvents, layer.eventId
                        ? { id: layer.eventId, name: layer.eventName, identifier: layer.eventIdentifier }
                        : null)
                    : null,
            };
            if (layer.createdBy && root.resolvePersonName) {
                root.resolvePersonName(layer.createdBy).then(name => row.authorName(name));
            }
            // Precomputed here (rather than a ternary in the data-bind
            // attribute) because knockout-secure-binding's expression
            // grammar doesn't support the conditional (?:) operator.
            row.deleteTitle = row.canDelete ? 'Delete layer' : `${MODE_LABELS[deleteMode]} can delete this layer`;
            row.unsubscribe = () => self.unsubscribeLayer(row);
            row.requestDeleteLayer = () => row.confirmingDelete(true);
            row.cancelDeleteLayer = () => row.confirmingDelete(false);
            row.confirmDeleteLayer = () => self.deleteCollabLayer(row);
            row.openPermissionsModal = () => self.openPermissionsModal(row);
            row.savePermissions = () => self.saveRowPermissions(row);
            return row;
        }));

    self.filteredCollabLayerRows = ko.pureComputed(() => {
        const q = self.collabLayerSearch().trim().toLowerCase();
        const rows = self.collabLayerRows();
        if (!q) return rows;
        return rows.filter(row => row.name.toLowerCase().includes(q));
    });

    // Precomputed (rather than a ternary in the data-bind attribute)
    // because knockout-secure-binding's expression grammar doesn't support
    // the conditional (?:) operator.
    self.noLayersMessage = ko.pureComputed(() =>
        self.collabLayers().length === 0
            ? "You haven't subscribed to any layers yet — create one above, or find one to subscribe to below."
            : '');

    // Single computed driving both the visible condition and the message
    // text -- avoids two separate bindings on the same element (a compound
    // `visible` expression plus a `text:` interpolation) rendering
    // inconsistently with each other for a frame.
    self.noSearchMatchMessage = ko.pureComputed(() => {
        const q = self.collabLayerSearch().trim();
        if (!q || self.collabLayers().length === 0 || self.filteredCollabLayerRows().length > 0) return '';
        return `No layers match "${q}".`;
    });

    // ── Find a layer (discover/subscribe) ──
    // No HQ picked means "search all HQs" -- not "search nothing" -- so
    // this always fetches something, scoped server-side when an HQ is
    // picked (see lambda listLayers.js's hqId param) or unfiltered when not.
    self.runDiscoverSearch = async () => {
        if (!deps.apiUrl) {
            self.discoverResults([]);
            return;
        }
        self.discoverError('');
        self.discoverLoading(true);
        try {
            const hqId = self.discoverHqPicker.selected()?.id;
            self.discoverResults(await searchLayersForHq(deps.apiUrl, deps.getToken, hqId));
        } catch (err) {
            console.error('Error searching layers:', err);
            self.discoverError('Failed to search layers. Try again later.');
            self.discoverResults([]);
        } finally {
            self.discoverLoading(false);
        }
    };
    self.discoverHqPicker.selected.subscribe(() => self.runDiscoverSearch());

    // Debounced re-poll on every name filter keystroke too (same 250ms
    // shape as makeEventPicker/makeHqPicker above) -- discoverResults is a
    // point-in-time snapshot, so without this, a layer someone else creates
    // or renames mid-search stays invisible/stale until the HQ picker is
    // touched again. discoverRows below still does the actual name
    // narrowing client-side (the lambda has no name param), this just keeps
    // the underlying snapshot fresh while the user types.
    let discoverSearchTimer = null;
    self.discoverSearch.subscribe(() => {
        if (discoverSearchTimer) clearTimeout(discoverSearchTimer);
        discoverSearchTimer = setTimeout(self.runDiscoverSearch, 250);
    });

    self.discoverRows = ko.pureComputed(() => {
        const subscribedIds = new Set(self.collabLayers().map(l => l.id));
        const q = self.discoverSearch().trim().toLowerCase();
        return self.discoverResults()
            .filter(layer => !q || (layer.name || '').toLowerCase().includes(q))
            .slice()
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .map(layer => {
                const drow = {
                    layer,
                    name: layer.name,
                    markerCount: layer.markerCount || 0,
                    lastUsedLabel: relativeTime(layer.lastUsedAt),
                    // hqName is shown per-row since browsing can span every
                    // HQ at once (no HQ picked -- see runDiscoverSearch above).
                    hqName: layer.hqName || null,
                    eventName: layer.eventName || null,
                    // Precomputed (rather than a ternary in the data-bind
                    // attribute) because knockout-secure-binding's
                    // expression grammar doesn't support the conditional
                    // (?:) operator.
                    eventLabel: layer.eventName
                        ? (layer.eventIdentifier ? `${layer.eventIdentifier} — ${layer.eventName}` : layer.eventName)
                        : null,
                    alreadySubscribed: subscribedIds.has(layer.id),
                    subscribing: ko.observable(false),
                    // layer.createdBy is a raw Beacon person id -- resolved
                    // asynchronously (and cached) to a display name via
                    // root.resolvePersonName, same as collabLayerRows above.
                    authorName: ko.observable(''),
                };
                if (layer.createdBy && root.resolvePersonName) {
                    root.resolvePersonName(layer.createdBy).then(name => drow.authorName(name));
                }
                return drow;
            });
    });

    // Precomputed (rather than a ternary in the data-bind attribute)
    // because knockout-secure-binding's expression grammar doesn't support
    // the conditional (?:) operator.
    self.discoverEmptyMessage = ko.pureComputed(() => {
        if (self.discoverLoading() || self.discoverRows().length > 0) return '';
        const hq = self.discoverHqPicker.selected();
        return hq ? `No layers found for ${hq.name}.` : 'No layers found.';
    });

    self.subscribeToDiscoverRow = (discoverRow) => {
        if (discoverRow.alreadySubscribed || discoverRow.subscribing()) return;
        discoverRow.subscribing(true);
        try {
            subscribeToLayer(root, deps.apiUrl, discoverRow.layer, deps.actorId, deps.getToken, deps.getMemberId);
        } finally {
            discoverRow.subscribing(false);
        }
    };

    self.unsubscribeLayer = (row) => {
        unsubscribeFromLayer(root, row.layer.id);
    };

    // Shared by a successful create and an explicit Cancel -- closes the
    // form and puts it back to its just-opened state, ready for next time.
    // HQ resets to the resolved default (not empty), since reopening the
    // form later is almost always for the same HQ; everything else resets
    // to its "no customisation" default.
    function resetNewLayerForm() {
        self.newLayerName('');
        self.newLayerMarkerMode('anyone');
        self.newLayerDeleteMode('anyone');
        self.newLayerCommentMode('anyone');
        self.newLayerModeratorPicker.reset([]);
        self.newLayerEventPicker.reset(null);
        self.newLayerHqPicker.reset(self.defaultHq());
        self.showCreateLayerForm(false);
    }

    self.cancelCreateLayer = () => {
        self.collabLayerError('');
        resetNewLayerForm();
    };

    self.createCollabLayer = async () => {
        const name = self.newLayerName().trim();
        const hq = self.newLayerHqPicker.selected();
        if (!name || !deps.apiUrl) return;
        if (!hq) {
            self.collabLayerError('An HQ is required -- search for one above.');
            return;
        }

        self.collabLayerError('');
        self.creatingCollabLayer(true);
        try {
            const permissions = {
                markerMode: self.newLayerMarkerMode(),
                deleteMode: self.newLayerDeleteMode(),
                commentMode: self.newLayerCommentMode(),
                moderators: self.newLayerModeratorPicker.moderators(),
                event: self.newLayerEventPicker.selected(),
                hq,
            };
            const layer = await createCollabLayer(root, deps.apiUrl, name, deps.actorId, deps.getToken, permissions, deps.getMemberId);
            if (!layer) throw new Error('Create failed');
            resetNewLayerForm();
        } catch (err) {
            console.error('Error creating collaborative layer:', err);
            self.collabLayerError('Failed to create layer. Try again later.');
        } finally {
            self.creatingCollabLayer(false);
        }
    };

    // Re-pulls "My layers" from the server -- picks up any changes to
    // layers this user is subscribed to since this page loaded
    // (createCollabLayer above only accounts for layers *this* session
    // created/subscribed to).
    self.refreshCollabLayers = async () => {
        if (!deps.apiUrl || self.refreshingCollabLayers()) return;

        self.collabLayerError('');
        self.refreshingCollabLayers(true);
        try {
            await refreshSubscribedLayers(root, deps.apiUrl, deps.actorId, deps.getToken, deps.getMemberId);
        } catch (err) {
            console.error('Error refreshing collaborative layers:', err);
            self.collabLayerError('Failed to refresh layer list. Try again later.');
        } finally {
            self.refreshingCollabLayers(false);
        }
    };

    // Actual delete, fired from row.confirmDeleteLayer above once the user
    // has clicked through the row's inline confirm step (same two-step
    // pattern as a marker's own delete confirm in collabLayer.js).
    self.deleteCollabLayer = async (row) => {
        if (!deps.apiUrl || self.deletingCollabLayerId()) return;

        self.collabLayerError('');
        self.deletingCollabLayerId(row.layer.id);
        try {
            const ok = await deleteCollabLayer(root, deps.apiUrl, row.layer.id, deps.actorId, deps.getToken);
            if (!ok) throw new Error('Delete failed');
        } catch (err) {
            console.error('Error deleting collaborative layer:', err);
            self.collabLayerError('Failed to delete layer. Try again later.');
            row.confirmingDelete(false);
        } finally {
            self.deletingCollabLayerId(null);
        }
    };

    // Saves a row's in-progress marker/delete/comment mode radios, its
    // in-progress HQ/event pickers, *and* its in-progress moderator picker
    // (all edited together in #collabPermissionsModal) as the layer's new
    // permissions, attachment and moderator list, fired from
    // row.savePermissions above. Only rows the creator or a current
    // moderator can manage ever get the "Manage permissions" control exposed
    // (see collabLayerRows' canManagePermissions), so there's no separate
    // authorization check needed here -- the Lambda enforces it
    // authoritatively either way. Three independent PUTs (permissions,
    // attachment and moderators are separate Lambda routes/S3 fields) fired
    // together so one Save click covers everything the modal edits; any can
    // fail on its own, in which case the modal stays open with the error
    // shown rather than silently discarding whichever part didn't make it.
    self.saveRowPermissions = async (row) => {
        if (!deps.apiUrl || !row.canManagePermissions || row.savingPermissions()) return;
        if (row.hqEditPicker && !row.hqEditPicker.selected()) {
            row.permissionsError('An HQ is required.');
            return;
        }

        row.permissionsError('');
        row.savingPermissions(true);
        try {
            const permissions = {
                markerMode: row.editMarkerMode(),
                deleteMode: row.editDeleteMode(),
                commentMode: row.editCommentMode(),
            };
            const [savedPermissions, savedAttachment, savedModerators] = await Promise.all([
                updateCollabLayerPermissions(root, deps.apiUrl, row.layer.id, permissions, deps.getToken),
                updateCollabLayerAttachment(root, deps.apiUrl, row.layer.id, {
                    hq: row.hqEditPicker.selected(),
                    event: row.eventEditPicker.selected(),
                }, deps.getToken),
                updateCollabLayerModerators(root, deps.apiUrl, row.layer.id, row.moderatorPicker.moderators(), deps.getToken),
            ]);
            if (savedPermissions == null || savedAttachment == null || savedModerators == null) throw new Error('Update failed');
            // All three update calls mutate row.layer's fields in place
            // (it's the same object reference held in
            // self.collabLayers()) -- force collabLayerRows to recompute so
            // this row (and its canDelete/lock badges, HQ/event labels and
            // moderator badges) reflects the new values immediately, same
            // as a poll-driven refresh would.
            self.collabLayers.valueHasMutated();
            // Only close on success -- an error leaves the modal open (with
            // permissionsError shown) so the user can see what went wrong
            // and retry, rather than the failure vanishing along with the
            // modal's content.
            bootstrap.Modal.getOrCreateInstance(document.getElementById('collabPermissionsModal')).hide();
        } catch (err) {
            console.error('Error updating layer permissions:', err);
            row.permissionsError('Failed to save changes. Try again later.');
        } finally {
            row.savingPermissions(false);
        }
    };

    // Named methods (rather than inline functions in data-bind attributes)
    // because knockout-secure-binding's restricted grammar doesn't support
    // control-flow statements like `if` inside inline function literals.
    self.handleNewLayerNameKeydown = (data, event) => {
        if (event.key === 'Enter') self.createCollabLayer();
        return true;
    };

    self.fetchPeriod = ko.observable(7).extend({ min: 0, max: 31, digit: true });
    self.fetchForward = ko.observable(0).extend({ min: 0, max: 31, digit: true });
    self.showAdvanced = ko.observable(false);
    self.darkMode = ko.observable(false);

    self.layoutPresetDefs = [
        {
            id: 'map-right-teams-top',
            name: 'Map Right · Teams Top',
            description: 'Teams above tasking in the sidebar, map on the right.',
            previewClass: 'preset-map-right-teams-top'
        },
        {
            id: 'map-right-tasking-top',
            name: 'Map Right · Tasking Top',
            description: 'Tasking above teams in the sidebar, map on the right.',
            previewClass: 'preset-map-right-tasking-top'
        },
        {
            id: 'map-left-teams-top',
            name: 'Map Left · Teams Top',
            description: 'Map on the left with teams above tasking on the right.',
            previewClass: 'preset-map-left-teams-top'
        },
        {
            id: 'map-left-tasking-top',
            name: 'Map Left · Tasking Top',
            description: 'Map on the left with tasking above teams on the right.',
            previewClass: 'preset-map-left-tasking-top'
        },
        {
            id: 'map-right-teams-only',
            name: 'Map Right · Teams Only',
            description: 'Hide tasking pane, keep teams + map.',
            previewClass: 'preset-map-right-teams-only'
        },
        {
            id: 'map-right-tasking-only',
            name: 'Map Right · Tasking Only',
            description: 'Hide teams pane, keep tasking + map.',
            previewClass: 'preset-map-right-tasking-only'
        },
        {
            id: 'map-left-teams-only',
            name: 'Map Left · Teams Only',
            description: 'Map left with teams-only pane on the right.',
            previewClass: 'preset-map-left-teams-only'
        },
        {
            id: 'map-left-tasking-only',
            name: 'Map Left · Tasking Only',
            description: 'Map left with tasking-only pane on the right.',
            previewClass: 'preset-map-left-tasking-only'
        },
        {
            id: 'map-only',
            name: 'Map Only',
            description: 'Hide both sidebar panes and use the full map view.',
            previewClass: 'preset-map-only'
        }
    ];
    self.layoutPreset = ko.observable(DEFAULT_LAYOUT_PRESET);

    //blown away on load
    self.teamStatusFilter = ko.observableArray([]);

    //blown away on load
    self.jobStatusFilter = ko.observableArray([]);

    self.incidentTypeFilter = ko.observableArray([]);


    self.teamTaskStatusFilter = ko.observableArray([]);

    // Map clustering
    self.clusterEnabled = ko.observable(true);
    self.clusterRadius = ko.observable(60);   // maxClusterRadius in px (10–80)
    self.clusterRescueJobs = ko.observable(true);
    self.alertsCollapsibleRules = ko.observable(true);
    self.taskingCountActiveOnly = ko.observable(false);

    // pinned rows
    self.pinnedTeamIds = ko.observableArray([]);
    self.pinnedIncidentIds = ko.observableArray([]);

    // ── Instant Task Suggestion Engine ──
    self.suggestionEnabled = ko.observable(true);
    self.rescueDistanceWeight = ko.observable(90);
    self.rescueTaskingWeight = ko.observable(10);
    self.normalDistanceWeight = ko.observable(50);
    self.normalTaskingWeight = ko.observable(50);

    /**
     * When true, the suggestion engine fetches road travel times from
     * Amazon Location Service to rank teams by actual driving time
     * instead of crow-flies distance.
     * @type {ko.Observable<boolean>}
     */
    self.suggestionUseRouting = ko.observable(false);

    // Keep rescue sliders summing to ~100 (optional visual aid)
    self.rescueDistanceWeightDisplay = ko.pureComputed(() => {
        const d = Number(self.rescueDistanceWeight()) || 0;
        const t = Number(self.rescueTaskingWeight()) || 0;
        const total = d + t || 1;
        return Math.round(d / total * 100);
    });
    self.rescueTaskingWeightDisplay = ko.pureComputed(() => {
        const d = Number(self.rescueDistanceWeight()) || 0;
        const t = Number(self.rescueTaskingWeight()) || 0;
        const total = d + t || 1;
        return Math.round(t / total * 100);
    });
    self.normalDistanceWeightDisplay = ko.pureComputed(() => {
        const d = Number(self.normalDistanceWeight()) || 0;
        const t = Number(self.normalTaskingWeight()) || 0;
        const total = d + t || 1;
        return Math.round(d / total * 100);
    });
    self.normalTaskingWeightDisplay = ko.pureComputed(() => {
        const d = Number(self.normalDistanceWeight()) || 0;
        const t = Number(self.normalTaskingWeight()) || 0;
        const total = d + t || 1;
        return Math.round(t / total * 100);
    });

    // Dark mode helper (defined early so it can be called in afterConfigLoad)
    self._applyDarkMode = () => {
        if (self.darkMode()) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    };


    self.openLoadBox = function () {
        self.loadExpanded(true);
    };

    self.closeLoadBox = function () {
        self.loadExpanded(false);
        self.shareKeyInput("");
    };

    self.teamTaskStatusFilterDefaults = [
        "Tasked",
        "Onsite",
        "Offsite",
        "Enroute",
    ];

    self.jobStatusFilterDefaults = [
        "Active", "New", "Tasked"
    ];

    self.teamStatusFilterDefaults = [
        "Activated"
    ];

    self.incidentTypeFilterDefaults = [
        "Tsunami",
        "Other",
        "Transport",
        "WelfareCheck",
        "EvacuationSecondary",
        "EvacuationPriority",
        "FloodMisc",
        "VetAssistance",
        "FodderDrop",
        "MedicalResupply",
        "Resupply",
        "LAR",
        "VR",
        "CFR",
        "GLR",
        "RCR",
        "FR",
        "Support",
        "Storm"
    ]



    // Build the current config payload (used by save + share)
    const buildConfig = () => ({
        refreshInterval: Number(self.refreshInterval()),
        fetchPeriod: Number(self.fetchPeriod()),
        fetchForward: Number(self.fetchForward()),
        showAdvanced: !!self.showAdvanced(),
        darkMode: !!self.darkMode(),
        layoutPreset: normalizeLayoutPreset(self.layoutPreset()),
        locationFilters: {
            teams: ko.toJS(self.teamFilters),
            incidents: ko.toJS(self.incidentFilters)
        },
        // these are your “ignored” statuses used by filters
        teamStatusFilter: ko.toJS(self.teamStatusFilter),
        jobStatusFilter: ko.toJS(self.jobStatusFilter),
        incidentTypeFilter: ko.toJS(self.incidentTypeFilter),
        teamTaskStatusFilter: ko.toJS(self.teamTaskStatusFilter),
        sectorFilters: ko.toJS(self.sectorFilters),
        includeIncidentsWithoutSector: !!self.includeIncidentsWithoutSector(),
        applySectorsToIncidents: !!self.applySectorsToIncidents(),
        applySectorsToTeams: !!self.applySectorsToTeams(),
        pinnedTeamIds: ko.toJS(self.pinnedTeamIds),
        pinnedIncidentIds: ko.toJS(self.pinnedIncidentIds),
        paneOrder: self.paneOrder().map(p => p.id),
        clusterEnabled: !!self.clusterEnabled(),
        clusterRadius: Number(self.clusterRadius()) || 60,
        clusterRescueJobs: !!self.clusterRescueJobs(),
        alertsCollapsibleRules: !!self.alertsCollapsibleRules(),
        taskingCountActiveOnly: !!self.taskingCountActiveOnly(),
        suggestionEnabled: !!self.suggestionEnabled(),
        rescueDistanceWeight: Number(self.rescueDistanceWeight()) || 0,
        rescueTaskingWeight: Number(self.rescueTaskingWeight()) || 0,
        normalDistanceWeight: Number(self.normalDistanceWeight()) || 0,
        normalTaskingWeight: Number(self.normalTaskingWeight()) || 0,
        suggestionUseRouting: !!self.suggestionUseRouting(),
    });

    // Helpers
    const norm = (item) => ({
        id: item?.id ?? item?.Id ?? item?.code ?? String(item),
        name: item?.name ?? item?.Name ?? item?.label ?? item?.fullName ?? String(item),
        entityType: item?.entityType ?? item?.EntityTypeId ?? 0
    });


    function makeResultVM(raw) {
        const r = norm(raw);
        r.teamSelected = ko.pureComputed(function () {
            return self.teamFilters().some(function (t) { return t.id === r.id; });
        });
        r.incidentSelected = ko.pureComputed(function () {
            return self.incidentFilters().some(function (i) { return i.id === r.id; });
        });
        return r;
    }

    const upsert = (arr, item) => {
        const exists = arr().some(x => x.id === item.id);
        if (!exists) arr.push(item);
        if (exists) arr.remove(x => x.id === item.id);
    };
    const removeById = (arr, id) => arr.remove(x => x.id === id);

    self.clearTeams = () => self.teamFilters.removeAll();
    self.clearIncidents = () => self.incidentFilters.removeAll();
    self.clearSectors = () => self.sectorFilters.removeAll();

    // Search (debounced)
    let searchSeq = 0;

    self.query
        .extend({ rateLimit: { timeout: 300, method: 'notifyWhenChangesStop' } })
        .subscribe(q => {
            const t = (q || '').trim();
            if (!t) {
                searchSeq++;
                self.searching(false);
                self.results([]);
                self.dropdownOpen(false);
                return;
            }

            const mySeq = ++searchSeq;

            // show dropdown immediately with loading state + clear old results
            self.results([]);
            self.dropdownOpen(true);
            self.searching(true);

            deps.entitiesSearch(t)
                .then(list => {
                    if (mySeq !== searchSeq) return; // ignore stale responses
                    self.results(list.map(e => makeResultVM({ id: e.Id, name: e.Name, entityType: e.EntityTypeId })));
                    self.dropdownOpen(true);
                })
                .catch(() => {
                    if (mySeq !== searchSeq) return;
                    self.results([]);      // triggers "No results found."
                    self.dropdownOpen(true);
                })
                .finally(() => {
                    if (mySeq === searchSeq) self.searching(false);
                });
        });


    // Actions from results
    self.addTeam = (item, ev) => {
        upsert(self.teamFilters, norm(item));
        // keep dropdown open and focus back to the input so typing can continue
        self.dropdownOpen(true);
        self.inputHasFocus(true);
        ev?.preventDefault();
        ev?.stopPropagation();
    };
    self.addIncident = (item, ev) => {
        upsert(self.incidentFilters, norm(item));
        self.dropdownOpen(true);
        self.inputHasFocus(true);
        ev?.preventDefault();
        ev?.stopPropagation();
    };

    self.addTeamAndIncident = (item, ev) => {

        //force add to both if doesnt exist, dont remove if it does
        const n = norm(item);

        const teamExists = self.teamFilters().some(x => x.id === n.id);
        if (!teamExists) self.teamFilters.push(n);

        const incidentExists = self.incidentFilters().some(x => x.id === n.id);
        if (!incidentExists) self.incidentFilters.push(n);

        self.dropdownOpen(true);
        self.inputHasFocus(true);
        ev?.preventDefault();
        ev?.stopPropagation();

    }

    // Pills
    self.removeTeam = (item) => removeById(self.teamFilters, item.id);
    self.removeIncident = (item) => removeById(self.incidentFilters, item.id);

    self.loadChildrenForTeam = (item) => deps.entitiesChildren(item.id).then(children => {
        children.forEach(c => upsert(self.teamFilters, norm({ id: c.Id, name: c.Name, entityType: c.EntityTypeId })));
    });
    self.loadChildrenForIncident = (item) => deps.entitiesChildren(item.id).then(children => {
        children.forEach(c => upsert(self.incidentFilters, norm({ id: c.Id, name: c.Name, entityType: c.EntityTypeId })));
    });

    // Clear/search UI
    self.clearSearch = () => { self.query(''); self.results([]); self.dropdownOpen(false); };


    self.clearPinnedTeams = () => {
        self.pinnedTeamIds.removeAll();
        self.save();
    };

    self.clearPinnedIncidents = () => {
        self.pinnedIncidentIds.removeAll();
        self.save();
    };

    self.clearAllPinned = () => {
        self.pinnedTeamIds.removeAll();
        self.pinnedIncidentIds.removeAll();
        self.save();
    };


    // Only close if focus moved *outside* the dropdown
    self.closeDropdown = (_data, ev) => {
        const dd = document.getElementById('searchDropdown');
        const next = ev?.relatedTarget || document.activeElement;
        if (dd && next && dd.contains(next)) {
            // Focus is moving into the dropdown (e.g., clicking a button) – keep it open
            return true;
        }
        window.setTimeout(function () {
            self.dropdownOpen(false);
        }, 150);
        return true;
    };


    // Persistence
    const STORAGE_KEY = 'lh-taskingConfig';

    self.save = () => {
        const cfg = buildConfig();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));

    };

    self.saveAndCloseAndLoad = () => {
        
        self.save();

        root.UserPressedSaveOnTheConfigModal()

        // Close the Bootstrap modal
        const el = document.getElementById('configModal');
        const m = bootstrap.Modal.getOrCreateInstance(el);
        m.hide();
    }

    self.saveAndLoadJobData = () => {
        self.save();
        root.fetchAllJobsData();
        return true;
    }

    self.saveAndLoadTeamData = () => {
        self.save();
        root.fetchAllTeamData();
        return true;
    }




    self.loadFromStorage = () => {
        suppressRecklessModal = true;
        const saved = localStorage.getItem(STORAGE_KEY);
        let cfg;
        try {
            cfg = JSON.parse(saved);
        } catch (e) {
            console.warn('Failed to parse lh-taskingConfig:', e);
            return;
        }
        if (!cfg) {
            cfg = {}
            console.log('Using defaults.');
            cfg.refreshInterval = self.refreshInterval();
            cfg.fetchPeriod = self.fetchPeriod();
            cfg.fetchForward = self.fetchForward();
            cfg.showAdvanced = self.showAdvanced();
            cfg.teamStatusFilter = self.teamStatusFilterDefaults;
            cfg.jobStatusFilter = self.jobStatusFilterDefaults;
            cfg.incidentTypeFilter = self.incidentTypeFilterDefaults;
            cfg.teamTaskStatusFilter = self.teamTaskStatusFilterDefaults;
            cfg.sectorFilters = [];
            cfg.includeIncidentsWithoutSector = true;
            cfg.applySectorsToIncidents = false;
            cfg.applySectorsToTeams = false;
            cfg.pinnedTeamIds = [];
            cfg.pinnedIncidentIds = [];

            // Extract HQ ID from URL if present
            const search = window.location?.search || '';
            const hqMatch = search.match(/hq=(\d+)/);
            if (hqMatch) {
                const hqId = hqMatch[1];
                deps.entity(hqId).then(result => {
                    if (result) {
                        const normEntity = norm({ id: result.Id, name: result.Name, entityType: result.EntityTypeId });
                        self.incidentFilters([normEntity]);
                        self.teamFilters([normEntity]);
                    }
                });
            }
        }
        // scalar settings
        if (typeof cfg.refreshInterval === 'number') {
            self.refreshInterval(cfg.refreshInterval);
            lastRefreshInterval = cfg.refreshInterval;
        }
        if (typeof cfg.fetchPeriod === 'number') {
            self.fetchPeriod(cfg.fetchPeriod);
        }
        if (typeof cfg.fetchForward === 'number') {
            self.fetchForward(cfg.fetchForward);
        }
        if (typeof cfg.showAdvanced === 'boolean') {
            self.showAdvanced(cfg.showAdvanced);
        }
        if (typeof cfg.darkMode === 'boolean') {
            self.darkMode(cfg.darkMode);
        }
        self.layoutPreset(normalizeLayoutPreset(cfg.layoutPreset || localStorage.getItem('lh.layoutPreset')));
        if (typeof cfg.includeIncidentsWithoutSector === 'boolean') {
            self.includeIncidentsWithoutSector(cfg.includeIncidentsWithoutSector);
        }
        if (typeof cfg.applySectorsToIncidents === 'boolean') {
            self.applySectorsToIncidents(cfg.applySectorsToIncidents);
        }
        if (typeof cfg.applySectorsToTeams === 'boolean') {
            self.applySectorsToTeams(cfg.applySectorsToTeams);
        }

        // filters
        if (cfg.locationFilters) {
            self.teamFilters(cfg.locationFilters.teams || []);
            self.incidentFilters(cfg.locationFilters.incidents || []);
        }


        // status filters (arrays of status names to show)
        if (Array.isArray(cfg.teamStatusFilter)) {
            self.teamStatusFilter(cfg.teamStatusFilter);
        }
        if (Array.isArray(cfg.jobStatusFilter)) {
            self.jobStatusFilter(cfg.jobStatusFilter);
        }
        if (Array.isArray(cfg.incidentTypeFilter)) {
            self.incidentTypeFilter(cfg.incidentTypeFilter);
        }
        if (Array.isArray(cfg.teamTaskStatusFilter)) {
            self.teamTaskStatusFilter(cfg.teamTaskStatusFilter);
        }
        if (Array.isArray(cfg.sectorFilters)) {
            self.sectorFilters(cfg.sectorFilters);
        }

        if (Array.isArray(cfg.pinnedTeamIds)) {
            self.pinnedTeamIds(cfg.pinnedTeamIds.map(x => String(x)));
        }
        if (Array.isArray(cfg.pinnedIncidentIds)) {
            self.pinnedIncidentIds(cfg.pinnedIncidentIds.map(x => String(x)));
        }

        if (Array.isArray(cfg.paneOrder)) {
            self.rebuildPaneOrderFromIds(cfg.paneOrder);
        } else {
            self.rebuildPaneOrderFromIds(); // defaults
        }

        if (typeof cfg.clusterEnabled === 'boolean') {
            self.clusterEnabled(cfg.clusterEnabled);
        }
        if (typeof cfg.clusterRadius === 'number' && cfg.clusterRadius >= 10 && cfg.clusterRadius <= 80) {
            self.clusterRadius(cfg.clusterRadius);
        }
        if (typeof cfg.clusterRescueJobs === 'boolean') {
            self.clusterRescueJobs(cfg.clusterRescueJobs);
        }
        if (typeof cfg.alertsCollapsibleRules === 'boolean') {
            self.alertsCollapsibleRules(cfg.alertsCollapsibleRules);
        }
        if (typeof cfg.taskingCountActiveOnly === 'boolean') {
            self.taskingCountActiveOnly(cfg.taskingCountActiveOnly);
        }

        // Instant Task Suggestion Engine weights
        if (typeof cfg.suggestionEnabled === 'boolean') {
            self.suggestionEnabled(cfg.suggestionEnabled);
        }
        if (typeof cfg.rescueDistanceWeight === 'number') {
            self.rescueDistanceWeight(cfg.rescueDistanceWeight);
        }
        if (typeof cfg.rescueTaskingWeight === 'number') {
            self.rescueTaskingWeight(cfg.rescueTaskingWeight);
        }
        if (typeof cfg.normalDistanceWeight === 'number') {
            self.normalDistanceWeight(cfg.normalDistanceWeight);
        }
        if (typeof cfg.normalTaskingWeight === 'number') {
            self.normalTaskingWeight(cfg.normalTaskingWeight);
        }
        if (typeof cfg.suggestionUseRouting === 'boolean') {
            self.suggestionUseRouting(cfg.suggestionUseRouting);
        }


        self.afterConfigLoad()
        suppressRecklessModal = false;
    };

    self.share = async () => {
        self.shareError('');
        self.sharing(true);

        try {
            const savedConfig = buildConfig();
            const token = await deps.getToken();

            const res = await fetch(FUNCTION_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ config: savedConfig })
            });

            if (!res.ok) {
                throw new Error(`Share failed with status ${res.status}`);
            }

            const { id } = await res.json();

            if (!id) {
                throw new Error("No id returned from share service");
            }

            self.shareId(id);
        } catch (err) {
            console.error('Error sharing config:', err);
            self.shareError('Failed to share config. Try again later.');
            self.shareId('');
        } finally {
            self.sharing(false);
        }
    };

    // GET shared config from Lambda -> apply + refresh
    self.loadShared = async (id) => {
        if (!id) return;

        self.shareError('');
        self.loadingShared(true);

        try {
            // Adjust to match your handler: expects ?id=...
            const url = `${FUNCTION_URL}?id=${encodeURIComponent(id)}`;
            const token = await deps.getToken();

            const res = await fetch(url, {
                method: "GET",
                headers: { "Accept": "application/json", "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) {
                throw new Error(`Load failed with status ${res.status}`);
            }

            const data = await res.json();
            const cfg = data.config || data; // support {config: ...} or raw

            if (!cfg || typeof cfg !== 'object') {
                throw new Error('Invalid config returned from share service');
            }

            // Persist + apply
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
            self.loadFromStorage();

            // Refresh data based on new filters
            root.fetchAllTeamData();
            root.fetchAllJobsData();
            root.fetchAllTrackableAssets();

            self.shareId(id);
            self.shareKeyInput(id);
        } catch (err) {
            console.error('Error loading shared config:', err);
            self.shareError('Failed to load shared config. Check the key and try again.');
        } finally {
            self.loadingShared(false);
        }
    };

    // Used by the header form (enter key + press Enter / click Load)
    self.loadSharedFromField = () => {
        const id = (self.shareKeyInput() || '').trim();
        if (!id) return;
        self.loadShared(id);
    };

    /**
     * Collect the HQ IDs relevant for sector lookup based on which
     * scope toggles are active (incidents, teams, or both).
     * @returns {Array<string>}
     */
    self._sectorHqIds = () => {
        const ids = new Set();
        (self.incidentFilters() || []).forEach(f => ids.add(f.id));
        (self.teamFilters() || []).forEach(f => ids.add(f.id));
        return [...ids];
    };

    /** Trigger a sector refresh using the current scope-aware HQ list. */
    self._refreshSectors = () => {
        if (self._suppressSectorRefresh) return;
        const ids = self._sectorHqIds();
        if (ids.length === 0) return;          // no HQs selected — nothing to search
        deps.fetchAllSectors(ids);
    };

    self.afterConfigLoad = () => {
        self._refreshSectors();
        root.mapVM?.applyPaneOrder?.(self.paneOrder().map(p => p.id));
        root.mapVM?.applyClusterRadius?.(Number(self.clusterRadius()) || 60);
        root.mapVM?.applyClusterEnabled?.(!!self.clusterEnabled());
        applyLayoutPresetClass(normalizeLayoutPreset(self.layoutPreset()));
        // Apply dark mode
        self._applyDarkMode();
        // Apply dark mode basemap if enabled
        if (self.darkMode() && root.mapVM?.changeBasemap) {
            root.mapVM.changeBasemap("DarkGray");
        }
    }


    // run once on construction — suppress sector refresh until afterConfigLoad
    self._suppressSectorRefresh = true;
    self.loadFromStorage()
    self._suppressSectorRefresh = false;
    self._refreshSectors();

    self.incidentFilters.subscribe(() => {
        self._refreshSectors();
    }, null, "arrayChange");

    self.teamFilters.subscribe(() => {
        self._refreshSectors();
    }, null, "arrayChange");

    self.applySectorsToIncidents.subscribe(() => self._refreshSectors());
    self.applySectorsToTeams.subscribe(() => self._refreshSectors());

    self.includeIncidentsWithoutSector.subscribe(() => {
        root.fetchAllJobsData();
    })

    self.paneOrder.subscribe(() => {
        root.mapVM?.applyPaneOrder?.(self.paneOrder().map(p => p.id));
    })

    self.clusterRadius.subscribe((v) => {
        const r = Math.max(10, Math.min(80, Number(v) || 60));
        root.mapVM?.applyClusterRadius?.(r);
        self.save();
    })

    self.clusterEnabled.subscribe((v) => {
        root.mapVM?.applyClusterEnabled?.(!!v);
        self.save();
    })

    self.clusterRescueJobs.subscribe((v) => {
        root.mapVM?.applyRescueClusterSetting?.(!!v);
        self.save();
    })

    self.alertsCollapsibleRules.subscribe(() => {
        self.save();
    })

    self.taskingCountActiveOnly.subscribe(() => {
        self.save();
    })

    // Auto-save suggestion engine settings
    self.suggestionEnabled.subscribe(() => { self.save(); });
    self.rescueDistanceWeight.subscribe(() => { self.save(); });
    self.rescueTaskingWeight.subscribe(() => { self.save(); });
    self.normalDistanceWeight.subscribe(() => { self.save(); });
    self.normalTaskingWeight.subscribe(() => { self.save(); });
    self.suggestionUseRouting.subscribe(() => { self.save(); });

    self.darkMode.subscribe((isDark) => {
        self._applyDarkMode();
        
        // Switch basemap when dark mode changes
        if (root.mapVM?.changeBasemap) {
            const targetBasemap = isDark ? "DarkGray" : "Topographic";
            root.mapVM.changeBasemap(targetBasemap);
        }
        
        self.save();
    });

    self.layoutPreset.subscribe((preset) => {
        const normalized = normalizeLayoutPreset(preset);
        if (normalized !== preset) {
            self.layoutPreset(normalized);
            return;
        }
        applyLayoutPresetClass(normalized);
        self.save();
    });

    /** Wipe all Lighthouse localStorage keys and reload the page. */
    self.restoreDefaults = () => {
        if (!confirm(
            'This will reset ALL settings (filters, layout, map layers, starred items, etc.) to their defaults and reload the page.\n\nContinue?'
        )) return;

        // Remove every key in localStorage (covers all lh-*, ov.*, layers.*, map.*, etc.)
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            keys.push(localStorage.key(i));
        }
        keys.forEach(k => localStorage.removeItem(k));

        location.reload();
    };

}
