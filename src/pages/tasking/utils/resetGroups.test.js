import { describe, it, expect } from 'vitest';
import { RESET_GROUPS, isLadCache, keysToReset } from './resetGroups.js';

const ALL_KEYS = [
  'lh-taskingConfig',
  'lh.layoutPreset', 'lh.layout.default.sidebarWidthPx', 'sidebar.collapsed', 'legendCollapsed',
  'lh-rainRadar.expanded', 'tasking.teamsInViewOnly', 'tasking.incidentsInViewOnly', 'lh_showCapabilities',
  'ov.online-bomRadar', 'ov.matched-assets', 'map.base', 'map.incidentsVisible', 'layers.open', 'layers.section',
  'lh-layerPresets',
  'lh_collabLayer_subscriptions',
  'tasking.assetTrails',
  // caches
  'lh_collabLayers_index', 'lh_collabLayer_l1', 'lh_sharedDefaultAssets', 'lh_sharedDefaultAssets_ts',
  'beacon.ses.nsw.gov.au-LighthouseFetchedRadioAssets', 'beacon.ses.nsw.gov.au-LighthouseFetchedTeleAssets',
  // other pages
  'lh-radio-console-settings', 'lighthouseRadioQuickMessages', 'lh-statsLayout.v1',
  'LighthouseSummaryTheme', 'lh-advexport-fields', 'lh-nitcexport-report',
];
const OTHER_PAGES = ALL_KEYS.slice(-6);

describe('keysToReset', () => {
  it('with every group, clears all of LAD and nothing from other pages', () => {
    const out = keysToReset(ALL_KEYS, RESET_GROUPS.map((g) => g.id));
    expect(out).toEqual(ALL_KEYS.filter((k) => !OTHER_PAGES.includes(k)));
  });

  it('with the default groups, keeps presets, subscriptions and trails', () => {
    const out = keysToReset(ALL_KEYS, RESET_GROUPS.filter((g) => g.checked).map((g) => g.id));
    expect(out).toContain('lh-taskingConfig');
    expect(out).toContain('lh.layout.default.sidebarWidthPx');
    expect(out).toContain('ov.online-bomRadar');
    expect(out).not.toContain('lh-layerPresets');
    expect(out).not.toContain('lh_collabLayer_subscriptions');
    expect(out).not.toContain('tasking.assetTrails');
  });

  it('with no groups, clears only the caches', () => {
    expect(keysToReset(ALL_KEYS, []).every(isLadCache)).toBe(true);
    expect(keysToReset(ALL_KEYS, [])).toHaveLength(6);
  });

  it('only clears the presets when asked', () => {
    expect(keysToReset(ALL_KEYS, ['presets']).filter((k) => !isLadCache(k))).toEqual(['lh-layerPresets']);
  });
});

describe('RESET_GROUPS', () => {
  it('has no key in two groups', () => {
    for (const k of ALL_KEYS) {
      expect(RESET_GROUPS.filter((g) => g.match(k)).length).toBeLessThanOrEqual(1);
    }
  });
});
