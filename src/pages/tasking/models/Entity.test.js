import { describe, it, expect } from 'vitest';
import { Entity } from './Entity.js';

describe('Entity', () => {
  it('defaults every field for an empty payload', () => {
    const e = new Entity();
    expect(e.id()).toBeNull();
    expect(e.code()).toBe('');
    expect(e.name()).toBe('');
    expect(e.latitude()).toBeNull();
    expect(e.longitude()).toBeNull();
    expect(e.parentEntity()).toBeNull();
  });

  it('tolerates an explicit null payload', () => {
    expect(() => new Entity(null)).not.toThrow();
    expect(new Entity(null).id()).toBeNull();
  });

  it('maps fields from the payload', () => {
    const e = new Entity({ Id: 1, Code: 'HQ1', Name: 'Headquarters', Latitude: -33.8, Longitude: 151.2 });
    expect(e.id()).toBe(1);
    expect(e.code()).toBe('HQ1');
    expect(e.name()).toBe('Headquarters');
  });

  it('wraps a nested ParentEntity recursively', () => {
    const e = new Entity({ Id: 1, ParentEntity: { Id: 2, Name: 'Region', ParentEntity: { Id: 3, Name: 'State' } } });
    expect(e.parentEntity().id()).toBe(2);
    expect(e.parentEntity().name()).toBe('Region');
    expect(e.parentEntity().parentEntity().id()).toBe(3);
  });

  it('leaves parentEntity null when ParentEntity is explicitly null', () => {
    const e = new Entity({ Id: 1, ParentEntity: null });
    expect(e.parentEntity()).toBeNull();
  });
});
