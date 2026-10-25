// Load status for polling map overlays (Layers drawer rows + the Layers
// button badge). Map.js keeps the raw tracking state per layer; everything
// here is pure so it can be unit tested without Leaflet.
//
// Raw tracking state (`track`):
//   on         - layer group is on the map
//   fetch      - 'idle' | 'pending' | 'done' | 'failed'  (latest fetchFn)
//   fetchError - message from the latest failed fetchFn
//   hasData    - a fetch + draw has succeeded since the layer was turned on
//   updatedAt  - Date of the last successful draw
//   children   - async child layers (WMS/tile layers, Esri feature layers)
//                that keep loading after drawFn returns:
//                { kind: 'tiles'|'features', pending, settled, tilesOk, tilesErr, error }
//
// Derived phases:
//   off      - layer not on the map
//   loading  - nothing to show yet, still fetching
//   ok       - loaded, has items (or tiles)
//   empty    - loaded, the feed had nothing to draw
//   partial  - loaded, but some tiles/feature requests failed
//   stale    - a refresh failed, the last good data is still on the map
//   error    - failed with nothing to show

/**
 * Short user-facing message for a failed fetch or child request. Takes an
 * Error, a string, or an event object -- esri-leaflet's 'requesterror' fires
 * { message, code } and often leaves message undefined.
 */
export function describeLayerError(err) {
  let msg = '';
  if (typeof err === 'string') msg = err;
  else if (err) {
    msg = err.message || err.error?.message || '';
    if (!msg && err.code) msg = `Server error ${err.code}`;
  }
  msg = String(msg).trim() || 'Failed to load';
  if (/failed to fetch|networkerror/i.test(msg)) return 'Network error, check your connection';
  return msg.length > 140 ? msg.slice(0, 137) + '…' : msg;
}

/**
 * @param {object} track - raw tracking state (see above)
 * @param {number|null} count - items drawn (markers, else shapes); null if unknown
 * @returns {{phase: string, count: number|null, error: string|null,
 *   tilesOk: number, tilesErr: number, updatedAt: Date|null, refreshing: boolean}}
 */
export function deriveLayerStatus(track, count) {
  const base = {
    phase: 'off',
    count: null,
    error: null,
    tilesOk: 0,
    tilesErr: 0,
    updatedAt: track?.updatedAt || null,
    refreshing: false,
  };
  if (!track || !track.on) return base;

  if (track.fetch === 'failed') {
    return {
      ...base,
      phase: track.hasData ? 'stale' : 'error',
      count: track.hasData ? count : null,
      error: track.fetchError || 'Failed to load',
    };
  }
  if (!track.hasData) return { ...base, phase: 'loading' };

  const children = track.children ? [...track.children.values()] : [];
  const refreshing = track.fetch === 'pending' || children.some((c) => c.pending);

  // A child that has never finished its first load means the layer has
  // nothing on screen yet (e.g. WMS tiles still downloading).
  if (children.some((c) => c.pending && !c.settled)) {
    return { ...base, phase: 'loading', refreshing };
  }

  const tiles = children.filter((c) => c.kind === 'tiles');
  const tilesOk = tiles.reduce((n, c) => n + (c.tilesOk || 0), 0);
  const tilesErr = tiles.reduce((n, c) => n + (c.tilesErr || 0), 0);
  const childError = children.find((c) => c.error)?.error || null;
  const failedChildren = children.filter(
    (c) => c.error || (c.kind === 'tiles' && c.tilesErr > 0 && !c.tilesOk),
  ).length;

  const out = { ...base, count, tilesOk, tilesErr, refreshing };

  if (children.length && failedChildren === children.length && !count) {
    return { ...out, phase: 'error', error: childError || 'Map tiles failed to load' };
  }
  if (failedChildren || tilesErr) {
    return {
      ...out,
      phase: 'partial',
      error: childError || `${tilesErr} map tile${tilesErr === 1 ? '' : 's'} failed to load`,
    };
  }
  if (!tiles.length && !count) return { ...out, phase: 'empty', count: 0 };
  return { ...out, phase: 'ok' };
}

/**
 * Roll up all layer statuses for the Layers button badge.
 * Partial isn't counted as failed -- the row says what's missing, but the
 * layer is working, so it shouldn't put a red badge on the button.
 */
export function summarizeLayerStatuses(statuses) {
  let loading = 0;
  let failed = 0;
  let on = 0;
  for (const s of statuses) {
    if (!s || s.phase === 'off') continue;
    on++;
    if (s.phase === 'loading') loading++;
    else if (s.phase === 'error' || s.phase === 'stale') failed++;
  }
  return { on, loading, failed };
}

export function formatClock(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * What a drawer row shows for a status: a short pill next to the toggle and
 * an optional line of detail under the label.
 * @returns {{pill: {cls: string, text: string}|null, detail: {cls: string, text: string}|null, retry: boolean, title: string}}
 */
export function layerStatusView(status) {
  const at = formatClock(status?.updatedAt);
  const tilesTotal = (status?.tilesOk || 0) + (status?.tilesErr || 0);
  switch (status?.phase) {
    case 'loading':
      return { pill: { cls: 'loading', text: '' }, detail: null, retry: false, title: 'Loading…' };
    case 'error':
      return {
        pill: { cls: 'error', text: 'failed' },
        detail: { cls: 'error', text: status.error },
        retry: true,
        title: `Failed to load: ${status.error}`,
      };
    case 'stale':
      return {
        pill: { cls: 'warn', text: 'stale' },
        detail: { cls: 'warn', text: `Refresh failed${at ? `, showing data from ${at}` : ''}` },
        retry: true,
        title: `Refresh failed: ${status.error}`,
      };
    case 'partial':
      return {
        pill: {
          cls: 'warn',
          text: status.count ? String(status.count) : tilesTotal ? `${status.tilesOk}/${tilesTotal}` : '!',
        },
        detail: { cls: 'warn', text: status.error },
        retry: true,
        title: `Partly loaded: ${status.error}${at ? `. Updated ${at}` : ''}`,
      };
    case 'empty':
      return {
        pill: { cls: 'zero', text: '0' },
        detail: { cls: 'muted', text: `Nothing to show right now${at ? ` · ${at}` : ''}` },
        retry: false,
        title: `Loaded, nothing to show${at ? `. Updated ${at}` : ''}`,
      };
    case 'ok':
      return {
        pill: { cls: 'ok', text: status.count ? String(status.count) : '✓' },
        detail: null,
        retry: false,
        title: `${status.count ? `${status.count} shown` : 'Loaded'}${at ? `. Updated ${at}` : ''}`,
      };
    default:
      return { pill: null, detail: null, retry: false, title: '' };
  }
}
