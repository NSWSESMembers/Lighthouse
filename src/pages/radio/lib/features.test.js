import { describe, it, expect } from 'vitest';
import ko from 'knockout';
import { createFeatureRegistry, readFeatureFlags, writeFeatureFlags, FEATURE_FLAGS_STORAGE_KEY } from './features.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}

describe('feature flags storage', () => {
  it('reads back only boolean entries and survives junk', () => {
    expect(readFeatureFlags(fakeStorage({ [FEATURE_FLAGS_STORAGE_KEY]: JSON.stringify({ a: true, b: 'yes', c: false }) }))).toEqual({ a: true, c: false });
    expect(readFeatureFlags(fakeStorage({ [FEATURE_FLAGS_STORAGE_KEY]: 'not json' }))).toEqual({});
    expect(readFeatureFlags(fakeStorage())).toEqual({});
    expect(readFeatureFlags(null)).toEqual({});
  });
  it('does not throw when storage is unavailable', () => {
    expect(() => writeFeatureFlags(null, { a: true })).not.toThrow();
  });
});

describe('createFeatureRegistry', () => {
  it('registers a feature on by default and lists it', () => {
    const registry = createFeatureRegistry({ ko, storage: fakeStorage() });
    const on = registry.register({ key: 'x', label: 'X' });
    expect(on()).toBe(true);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]).toMatchObject({ key: 'x', label: 'X' });
  });
  it('honours defaultEnabled: false and a stored choice over the default', () => {
    const off = createFeatureRegistry({ ko, storage: fakeStorage() }).register({ key: 'x', label: 'X', defaultEnabled: false });
    expect(off()).toBe(false);
    const stored = fakeStorage({ [FEATURE_FLAGS_STORAGE_KEY]: JSON.stringify({ x: false }) });
    expect(createFeatureRegistry({ ko, storage: stored }).register({ key: 'x', label: 'X' })()).toBe(false);
  });
  it('persists a change without disturbing other features', () => {
    const storage = fakeStorage();
    const registry = createFeatureRegistry({ ko, storage });
    const a = registry.register({ key: 'a', label: 'A' });
    const b = registry.register({ key: 'b', label: 'B' });
    a(false);
    b(false);
    b(true);
    expect(JSON.parse(storage.data[FEATURE_FLAGS_STORAGE_KEY])).toEqual({ a: false, b: true });
  });
});
