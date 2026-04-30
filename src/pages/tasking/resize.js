
export function ResizeDividers(map) {

// ===== Elements =====
const appEl      = document.querySelector('.app');
const sidebarEl  = document.querySelector('.sidebar');
const vsplitEl   = document.getElementById('vsplit');

const paneTopEl  = document.getElementById('paneTop');
const paneBottomEl = document.getElementById('paneBottom');
const hsplitEl   = document.getElementById('hsplit');

const LAYOUT_PRESETS = [
  'map-right-teams-top',
  'map-right-tasking-top',
  'map-left-teams-top',
  'map-left-tasking-top',
  'map-right-teams-only',
  'map-right-tasking-only',
  'map-left-teams-only',
  'map-left-tasking-only',
  'map-only'
];
const DEFAULT_LAYOUT_PRESET = 'map-right-teams-top';
const normalizeLayoutPreset = (value) => {
  const key = String(value || '').trim();
  return LAYOUT_PRESETS.includes(key) ? key : DEFAULT_LAYOUT_PRESET;
};

// Leaflet map instance must exist; guard invalidateSize calls
// eslint-disable-next-line no-empty
function invalidateMap() { try { map.invalidateSize(); } catch(_) {} }

let currentLayoutPreset = normalizeLayoutPreset(localStorage.getItem('lh.layoutPreset'));

function layoutStorageKey(suffix) {
  return `lh.layout.${currentLayoutPreset}.${suffix}`;
}

function applyLayoutPresetClass(preset) {
  const normalized = normalizeLayoutPreset(preset);
  currentLayoutPreset = normalized;
  LAYOUT_PRESETS.forEach(layout => appEl.classList.remove(`layout-${layout}`));
  appEl.classList.add(`layout-${normalized}`);
  localStorage.setItem('lh.layoutPreset', normalized);
}

function topPaneForCurrentLayout() {
  if (currentLayoutPreset.endsWith('tasking-top') || currentLayoutPreset.endsWith('tasking-only')) {
    return paneBottomEl;
  }
  return paneTopEl;
}

function resetPaneHeights() {
  paneTopEl.style.height = '';
  paneBottomEl.style.height = '';
}

// ===== Restore persisted sizes on load =====
function restoreSizes() {
  resetPaneHeights();

  // Left↔Right
  const savedSidebarPx = Number(localStorage.getItem(layoutStorageKey('sidebarWidthPx'))) || 800;
  if (Number.isFinite(savedSidebarPx) && savedSidebarPx > 0) {
    sidebarEl.style.width = savedSidebarPx + 'px';
    appEl.style.setProperty('--sidebar-w', savedSidebarPx + 'px');
  }

  // Top↔Bottom
  const savedTopPx = Number(localStorage.getItem(layoutStorageKey('paneTopHeightPx')) || 500);
  if (Number.isFinite(savedTopPx) && savedTopPx > 0) {
    topPaneForCurrentLayout().style.height = savedTopPx + 'px';
    appEl.style.setProperty('--pane-top-h', savedTopPx + 'px');
  }

  // Let layout settle then fix map size
  setTimeout(invalidateMap, 0);
}

applyLayoutPresetClass(currentLayoutPreset);
restoreSizes();

// ===== Left↔Right (vertical splitter) =====
let resizingLR = false, rafLR = 0;

function applyLR(clientX) {
  const appRect = appEl.getBoundingClientRect();
  const splitW  = vsplitEl.getBoundingClientRect().width;
  const minSidebar = 260;
  const minMap     = 260;
  const maxSidebar = Math.min(appRect.width - splitW - minMap, appRect.width * 0.7);

  let w = clientX - appRect.left;
  w = Math.max(minSidebar, Math.min(maxSidebar, w));

  sidebarEl.style.width = w + 'px';
  appEl.style.setProperty('--sidebar-w', w + 'px');

  const mapW = appRect.width - w - splitW;
  localStorage.setItem(layoutStorageKey('sidebarWidthPx'), String(w));
  localStorage.setItem(layoutStorageKey('mapWidthPx'), String(Math.max(0, Math.floor(mapW))));
}

function startLR() { resizingLR = true; vsplitEl.classList.add('resizing'); document.body.style.cursor = 'col-resize'; }
function moveLR(x) {
  if (!resizingLR) return;
  if (rafLR) return;
  rafLR = requestAnimationFrame(() => { rafLR = 0; applyLR(x); invalidateMap(); });
}
function endLR() { if (!resizingLR) return; resizingLR = false; vsplitEl.classList.remove('resizing'); document.body.style.cursor=''; invalidateMap(); }

if (vsplitEl) {
  vsplitEl.addEventListener('mousedown', e => { e.preventDefault(); startLR(); });
  window.addEventListener('mousemove', e => moveLR(e.clientX));
  window.addEventListener('mouseup', endLR);

  vsplitEl.addEventListener('touchstart', e => { e.preventDefault(); startLR(); }, { passive:false });
  window.addEventListener('touchmove', e => { const t=e.touches?.[0]; if (t) moveLR(t.clientX); }, { passive:false });
  window.addEventListener('touchend', endLR);
}

// ===== Top↔Bottom (horizontal splitter) =====
let resizingTB = false, rafTB = 0;

function applyTB(clientY) {
  const sbRect = sidebarEl.getBoundingClientRect();
  const splitH = hsplitEl.getBoundingClientRect().height;
  const minTop = 120, minBot = 120;

  const total = sbRect.height;
  let topH = clientY - sbRect.top;
  topH = Math.max(minTop, Math.min(topH, total - splitH - minBot));

  paneTopEl.style.height = topH + 'px';
  appEl.style.setProperty('--pane-top-h', topH + 'px');

  const botH = Math.max(minBot, total - splitH - topH);
  localStorage.setItem(layoutStorageKey('paneTopHeightPx'), String(Math.floor(topH)));
  localStorage.setItem(layoutStorageKey('paneBottomHeightPx'), String(Math.floor(botH)));
}

function startTB() { resizingTB = true; hsplitEl.classList.add('resizing'); document.body.style.cursor = 'row-resize'; }
function moveTB(y) {
  if (!resizingTB) return;
  if (rafTB) return;
  rafTB = requestAnimationFrame(() => { rafTB = 0; applyTB(y); /* map not required here */ });
}
function endTB() { if (!resizingTB) return; resizingTB = false; hsplitEl.classList.remove('resizing'); document.body.style.cursor=''; }

if (hsplitEl) {
  hsplitEl.addEventListener('mousedown', e => { e.preventDefault(); startTB(); });
  window.addEventListener('mousemove', e => moveTB(e.clientY));
  window.addEventListener('mouseup', endTB);

  hsplitEl.addEventListener('touchstart', e => { e.preventDefault(); startTB(); }, { passive:false });
  window.addEventListener('touchmove', e => { const t=e.touches?.[0]; if (t) moveTB(t.clientY); }, { passive:false });
  window.addEventListener('touchend', endTB);
}

// ===== Clamp on window resize so saved sizes remain valid =====
window.addEventListener('resize', () => {
  // Clamp sidebar width
  const appRect = appEl.getBoundingClientRect();
  const splitW  = vsplitEl.getBoundingClientRect().width;
  const minSidebar = 260, minMap = 260;
  const maxSidebar = Math.min(appRect.width - splitW - minMap, appRect.width * 0.7);
  const savedW = Number(localStorage.getItem(layoutStorageKey('sidebarWidthPx'))) || sidebarEl.getBoundingClientRect().width;
  if (Number.isFinite(savedW) && savedW > 0) {
    const clamped = Math.max(minSidebar, Math.min(savedW, maxSidebar));
    sidebarEl.style.width = clamped + 'px';
    appEl.style.setProperty('--sidebar-w', clamped + 'px');
  }

  // Clamp top pane height
  const sbRect = sidebarEl.getBoundingClientRect();
  const splitH = hsplitEl.getBoundingClientRect().height;
  const minTop = 120, minBot = 120;
  const maxTop = Math.max(minTop, sbRect.height - splitH - minBot);
  const topPaneEl = topPaneForCurrentLayout();
  const savedTop = Number(localStorage.getItem(layoutStorageKey('paneTopHeightPx'))) || topPaneEl.getBoundingClientRect().height;
  if (Number.isFinite(savedTop) && savedTop > 0) {
    const clampedTop = Math.max(minTop, Math.min(savedTop, maxTop));
    topPaneEl.style.height = clampedTop + 'px';
    appEl.style.setProperty('--pane-top-h', clampedTop + 'px');
  }

  // Map may need a relayout after width changes
  setTimeout(invalidateMap, 0);
});

window.addEventListener('lh:layoutPresetChanged', (event) => {
  const nextPreset = normalizeLayoutPreset(event?.detail?.preset);
  applyLayoutPresetClass(nextPreset);
  restoreSizes();
});
}