import { describe, it, expect } from 'vitest';
import { deriveLayerStatus, summarizeLayerStatuses, layerStatusView, formatClock } from './layerStatus.js';

const at = new Date(2026, 9, 24, 10, 42);
const track = (over = {}) => ({
  on: true,
  fetch: 'done',
  fetchError: null,
  hasData: true,
  updatedAt: at,
  children: new Map(),
  ...over,
});
const child = (over = {}) => ({ kind: 'tiles', pending: false, settled: true, tilesOk: 0, tilesErr: 0, error: null, ...over });

describe('deriveLayerStatus', () => {
  it('is off when the layer is not on the map', () => {
    expect(deriveLayerStatus(track({ on: false }), 5).phase).toBe('off');
    expect(deriveLayerStatus(null, null).phase).toBe('off');
  });

  it('is loading until the first fetch finishes', () => {
    expect(deriveLayerStatus(track({ fetch: 'pending', hasData: false }), 0).phase).toBe('loading');
  });

  it('reports items drawn', () => {
    const s = deriveLayerStatus(track(), 37);
    expect(s).toMatchObject({ phase: 'ok', count: 37 });
  });

  it('separates an empty feed from a failure', () => {
    expect(deriveLayerStatus(track(), 0).phase).toBe('empty');
    const s = deriveLayerStatus(track({ fetch: 'failed', hasData: false, fetchError: 'HTTP 503' }), 0);
    expect(s).toMatchObject({ phase: 'error', error: 'HTTP 503' });
  });

  it('marks a failed refresh as stale and keeps the count', () => {
    const s = deriveLayerStatus(track({ fetch: 'failed', fetchError: 'HTTP 502' }), 12);
    expect(s).toMatchObject({ phase: 'stale', count: 12, error: 'HTTP 502' });
  });

  it('treats a background refresh as still ok', () => {
    const s = deriveLayerStatus(track({ fetch: 'pending' }), 12);
    expect(s).toMatchObject({ phase: 'ok', refreshing: true });
  });

  it('waits for tiles on their first load', () => {
    const children = new Map([[1, child({ pending: true, settled: false })]]);
    expect(deriveLayerStatus(track({ children }), 0).phase).toBe('loading');
  });

  it('does not go back to loading when tiles reload on pan', () => {
    const children = new Map([[1, child({ pending: true, settled: true, tilesOk: 20 })]]);
    expect(deriveLayerStatus(track({ children }), 0)).toMatchObject({ phase: 'ok', refreshing: true });
  });

  it('is ok for a tile-only layer with no items', () => {
    const children = new Map([[1, child({ tilesOk: 24 })]]);
    expect(deriveLayerStatus(track({ children }), 0).phase).toBe('ok');
  });

  it('is partial when some tiles fail', () => {
    const children = new Map([[1, child({ tilesOk: 22, tilesErr: 2 })]]);
    const s = deriveLayerStatus(track({ children }), 0);
    expect(s).toMatchObject({ phase: 'partial', tilesOk: 22, tilesErr: 2 });
    expect(s.error).toBe('2 map tiles failed to load');
  });

  it('is an error when every tile fails', () => {
    const children = new Map([[1, child({ tilesErr: 24 })]]);
    expect(deriveLayerStatus(track({ children }), 0).phase).toBe('error');
  });

  it('is an error when every feature request fails', () => {
    const children = new Map([[1, child({ kind: 'features', error: 'Invalid token' })]]);
    expect(deriveLayerStatus(track({ children }), 0)).toMatchObject({ phase: 'error', error: 'Invalid token' });
  });

  it('is partial when one of several feature layers fails', () => {
    const children = new Map([
      [1, child({ kind: 'features' })],
      [2, child({ kind: 'features', error: 'Timeout' })],
    ]);
    expect(deriveLayerStatus(track({ children }), 4)).toMatchObject({ phase: 'partial', error: 'Timeout', count: 4 });
  });
});

describe('summarizeLayerStatuses', () => {
  it('counts loading and failed layers, ignoring partial', () => {
    const sum = summarizeLayerStatuses([
      { phase: 'off' },
      { phase: 'loading' },
      { phase: 'ok' },
      { phase: 'error' },
      { phase: 'stale' },
      { phase: 'partial' },
    ]);
    expect(sum).toEqual({ on: 5, loading: 1, failed: 2 });
  });
});

describe('layerStatusView', () => {
  it('shows the count for loaded layers', () => {
    const v = layerStatusView({ phase: 'ok', count: 37, updatedAt: at });
    expect(v.pill).toEqual({ cls: 'ok', text: '37' });
    expect(v.title).toBe('37 shown. Updated 10:42');
  });

  it('shows a tick for loaded tile layers', () => {
    expect(layerStatusView({ phase: 'ok', count: 0 }).pill.text).toBe('✓');
  });

  it('explains empty layers', () => {
    const v = layerStatusView({ phase: 'empty', count: 0, updatedAt: at });
    expect(v.pill).toEqual({ cls: 'zero', text: '0' });
    expect(v.detail.text).toBe('Nothing to show right now · 10:42');
  });

  it('offers retry with the reason on failure', () => {
    const v = layerStatusView({ phase: 'error', error: 'HTTP 503' });
    expect(v).toMatchObject({ retry: true, detail: { cls: 'error', text: 'HTTP 503' } });
  });

  it('says how old stale data is', () => {
    const v = layerStatusView({ phase: 'stale', error: 'HTTP 502', updatedAt: at });
    expect(v.detail.text).toBe('Refresh failed, showing data from 10:42');
  });

  it('shows tiles loaded out of total when partial', () => {
    const v = layerStatusView({ phase: 'partial', count: 0, tilesOk: 22, tilesErr: 2, error: '2 map tiles failed to load' });
    expect(v.pill.text).toBe('22/24');
  });

  it('shows nothing when off', () => {
    expect(layerStatusView({ phase: 'off' }).pill).toBeNull();
  });
});

describe('formatClock', () => {
  it('formats HH:MM', () => {
    expect(formatClock(new Date(2026, 0, 1, 7, 5))).toBe('07:05');
    expect(formatClock(null)).toBe('');
  });
});
