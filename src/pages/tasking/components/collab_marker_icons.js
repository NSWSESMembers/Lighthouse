import L from 'leaflet';

/**
 * Curated set of Font Awesome 5 Free icons relevant to emergency-service
 * field marking (hazards/weather, vehicles/rescue, people/animals,
 * resources/supplies, observation/comms, status). Grouped for a scannable
 * picker UI.
 *
 * Every `fa` class here is confirmed present in the bundled
 * @fortawesome/fontawesome-free 5.15.4 solid set -- don't add an icon
 * without checking node_modules/@fortawesome/fontawesome-free/svgs/solid/.
 */
export const MARKER_ICON_GROUPS = [
    {
        group: 'Hazards & Weather',
        icons: [
            { key: 'exclamation-triangle', label: 'Hazard', fa: 'fa-exclamation-triangle' },
            { key: 'fire-alt', label: 'Fire', fa: 'fa-fire-alt' },
            { key: 'cloud-showers-heavy', label: 'Heavy rain', fa: 'fa-cloud-showers-heavy' },
            { key: 'wind', label: 'Storm / high wind', fa: 'fa-wind' },
            { key: 'snowflake', label: 'Snow / ice', fa: 'fa-snowflake' },
            { key: 'water', label: 'Flooding', fa: 'fa-water' },
            { key: 'gas-pump', label: 'Fuel / gas hazard', fa: 'fa-gas-pump' },
        ],
    },
    {
        group: 'Vehicles & Rescue',
        icons: [
            { key: 'ambulance', label: 'Ambulance', fa: 'fa-ambulance' },
            { key: 'car-side', label: 'Car', fa: 'fa-car-side' },
            { key: 'truck-monster', label: '4x4 / off-road truck', fa: 'fa-truck-monster' },
            { key: 'shuttle-van', label: 'Shuttle van', fa: 'fa-shuttle-van' },
            { key: 'helicopter', label: 'Helicopter', fa: 'fa-helicopter' },
            { key: 'ship', label: 'Boat', fa: 'fa-ship' },
            { key: 'plane', label: 'Aircraft', fa: 'fa-plane' },
        ],
    },
    {
        group: 'People & Animals',
        icons: [
            { key: 'users', label: 'Group of people', fa: 'fa-users' },
            { key: 'dog', label: 'Animal / pet', fa: 'fa-dog' },
        ],
    },
    {
        group: 'Resources & Supplies',
        icons: [
            { key: 'utensils', label: 'Food', fa: 'fa-utensils' },
            { key: 'shopping-cart', label: 'Supplies', fa: 'fa-shopping-cart' },
        ],
    },
    {
        group: 'Observation & Comms',
        icons: [
            { key: 'eye', label: 'Observation point', fa: 'fa-eye' },
            { key: 'camera', label: 'Photo evidence', fa: 'fa-camera' },
            { key: 'comments', label: 'Discussion / comments', fa: 'fa-comments' },
        ],
    },
    {
        group: 'Status & Markers',
        icons: [
            { key: 'flag', label: 'Checkpoint', fa: 'fa-flag' },
            { key: 'thumbtack', label: 'Pinned location', fa: 'fa-thumbtack' },
            { key: 'times', label: 'Cancelled / closed', fa: 'fa-times' },
            { key: 'minus-circle', label: 'Unavailable', fa: 'fa-minus-circle' },
            { key: 'question-circle', label: 'Unknown / needs check', fa: 'fa-question-circle' },
        ],
    },
];

/** Flat key -> { fa, label } lookup, built once. */
export const MARKER_ICONS_BY_KEY = MARKER_ICON_GROUPS.reduce((acc, g) => {
    g.icons.forEach((i) => { acc[i.key] = i; });
    return acc;
}, {});

export const DEFAULT_MARKER_ICON_KEY = 'thumbtack';

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
