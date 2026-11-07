/**
 * tabDormancy.js
 *
 * Stops a forgotten background tab costing Beacon anything. Once LAD has been
 * hidden this long it goes dormant: timers keep ticking but skip their
 * fetches, and main.js drops the live connection. It stays that way when the
 * tab is shown again, until the user reloads. A shorter hide changes nothing.
 */

export const DORMANT_AFTER_MS = 30 * 60 * 1000;

export function createTabDormancy({ doc = document, now = Date.now, afterMs = DORMANT_AFTER_MS } = {}) {
    let hiddenAt = null;
    let expired = false;
    let timer = null;

    const api = {
        afterMs,
        onDormant: null,
        // Called when a dormant tab is shown again.
        onReturn: null,
        isDormant() {
            return expired || (hiddenAt != null && now() - hiddenAt >= api.afterMs);
        },
        reset() {
            expired = false;
            hiddenAt = null;
        },
    };

    const onHidden = () => {
        hiddenAt ??= now();
        clearTimeout(timer);
        timer = setTimeout(() => api.onDormant?.(), api.afterMs);
    };

    doc.addEventListener('visibilitychange', () => {
        if (doc.visibilityState === 'hidden') {
            onHidden();
            return;
        }
        clearTimeout(timer);
        expired = api.isDormant();
        hiddenAt = null;
        if (expired) api.onReturn?.();
    });
    if (doc.visibilityState === 'hidden') onHidden();

    return api;
}

// A never-dormant stand-in where there's no document (unit tests of code that
// imports this).
export const tabDormancy = typeof document === 'undefined'
    ? { afterMs: DORMANT_AFTER_MS, onDormant: null, onReturn: null, isDormant: () => false, reset() {} }
    : createTabDormancy();
