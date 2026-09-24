import { describe, it, expect } from 'vitest';
import { returnTagClass, returnTagIcon } from './tagFactory.js';

describe('returnTagClass', () => {
  it('resolves a known group', () => {
    expect(returnTagClass(5)).toBe('label tag tag-damage');
    expect(returnTagClass(27)).toBe('label tag tag-further-action');
  });

  it('falls back to the default bucket for an unknown group', () => {
    expect(returnTagClass(99999)).toBe('label tag tag-default');
  });
});

describe('returnTagIcon', () => {
  it('uses the group icon when there is no id override', () => {
    expect(returnTagIcon(27, 99999)).toBe('fas fa-thumbtack');
  });

  it('prefers an id-based override over the group icon', () => {
    expect(returnTagIcon(27, 15)).toBe('fas fa-carrot'); // SES override
  });

  it.each([
    [2, 'fas fa-phone'],
    [10, 'fas fa-piggy-bank'],
    [420, 'fa fa-share-alt'],
  ])('resolves the override for id %i', (id, expected) => {
    expect(returnTagIcon(1, id)).toBe(expected);
  });

  it('falls back to the default group icon for an unknown group with no id override', () => {
    expect(returnTagIcon(99999, 99999)).toBe('fas fa-tag');
  });
});
