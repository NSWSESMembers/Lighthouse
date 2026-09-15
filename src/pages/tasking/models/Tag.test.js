import { describe, it, expect } from 'vitest';
import { Tag } from './Tag.js';

describe('Tag', () => {
  it('defaults for an empty payload', () => {
    const t = new Tag();
    expect(t.id()).toBeNull();
    expect(t.name()).toBe('');
    expect(t.returnTagText()).toBe('');
  });

  it('returnTagText mirrors name', () => {
    const t = new Tag({ Name: 'Callback' });
    expect(t.returnTagText()).toBe('Callback');
  });

  it('returnTagClass/Icon fall back to the default bucket for an unknown group', () => {
    const t = new Tag({ TagGroupId: 99999 });
    expect(t.returnTagClass()).toBe('label tag tag-default');
    expect(t.returnTagIcon()).toBe('fas fa-tag');
    expect(t.returnTagClassSelected()).toBe('label tag tag-default-selected');
  });

  it('returnTagClass resolves a known group', () => {
    const t = new Tag({ TagGroupId: 27 }); // further action
    expect(t.returnTagClass()).toBe('label tag tag-further-action');
  });

  it('returnTagIcon prefers the id-based override over the group icon', () => {
    const t = new Tag({ Id: 15, TagGroupId: 27 }); // 15 -> SES icon override
    expect(t.returnTagIcon()).toBe('fas fa-carrot');
  });

  it('returnTagIcon falls back to the group icon when there is no override for this id', () => {
    const t = new Tag({ Id: 123456, TagGroupId: 27 });
    expect(t.returnTagIcon()).toBe('fas fa-thumbtack');
  });
});
