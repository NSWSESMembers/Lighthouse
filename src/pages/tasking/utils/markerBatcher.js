/**
 * markerBatcher.js
 *
 * Reduces layout/reflow thrash on burst map-marker updates: adds/removes are
 * queued and flushed together on the next animation frame rather than
 * applied one at a time. Extracted from main.js's VM(); no `self`/DOM
 * dependency beyond `requestAnimationFrame`.
 */

function getItemId(item) {
    if (!item) return null;
    if (typeof item.id === "function") return item.id();
    return item.id ?? null;
}

/**
 * @param {{addFn: (item: any) => void, removeFn: (item: any) => void}} opts
 * @returns {{scheduleAdd: (item: any) => void, scheduleRemove: (item: any) => void}}
 */
export function createMarkerBatcher({ addFn, removeFn }) {
    const pendingAdds = new Map();
    const pendingRemoves = new Map();
    let rafHandle = null;

    const flush = () => {
        rafHandle = null;

        pendingRemoves.forEach((item) => removeFn(item));
        pendingAdds.forEach((item) => addFn(item));

        pendingRemoves.clear();
        pendingAdds.clear();
    };

    const ensureFlush = () => {
        if (rafHandle == null) {
            rafHandle = requestAnimationFrame(flush);
        }
    };

    const scheduleAdd = (item) => {
        const id = getItemId(item);
        if (id == null) {
            addFn(item);
            return;
        }
        pendingRemoves.delete(id);
        pendingAdds.set(id, item);
        ensureFlush();
    };

    const scheduleRemove = (item) => {
        const id = getItemId(item);
        if (id == null) {
            removeFn(item);
            return;
        }
        pendingAdds.delete(id);
        pendingRemoves.set(id, item);
        ensureFlush();
    };

    return { scheduleAdd, scheduleRemove };
}
