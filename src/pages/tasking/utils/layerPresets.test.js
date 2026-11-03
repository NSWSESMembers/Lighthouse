import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PRESETS, MAX_PINNED, MAX_NAME_LENGTH,
  parsePresets, serialisePresets, cleanName, newPresetId,
  presetState, presetToggleChanges, setPinned, missingDefaults, restoreDefaults, isDefaultPresets, listNames,
} from './layerPresets.js';

const preset = (over = {}) => ({ id: 'a', name: 'A', icon: 'fa-bookmark', keys: ['x', 'y'], pinned: false, ...over });
const lookup = (states) => (key) => (key in states ? states[key] : null);

describe('parsePresets', () => {
  it('ships Weather, Roads and Boundaries, all pinned, on first run', () => {
    const list = parsePresets(null);
    expect(list.map((p) => p.name)).toEqual(['Weather', 'Roads', 'Boundaries']);
    expect(list.every((p) => p.pinned)).toBe(true);
    expect(list[0].keys).toEqual(['online-bomSevereThunderstormCells', 'online-bomRadar']);
    expect(list[1].keys).toEqual(['online-transport-cameras', 'online-transport-incidents']);
    expect(list[2].keys).toEqual(['online-sesUnitsZonesHybrid']);
  });

  it('does not share arrays with the shipped presets', () => {
    parsePresets(null)[0].keys.push('z');
    expect(DEFAULT_PRESETS[0].keys).toHaveLength(2);
  });

  it('keeps an empty stored list empty', () => {
    expect(parsePresets('[]')).toEqual([]);
  });

  it('falls back to the shipped presets on bad JSON', () => {
    expect(parsePresets('{nope')).toHaveLength(DEFAULT_PRESETS.length);
    expect(parsePresets('{"a":1}')).toHaveLength(DEFAULT_PRESETS.length);
  });

  it('drops unusable entries and duplicate ids, cleans the rest', () => {
    const list = parsePresets(JSON.stringify([
      null,
      { id: 'a', name: '  ' },
      { id: 'b', name: ' Flood   ops ', icon: 'fa-nope', keys: ['k', 'k', 3, ''] },
      { id: 'b', name: 'Dupe' },
    ]));
    expect(list).toEqual([{ id: 'b', name: 'Flood ops', icon: 'fa-bookmark', keys: ['k'], pinned: false }]);
  });

  it(`keeps at most ${MAX_PINNED} pinned`, () => {
    const list = parsePresets(JSON.stringify(['a', 'b', 'c', 'd'].map((id) => preset({ id, pinned: true }))));
    expect(list.map((p) => p.pinned)).toEqual([true, true, true, false]);
  });

  it('round-trips through serialisePresets', () => {
    const list = [preset(), preset({ id: 'b', pinned: true })];
    expect(parsePresets(serialisePresets(list))).toEqual(list);
  });
});

describe('cleanName', () => {
  it('collapses whitespace and caps the length', () => {
    expect(cleanName('  a  b ')).toBe('a b');
    expect(cleanName('x'.repeat(99))).toHaveLength(MAX_NAME_LENGTH);
    expect(cleanName(undefined)).toBe('');
  });
});

describe('newPresetId', () => {
  it('avoids ids in use', () => {
    const id = newPresetId([], 100);
    expect(newPresetId([preset({ id })], 100)).not.toBe(id);
  });
});

describe('presetState', () => {
  it('is on, partial or off by how many of its layers are on', () => {
    expect(presetState(preset(), lookup({ x: true, y: true })).state).toBe('on');
    expect(presetState(preset(), lookup({ x: true, y: false }))).toEqual({ state: 'partial', on: 1, total: 2 });
    expect(presetState(preset(), lookup({ x: false, y: false })).state).toBe('off');
  });

  it('ignores layers that no longer exist', () => {
    expect(presetState(preset(), lookup({ x: true }))).toEqual({ state: 'on', on: 1, total: 1 });
    expect(presetState(preset(), lookup({})).state).toBe('empty');
  });
});

describe('presetToggleChanges', () => {
  it('turns on the layers that are off when not all are on', () => {
    expect(presetToggleChanges(preset(), lookup({ x: true, y: false }))).toEqual([{ key: 'y', on: true }]);
  });

  it('turns them all off when all are on', () => {
    expect(presetToggleChanges(preset(), lookup({ x: true, y: true })))
      .toEqual([{ key: 'x', on: false }, { key: 'y', on: false }]);
  });

  it('skips layers that no longer exist', () => {
    expect(presetToggleChanges(preset(), lookup({ y: false }))).toEqual([{ key: 'y', on: true }]);
  });
});

describe('setPinned', () => {
  const list = [preset({ id: 'a', pinned: true }), preset({ id: 'b', pinned: true }), preset({ id: 'c', pinned: true }), preset({ id: 'd' })];

  it(`refuses a pin past ${MAX_PINNED}`, () => {
    expect(setPinned(list, 'd', true)).toBe(list);
  });

  it('pins once one is free', () => {
    const next = setPinned(setPinned(list, 'a', false), 'd', true);
    expect(next.map((p) => p.pinned)).toEqual([false, true, true, true]);
  });

  it('allows re-pinning an already pinned preset', () => {
    expect(setPinned(list, 'a', true).map((p) => p.pinned)).toEqual([true, true, true, false]);
  });
});

describe('isDefaultPresets', () => {
  it('is true only for the shipped presets as shipped', () => {
    expect(isDefaultPresets(parsePresets(null))).toBe(true);
    expect(isDefaultPresets(setPinned(parsePresets(null), 'roads', false))).toBe(false);
    expect(isDefaultPresets([])).toBe(false);
  });
});

describe('listNames', () => {
  it('joins names with commas and a final "and"', () => {
    expect(listNames(['A'])).toBe('A');
    expect(listNames(['A', 'B'])).toBe('A and B');
    expect(listNames(['A', 'B', 'C'])).toBe('A, B and C');
  });
});

describe('restoreDefaults', () => {
  it('adds back deleted shipped presets, pinned only while a pin is free', () => {
    const list = [preset({ id: 'mine', pinned: true })];
    expect(missingDefaults(list).map((p) => p.id)).toEqual(['weather', 'roads', 'boundaries']);
    const next = restoreDefaults(list);
    expect(next.map((p) => [p.id, p.pinned])).toEqual([['mine', true], ['weather', true], ['roads', true], ['boundaries', false]]);
    expect(missingDefaults(next)).toEqual([]);
  });
});
