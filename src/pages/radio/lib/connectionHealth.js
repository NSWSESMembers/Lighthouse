/*
  Is the console's connection to Beacon lost? Two independent signs:
    - the live feed (SignalR): connected before and not connected for a while
      (or never managed to connect within a longer start-up allowance);
    - the log itself: several list refreshes in a row failed.
  Either one is enough. When the feed isn't expected at all (no SignalR address in the
  page's URL) only the refresh failures count, so a console that never had a live feed
  isn't declared "lost" for that. Pure -- the view model supplies the facts.
*/

export const RECONNECT_GRACE_MS = 10 * 1000; // a brief SignalR reconnect isn't worth a full-page warning
export const FIRST_CONNECT_ALLOWANCE_MS = 30 * 1000; // ...and a slow first connect gets longer
export const REFRESH_FAILURES_LOST = 2; // consecutive failed list loads / polls

/**
 * @param {object} facts
 * @param {boolean} facts.signalrExpected  the page was opened with a live-feed address
 * @param {string} facts.state  'connecting' | 'connected' | 'reconnecting' | 'disconnected'
 * @param {boolean} facts.everConnected  the feed has been connected at least once this page load
 * @param {number|null} facts.notConnectedSinceMs  epoch ms the feed last stopped being connected (null while connected)
 * @param {number} facts.refreshFailures  consecutive failed list loads / polls
 * @param {boolean} [facts.browserOffline]  the browser reports no network (navigator.onLine is false)
 * @param {boolean} [facts.initialLoadFailed]  the first load of the log failed (and nothing has loaded since)
 * @param {number} facts.nowMs
 * @returns {{lost: boolean, reasons: string[]}}
 */
export function assessConnection({ signalrExpected, state, everConnected, notConnectedSinceMs, refreshFailures, initialLoadFailed = false, browserOffline = false, nowMs }) {
  const reasons = [];

  // the browser itself says there is no network: no need to wait for a request or the live feed to notice
  if (browserOffline) {
    reasons.push('This computer is offline.');
  }

  // the very first load failing is enough on its own: there is nothing on screen to fall back on
  if (initialLoadFailed) {
    reasons.push("The log couldn't be loaded from Beacon.");
  }

  if (!initialLoadFailed && refreshFailures >= REFRESH_FAILURES_LOST) {
    reasons.push("The log couldn't be refreshed from Beacon.");
  }

  if (signalrExpected && state !== 'connected' && notConnectedSinceMs != null) {
    const allowance = everConnected ? RECONNECT_GRACE_MS : FIRST_CONNECT_ALLOWANCE_MS;
    if (nowMs - notConnectedSinceMs >= allowance) {
      reasons.push(everConnected ? 'The live feed from Beacon has dropped and is reconnecting.' : "The live feed from Beacon hasn't connected.");
    }
  }

  return { lost: reasons.length > 0, reasons };
}
