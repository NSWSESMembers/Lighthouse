/*
  The breakdown cards are laid out in one gridstack grid per group: drag a
  card by its header to move it, drag its corner to resize it. Each
  browser remembers its own layout (localStorage); "Reset layout" goes back
  to the default.

  Narrower windows drop to 6 or 1 columns. A layout is saved per column
  count, so arranging the cards in a narrow window doesn't disturb the
  wide layout and vice versa. Only a drag or resize saves: gridstack
  reflowing the cards for a new column count doesn't.

  Stored as { [groupKey]: { [columns]: [{id, x, y, w, h}] } }. An array in
  place of the per-column object (the first format) is the 12-column layout.
*/

import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';

export const STORAGE_KEY = 'lh-statsLayout.v1';
export const COLUMNS = 12;
const CARD_H = 6;
const MIN = { w: 3, h: 4 };

// Narrower grids get fewer columns: 3 cards per row, then 2, then 1.
const CARD_W = { 12: 4, 6: 3, 1: 1 };

/** Column count for a grid this many pixels wide. */
export function columnsForWidth(px) {
  if (px < 700) return 1;
  if (px < 1100) return 6;
  return COLUMNS;
}

/**
 * Cards in list order, filling each row (3, 2 or 1 per row).
 * @param {string[]} ids
 * @param {number} [columns=12]
 * @returns {Array<{id: string, x: number, y: number, w: number, h: number}>}
 */
export function defaultLayout(ids, columns = COLUMNS) {
  const w = CARD_W[columns] || Math.min(4, columns);
  const perRow = Math.max(1, Math.floor(columns / w));
  return ids.map((id, i) => ({
    id,
    x: (i % perRow) * w,
    y: Math.floor(i / perRow) * CARD_H,
    w,
    h: CARD_H,
  }));
}

/** A group's saved items for one column count, or null. */
function savedItems(saved, groupKey, columns) {
  const group = saved?.[groupKey];
  if (Array.isArray(group)) return columns === COLUMNS ? group : null;
  const items = group?.[columns];
  return Array.isArray(items) ? items : null;
}

/**
 * The layout for a group at a column count: the saved one if there is
 * one (keeping only cards that still exist and fit, adding new ones below
 * in their default size), otherwise the default.
 *
 * @param {object|null} saved  everything under STORAGE_KEY
 * @param {string} groupKey
 * @param {string[]} ids  the group's card ids, in default order
 * @param {number} [columns=12]
 */
export function layoutFor(saved, groupKey, ids, columns = COLUMNS) {
  const items = savedItems(saved, groupKey, columns);
  if (!items) return defaultLayout(ids, columns);
  const valid = items.filter((it) => ids.includes(it.id)
    && [it.x, it.y, it.w, it.h].every((n) => Number.isInteger(n) && n >= 0)
    && it.w > 0 && it.h > 0 && it.x + it.w <= columns);
  const known = new Set(valid.map((it) => it.id));
  const bottom = valid.reduce((max, it) => Math.max(max, it.y + it.h), 0);
  const extra = defaultLayout(ids.filter((id) => !known.has(id)), columns).map((it) => ({ ...it, y: it.y + bottom }));
  return [...valid.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })), ...extra];
}

export function readSaved(storage = globalThis.localStorage) {
  try {
    return JSON.parse(storage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function writeSaved(value, storage = globalThis.localStorage) {
  try {
    if (value === null) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private window or storage blocked: the layout just isn't remembered.
  }
}

/** Store one group's layout for one column count. */
function saveGroup(groupKey, columns, items) {
  const all = readSaved() || {};
  const current = all[groupKey];
  const perColumns = Array.isArray(current) ? { [COLUMNS]: current } : { ...(current || {}) };
  perColumns[columns] = items.map(({ id, x, y, w, h }) => ({ id, x, y, w, h }));
  all[groupKey] = perColumns;
  writeSaved(all);
}

/**
 * Make each group's container a grid.
 *
 * The page picks the column count from the grid's width and loads that
 * count's layout itself, rather than using gridstack's own breakpoints:
 * those keep scaled copies of the layout, so what it saved didn't match
 * what it showed.
 *
 * @param {Array<{key: string, elementId: string, ids: string[]}>} groups
 * @returns {{reset: () => void}}
 */
export function initBreakdownLayout(groups) {
  const grids = groups.map((group) => {
    const el = document.getElementById(group.elementId);
    let columns = columnsForWidth(el.clientWidth);
    // Position each card before init, so gridstack doesn't animate them in.
    for (const item of layoutFor(readSaved(), group.key, group.ids, columns)) {
      const card = el.querySelector(`[gs-id="${item.id}"]`);
      if (!card) continue;
      for (const k of ['x', 'y', 'w', 'h']) card.setAttribute(`gs-${k}`, item[k]);
      card.setAttribute('gs-min-w', Math.min(MIN.w, columns));
      card.setAttribute('gs-min-h', MIN.h);
    }
    const grid = GridStack.init({
      column: columns,
      cellHeight: 50,
      margin: 6,
      float: false,
      animate: true,
      draggable: { handle: '.card-header' },
      resizable: { handles: 'se' },
    }, el);

    // Only the user's own moves are saved. Read the nodes rather than
    // grid.save(), which leaves out values it considers defaults (e.g. w).
    grid.on('dragstop resizestop', () => setTimeout(() => saveGroup(group.key, columns, grid.engine.nodes), 0));

    // Window resized across a breakpoint: switch to that width's layout.
    const showColumns = (next) => {
      columns = next;
      grid.batchUpdate();
      grid.column(next, 'none');
      grid.engine.nodes.forEach((n) => { n.minW = Math.min(MIN.w, next); });
      grid.load(layoutFor(readSaved(), group.key, group.ids, next), false);
      grid.batchUpdate(false);
    };
    new ResizeObserver(() => {
      const next = columnsForWidth(el.clientWidth);
      if (next !== columns) showColumns(next);
    }).observe(el);

    return {
      reset: () => grid.load(defaultLayout(group.ids, columns), false),
    };
  });

  return {
    reset() {
      writeSaved(null);
      grids.forEach((g) => g.reset());
    },
  };
}
