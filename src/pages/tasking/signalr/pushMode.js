// Whether SignalR push is enabled, per the config-level toggle. Kept in
// sync with the config toggle at runtime (see main.js), which also starts
// or stops the live connection to match.
let enabled = true;

export function setPushModeEnabled(value) {
    enabled = !!value;
}

export function isPushModeEnabled() {
    return enabled;
}

// Cooldown for single-entity on-demand fetches (refreshData/fetchTasking).
// Tighter when push is off, since nothing else is keeping data current
// between explicit fetches.
export function getSingleFetchCooldownMs() {
    return enabled ? 60_000 : 10_000;
}
