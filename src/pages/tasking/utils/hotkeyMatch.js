// Custom-keybinding support for global hotkeys (currently just Spotlight
// Search). A combo is `null` (use the built-in Cmd/Ctrl+K default) or
// `{ key, ctrl, meta, shift, alt }` captured verbatim from a keydown event.

export function isMacPlatform(nav = (typeof navigator !== 'undefined' ? navigator : null)) {
    return !!nav && /Mac|iPod|iPhone|iPad/.test(nav.platform || nav.userAgent || '');
}

/** True if `e` (a keydown event) satisfies `combo`. */
export function matchesHotkeyEvent(combo, e) {
    if (!e) return false;
    const key = (e.key || '').toLowerCase();
    if (!combo) {
        // Default binding: either modifier triggers it, matching the
        // original hardcoded Cmd+K / Ctrl+K behaviour.
        return key === 'k' && (e.metaKey === true || e.ctrlKey === true);
    }
    return key === combo.key
        && e.ctrlKey === !!combo.ctrl
        && e.metaKey === !!combo.meta
        && e.shiftKey === !!combo.shift
        && e.altKey === !!combo.alt;
}

/** Keys that are only ever half of a combo -- wait for the real key. */
export function isModifierKey(key) {
    return ['Control', 'Meta', 'Shift', 'Alt', 'AltGraph', 'OS'].includes(key);
}

export function hasModifier(combo) {
    return !!(combo && (combo.ctrl || combo.meta || combo.alt));
}

/** Builds a combo record from a captured keydown event. */
export function captureComboFromEvent(e) {
    return {
        key: e.key.length === 1 ? e.key.toLowerCase() : e.key,
        ctrl: !!e.ctrlKey,
        meta: !!e.metaKey,
        shift: !!e.shiftKey,
        alt: !!e.altKey,
    };
}

/** Human-readable label, e.g. "⌘K" on Mac or "Ctrl+Shift+K" elsewhere. */
export function formatHotkeyCombo(combo, isMac = isMacPlatform()) {
    if (!combo) return isMac ? '⌘K' : 'Ctrl+K';
    const parts = [];
    if (combo.ctrl) parts.push(isMac ? '⌃' : 'Ctrl');
    if (combo.alt) parts.push(isMac ? '⌥' : 'Alt');
    if (combo.shift) parts.push(isMac ? '⇧' : 'Shift');
    if (combo.meta) parts.push(isMac ? '⌘' : 'Win');
    const keyLabel = combo.key.length === 1 ? combo.key.toUpperCase() : combo.key;
    parts.push(keyLabel);
    return parts.join(isMac ? '' : '+');
}
