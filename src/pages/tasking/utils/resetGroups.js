// Restore Defaults on the Configuration screen: which localStorage keys
// belong to LAD, grouped so the user can pick what to clear. Every extension
// page shares one localStorage, so anything not matched here (Radio Console,
// Incident Statistics, Summary, the export pages) is never touched.

/**
 * Groups shown as checkboxes, in order. `checked` is the default: settings
 * the user would expect a reset to cover are ticked; things they built or
 * collected themselves are not.
 */
export const RESET_GROUPS = [
  {
    id: 'settings',
    label: 'Configuration settings',
    detail: 'Filters, refresh, map markers, layer order and transparency, pinned teams and incidents',
    checked: true,
    match: (k) => k === 'lh-taskingConfig',
  },
  {
    id: 'layout',
    label: 'Layout',
    detail: 'Page layout and pane sizes, collapsed side drawer and Legend, radar bar, view filters, capability icons',
    checked: true,
    match: (k) => k === 'lh.layoutPreset' || k.startsWith('lh.layout.')
      || ['sidebar.collapsed', 'legendCollapsed', 'lh-rainRadar.expanded',
        'tasking.teamsInViewOnly', 'tasking.incidentsInViewOnly', 'lh_showCapabilities'].includes(k),
  },
  {
    id: 'layers',
    label: 'Map layers',
    detail: 'Which overlays are on, the basemap, incidents shown, the Layers menu',
    checked: true,
    match: (k) => k.startsWith('ov.')
      || ['map.base', 'map.incidentsVisible', 'layers.open', 'layers.section'].includes(k),
  },
  {
    id: 'presets',
    label: 'Layer presets',
    detail: 'Your presets and map preset buttons, back to Weather, Roads and Boundaries',
    checked: false,
    match: (k) => k === 'lh-layerPresets',
  },
  {
    id: 'collab',
    label: 'Collaborative layer subscriptions',
    detail: 'Which shared layers you have subscribed to',
    checked: false,
    match: (k) => k === 'lh_collabLayer_subscriptions',
  },
  {
    id: 'trails',
    label: 'Asset trails',
    detail: 'Recorded asset breadcrumb trails',
    checked: false,
    match: (k) => k === 'tasking.assetTrails',
  },
];

/** Downloaded data LAD refetches by itself, cleared with any reset. */
export function isLadCache(k) {
  return k === 'lh_collabLayers_index'
    || (k.startsWith('lh_collabLayer_') && k !== 'lh_collabLayer_subscriptions')
    || k === 'lh_sharedDefaultAssets' || k === 'lh_sharedDefaultAssets_ts'
    || k.endsWith('-LighthouseFetchedRadioAssets') || k.endsWith('-LighthouseFetchedTeleAssets');
}

/**
 * The keys to remove for the chosen groups, plus LAD's caches.
 * @param {string[]} keys - every key in localStorage
 * @param {Iterable<string>} groupIds
 */
export function keysToReset(keys, groupIds) {
  const groups = RESET_GROUPS.filter((g) => new Set(groupIds).has(g.id));
  return keys.filter((k) => typeof k === 'string'
    && (isLadCache(k) || groups.some((g) => g.match(k))));
}
