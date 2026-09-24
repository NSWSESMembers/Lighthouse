/*
  Turns whatever a failed request threw into one plain sentence an operator can act on.
  The technical detail (status codes, URLs, "Failed to fetch") stays in the console log;
  it is never shown on screen. Pure.
*/

/**
 * @param {unknown} err
 * @returns {string} a sentence ending in a full stop
 */
export function friendlyReason(err) {
  const status = Number(err && err.status);
  if (status) {
    if (status === 401 || status === 403) return "Beacon didn't accept your sign-in or permissions. Reload this page, or sign in to Beacon again.";
    if (status === 404) return "Beacon couldn't find what was asked for.";
    if (status === 408 || status === 429) return 'Beacon is busy right now. Wait a moment and try again.';
    if (status >= 500) return 'Beacon is having problems at the moment. Try again shortly.';
    if (status >= 400) return "Beacon didn't accept the request. Check what you entered and try again.";
  }
  const name = err && err.name;
  const message = String((err && err.message) || err || '');
  if (name === 'AbortError' || name === 'TimeoutError' || /timed? ?out/i.test(message)) return 'Beacon took too long to answer. Check your connection and try again.';
  if (name === 'TypeError' || /failed to fetch|network|load failed/i.test(message)) return "Beacon can't be reached. Check your network connection.";
  return 'Something unexpected went wrong. Try again, and reload the page if it keeps happening.';
}
