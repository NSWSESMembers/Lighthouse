// When to run the catch-up refresh after live updates come back. Every open
// LAD reconnects at once when the hub restarts, so each waits a random moment
// rather than all searching Beacon together. A flapping connection gets one
// refresh per minGapMs, however many times it drops.
export const CATCH_UP_JITTER_MS = 5_000;
export const CATCH_UP_MIN_GAP_MS = 30_000;

export function createCatchUpScheduler(run, { jitterMs = CATCH_UP_JITTER_MS, minGapMs = CATCH_UP_MIN_GAP_MS } = {}) {
    let timer = null;
    let lastRunAt = -Infinity;
    return function request() {
        if (timer) return;
        const delay = Math.max(Math.random() * jitterMs, lastRunAt + minGapMs - Date.now());
        timer = setTimeout(() => {
            timer = null;
            lastRunAt = Date.now();
            run();
        }, delay);
    };
}
