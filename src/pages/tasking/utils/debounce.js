/**
 * Returns a debounced wrapper around `fn`: repeated calls within `ms` of
 * each other collapse into a single call, `ms` after the last one.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
