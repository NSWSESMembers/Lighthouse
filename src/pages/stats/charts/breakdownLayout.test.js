import { describe, it, expect, vi } from 'vitest';

// The grid itself only runs in the page (stats-docs check.mjs covers it).
vi.mock('gridstack', () => ({ GridStack: {} }));
vi.mock('gridstack/dist/gridstack.min.css', () => ({}));

const { defaultLayout, layoutFor, readSaved, columnsForWidth, STORAGE_KEY, COLUMNS } = await import('./breakdownLayout.js');

describe('defaultLayout', () => {
  it('puts three cards per row across the 12 columns', () => {
    expect(defaultLayout(['a', 'b', 'c', 'd'])).toEqual([
      { id: 'a', x: 0, y: 0, w: 4, h: 6 },
      { id: 'b', x: 4, y: 0, w: 4, h: 6 },
      { id: 'c', x: 8, y: 0, w: 4, h: 6 },
      { id: 'd', x: 0, y: 6, w: 4, h: 6 },
    ]);
    expect(COLUMNS).toBe(12);
  });

  it('puts two per row in 6 columns and one per row in 1', () => {
    expect(defaultLayout(['a', 'b', 'c'], 6)).toEqual([
      { id: 'a', x: 0, y: 0, w: 3, h: 6 },
      { id: 'b', x: 3, y: 0, w: 3, h: 6 },
      { id: 'c', x: 0, y: 6, w: 3, h: 6 },
    ]);
    expect(defaultLayout(['a', 'b'], 1)).toEqual([
      { id: 'a', x: 0, y: 0, w: 1, h: 6 },
      { id: 'b', x: 0, y: 6, w: 1, h: 6 },
    ]);
  });
});

describe('columnsForWidth', () => {
  it('drops to 6 then 1 column as the grid narrows', () => {
    expect(columnsForWidth(1400)).toBe(12);
    expect(columnsForWidth(1100)).toBe(12);
    expect(columnsForWidth(1099)).toBe(6);
    expect(columnsForWidth(700)).toBe(6);
    expect(columnsForWidth(699)).toBe(1);
  });
});

describe('layoutFor', () => {
  const ids = ['a', 'b', 'c'];

  it('uses the default with nothing saved', () => {
    expect(layoutFor(null, 'g', ids)).toEqual(defaultLayout(ids));
    expect(layoutFor({ other: [] }, 'g', ids)).toEqual(defaultLayout(ids));
  });

  it('uses that width\'s default when only another width is saved', () => {
    expect(layoutFor(null, 'g', ids, 6)).toEqual(defaultLayout(ids, 6));
    expect(layoutFor({ g: { 12: defaultLayout(ids) } }, 'g', ids, 6)).toEqual(defaultLayout(ids, 6));
  });

  it('drops saved cards that would stick out of the grid', () => {
    const out = layoutFor({ g: { 6: [{ id: 'a', x: 4, y: 0, w: 4, h: 6 }] } }, 'g', ids, 6);
    expect(out.map((it) => it.id)).toEqual(['a', 'b', 'c']);
    expect(out[0]).toEqual({ id: 'a', x: 0, y: 0, w: 3, h: 6 });
  });

  it('keeps a layout per column count', () => {
    const wide = [{ id: 'a', x: 8, y: 0, w: 4, h: 6 }, { id: 'b', x: 0, y: 0, w: 4, h: 6 }, { id: 'c', x: 4, y: 0, w: 4, h: 6 }];
    const narrow = [{ id: 'a', x: 0, y: 0, w: 6, h: 8 }, { id: 'b', x: 0, y: 8, w: 3, h: 6 }, { id: 'c', x: 3, y: 8, w: 3, h: 6 }];
    const saved = { g: { 12: wide, 6: narrow } };
    expect(layoutFor(saved, 'g', ids)).toEqual(wide);
    expect(layoutFor(saved, 'g', ids, 6)).toEqual(narrow);
  });

  it('reads the first format (a bare array) as the 12-column layout', () => {
    const wide = defaultLayout(['c', 'b', 'a']);
    expect(layoutFor({ g: wide }, 'g', ids)).toEqual(wide);
    expect(layoutFor({ g: wide }, 'g', ids, 6)).toEqual(defaultLayout(ids, 6));
  });

  it('fits new cards into a narrow grid', () => {
    const out = layoutFor({ g: { 1: [{ id: 'a', x: 0, y: 0, w: 1, h: 6 }] } }, 'g', ids, 1);
    expect(out.slice(1).every((it) => it.x === 0 && it.w === 1)).toBe(true);
  });

  it('uses the saved positions and sizes', () => {
    const saved = { g: [{ id: 'b', x: 0, y: 0, w: 12, h: 8 }, { id: 'a', x: 0, y: 8, w: 6, h: 6 }, { id: 'c', x: 6, y: 8, w: 6, h: 6 }] };
    expect(layoutFor(saved, 'g', ids)).toEqual(saved.g);
  });

  it('drops cards that no longer exist and invalid entries', () => {
    const saved = { g: [{ id: 'gone', x: 0, y: 0, w: 4, h: 6 }, { id: 'a', x: -1, y: 0, w: 4, h: 6 }, { id: 'b', x: 0, y: 0, w: 4, h: 6, extra: 1 }] };
    const out = layoutFor(saved, 'g', ids);
    expect(out.map((it) => it.id)).toEqual(['b', 'a', 'c']);
    expect(out[0]).toEqual({ id: 'b', x: 0, y: 0, w: 4, h: 6 });
  });

  it('adds new cards below the saved ones', () => {
    const saved = { g: [{ id: 'a', x: 0, y: 0, w: 12, h: 7 }] };
    expect(layoutFor(saved, 'g', ids).slice(1)).toEqual([
      { id: 'b', x: 0, y: 7, w: 4, h: 6 },
      { id: 'c', x: 4, y: 7, w: 4, h: 6 },
    ]);
  });
});

describe('readSaved', () => {
  it('reads the JSON, and is null for nothing, junk, or blocked storage', () => {
    const store = (v) => ({ getItem: (k) => (k === STORAGE_KEY ? v : null) });
    expect(readSaved(store('{"g":[]}'))).toEqual({ g: [] });
    expect(readSaved(store(null))).toBeNull();
    expect(readSaved(store('{nope'))).toBeNull();
    expect(readSaved({ getItem: () => { throw new Error('blocked'); } })).toBeNull();
  });
});
