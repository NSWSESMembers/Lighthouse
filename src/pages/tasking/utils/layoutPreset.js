/*
  A LAD layout preset ('map-right-teams-top', 'map-only', ...) as the two
  choices the Configuration screen's Layout tab offers: which side the map
  is on, and how the side drawer shows the lists.
*/

export const LAYOUT_LISTS = ['teams-top', 'tasking-top', 'tabbed', 'teams-only', 'tasking-only'];

/**
 * The layout before anyone picks one (or after Restore Defaults): tabbed on
 * a tablet, where the main pointer is a finger, stacked lists otherwise.
 */
export function defaultLayoutPreset(matchMedia = globalThis.matchMedia) {
    return matchMedia?.('(pointer: coarse)')?.matches ? 'map-right-tabbed' : 'map-right-teams-top';
}

/** 'map-left-tabbed' -> { side: 'left', lists: 'tabbed' }; 'map-only' -> { side: null, lists: 'none' }. */
export function splitLayoutPreset(preset) {
    if (preset === 'map-only') return { side: null, lists: 'none' };
    const m = /^map-(left|right)-(.+)$/.exec(String(preset || ''));
    if (m && LAYOUT_LISTS.includes(m[2])) return { side: m[1], lists: m[2] };
    return { side: 'right', lists: 'teams-top' };
}

/** The inverse: ('left', 'tabbed') -> 'map-left-tabbed'; lists 'none' -> 'map-only'. */
export function joinLayoutPreset(side, lists) {
    if (lists === 'none') return 'map-only';
    return `map-${side === 'left' ? 'left' : 'right'}-${LAYOUT_LISTS.includes(lists) ? lists : 'teams-top'}`;
}
