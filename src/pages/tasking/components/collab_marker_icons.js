import L from 'leaflet';

/**
 * Curated set of Font Awesome 5 Free icons relevant to emergency-service
 * field marking (hazards, medical, welfare, shelter, infrastructure,
 * vehicles/rescue, status). Grouped for a scannable picker UI.
 *
 * Every `fa` class here is confirmed present in the bundled
 * @fortawesome/fontawesome-free 5.15.4 solid set -- don't add an icon
 * without checking node_modules/@fortawesome/fontawesome-free/svgs/solid/.
 */
export const MARKER_ICON_GROUPS = [
    {
        group: 'Hazards',
        icons: [
            { key: 'fire', label: 'Fire', fa: 'fa-fire' },
            { key: 'fire-extinguisher', label: 'Fire (controlled)', fa: 'fa-fire-extinguisher' },
            { key: 'water', label: 'Flooding', fa: 'fa-water' },
            { key: 'house-damage', label: 'Structural damage', fa: 'fa-house-damage' },
            { key: 'exclamation-triangle', label: 'Hazard', fa: 'fa-exclamation-triangle' },
            { key: 'skull-crossbones', label: 'Danger / poison', fa: 'fa-skull-crossbones' },
            { key: 'biohazard', label: 'Biohazard', fa: 'fa-biohazard' },
            { key: 'radiation', label: 'Radiation', fa: 'fa-radiation' },
            { key: 'bolt', label: 'Downed power line', fa: 'fa-bolt' },
            { key: 'wind', label: 'Storm / wind damage', fa: 'fa-wind' },
            { key: 'smog', label: 'Smoke / air hazard', fa: 'fa-smog' },
            { key: 'car-crash', label: 'Vehicle accident', fa: 'fa-car-crash' },
            { key: 'tree', label: 'Fallen tree', fa: 'fa-tree' },
            { key: 'gas-pump', label: 'Fuel / gas hazard', fa: 'fa-gas-pump' },
            { key: 'ban', label: 'Road closed', fa: 'fa-ban' },
        ],
    },
    {
        group: 'Medical',
        icons: [
            { key: 'ambulance', label: 'Ambulance', fa: 'fa-ambulance' },
            { key: 'first-aid', label: 'First aid', fa: 'fa-first-aid' },
            { key: 'hospital', label: 'Hospital', fa: 'fa-hospital' },
            { key: 'user-md', label: 'Medical personnel', fa: 'fa-user-md' },
            { key: 'user-injured', label: 'Injured person', fa: 'fa-user-injured' },
            { key: 'syringe', label: 'Medical supplies', fa: 'fa-syringe' },
        ],
    },
    {
        group: 'People',
        icons: [
            { key: 'user', label: 'Person', fa: 'fa-user' },
            { key: 'users', label: 'Group of people', fa: 'fa-users' },
            { key: 'wheelchair', label: 'Accessibility needs', fa: 'fa-wheelchair' },
            { key: 'baby-carriage', label: 'Infant / child', fa: 'fa-baby-carriage' },
            { key: 'paw', label: 'Animal / livestock', fa: 'fa-paw' },
        ],
    },
    {
        group: 'Shelter & Resources',
        icons: [
            { key: 'campground', label: 'Evacuation centre', fa: 'fa-campground' },
            { key: 'home', label: 'Shelter / house', fa: 'fa-home' },
            { key: 'warehouse', label: 'Supply depot', fa: 'fa-warehouse' },
            { key: 'tint', label: 'Water supply', fa: 'fa-tint' },
            { key: 'shower', label: 'Sanitation', fa: 'fa-shower' },
        ],
    },
    {
        group: 'Infrastructure',
        icons: [
            { key: 'road', label: 'Road / route', fa: 'fa-road' },
            { key: 'route', label: 'Evacuation route', fa: 'fa-route' },
            { key: 'broadcast-tower', label: 'Communications', fa: 'fa-broadcast-tower' },
            { key: 'plug', label: 'Power / utility', fa: 'fa-plug' },
        ],
    },
    {
        group: 'Vehicles & Rescue',
        icons: [
            { key: 'truck', label: 'Truck', fa: 'fa-truck' },
            { key: 'helicopter', label: 'Helicopter', fa: 'fa-helicopter' },
            { key: 'ship', label: 'Boat', fa: 'fa-ship' },
            { key: 'life-ring', label: 'Rescue', fa: 'fa-life-ring' },
        ],
    },
    {
        group: 'Status',
        icons: [
            { key: 'map-marker-alt', label: 'General marker', fa: 'fa-map-marker-alt' },
            { key: 'flag', label: 'Checkpoint', fa: 'fa-flag' },
            { key: 'check-circle', label: 'Cleared / complete', fa: 'fa-check-circle' },
            { key: 'question-circle', label: 'Unknown / needs check', fa: 'fa-question-circle' },
        ],
    },
];

/** Flat key -> { fa, label } lookup, built once. */
export const MARKER_ICONS_BY_KEY = MARKER_ICON_GROUPS.reduce((acc, g) => {
    g.icons.forEach((i) => { acc[i.key] = i; });
    return acc;
}, {});

export const DEFAULT_MARKER_ICON_KEY = 'map-marker-alt';

/**
 * Preset badge-color swatches for the marker form -- chosen to stay
 * readable with a white icon glyph on top (no light/pastel tones) and to
 * span enough distinct hues for status/severity coding at a glance.
 */
export const MARKER_COLOR_SWATCHES = [
    '#d32f2f', // red
    '#f57c00', // orange
    '#fbc02d', // amber
    '#388e3c', // green
    '#00897b', // teal
    '#1976d2', // blue
    '#3949ab', // indigo
    '#8e24aa', // purple
    '#6d4c41', // brown
    '#455a64', // slate
];

/** Look up the FA class for an icon key, falling back to the default marker glyph. */
export function faClassForIconKey(iconKey) {
    return (MARKER_ICONS_BY_KEY[iconKey] || MARKER_ICONS_BY_KEY[DEFAULT_MARKER_ICON_KEY]).fa;
}

/**
 * Build a circular colored badge with a white Font Awesome glyph -- the
 * marker style used for collaborative-layer markers (deliberately distinct
 * from the teardrop asset/job markers so responders can tell "someone
 * dropped this" apart from tracked assets at a glance).
 */
export function buildMarkerBadgeIcon({ icon, fill }, { size = 28 } = {}) {
    const faClass = faClassForIconKey(icon);
    const bg = fill || '#2b7bbb';
    const html = `<div class="collab-marker-badge" style="background:${bg}"><i class="fas ${faClass}"></i></div>`;

    return L.divIcon({
        className: 'collab-marker-icon',
        html,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
    });
}
