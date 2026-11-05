/**
 * arrayChanges.js
 *
 * Knockout's "arrayChange" diffs aren't reliable for the filtered lists in
 * main.js (rate-limited pure computeds, with deferUpdates on):
 *   - an item that only shifted position is reported as a 'deleted' +
 *     'added' pair marked `moved`, and the 'added' half can come first;
 *   - a diff can be taken against a stale previous value, so an item gets
 *     'added' twice, or ends on 'deleted' while it's still in the list.
 * Either way an item that's still listed could lose its map marker and
 * have isFilteredIn go false, so it was never refreshed again.
 *
 * subscribeMembership works out what joined and left by comparing each new
 * value with the last one it handled, so it's right whatever KO reports.
 */

/**
 * Call onChange({ added, removed }) whenever items join or leave `list`.
 * Items already in it when subscribing count as handled.
 * @returns the KO subscription
 */
export function subscribeMembership(list, onChange) {
    let prev = new Set(list.peek() || []);
    return list.subscribe(items => {
        const next = new Set(items || []);
        const added = [];
        const removed = [];
        prev.forEach(x => { if (!next.has(x)) removed.push(x); });
        next.forEach(x => { if (!prev.has(x)) added.push(x); });
        prev = next;
        if (added.length || removed.length) onChange({ added, removed });
    });
}
