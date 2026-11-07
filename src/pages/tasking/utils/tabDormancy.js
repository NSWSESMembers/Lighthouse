/**
 * tabDormancy.js
 *
 * Stops a forgotten background tab costing Beacon anything. Once LAD has been
 * hidden this long it goes dormant: timers keep ticking but skip their
 * fetches, and main.js drops the live connection. It wakes by itself when the
 * tab is shown again. A shorter hide changes nothing at all.
 */

export const DORMANT_AFTER_MS = 30 * 60 * 1000;

export function createTabDormancy({ doc = document, now = Date.now, afterMs = DORMANT_AFTER_MS } = {}) {
    let hiddenAt = null;
    let timer = null;

    const api = {
        afterMs,
        onDormant: null,
        // Called with how long the tab was away.
        onWake: null,
        isDormant() {
            return hiddenAt != null && now() - hiddenAt >= api.afterMs;
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
        const wasDormant = api.isDormant();
        const awayMs = hiddenAt == null ? 0 : now() - hiddenAt;
        hiddenAt = null;
        if (wasDormant) api.onWake?.(awayMs);
    });
    if (doc.visibilityState === 'hidden') onHidden();

    return api;
}

// A never-dormant stand-in where there's no document (unit tests of code that
// imports this).
export const tabDormancy = typeof document === 'undefined'
    ? { afterMs: DORMANT_AFTER_MS, onDormant: null, onWake: null, isDormant: () => false }
    : createTabDormancy();
