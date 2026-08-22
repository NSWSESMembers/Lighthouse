// Whether SignalR push is enabled, per the config-level toggle. Read at
// page load (see main.js) -- toggling it takes effect on next open, since
// tearing down/rebuilding a live connection mid-session isn't wired up.
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
