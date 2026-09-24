// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import ko from 'knockout';
import { makePopupNode, resetPopupNode, bindKoToPopup, unbindKoFromPopup, deferPopupUpdate } from './popup_dom_utils.js';

describe('makePopupNode / resetPopupNode', () => {
  it('creates a div with the given class and html, caching the pristine template', () => {
    const el = makePopupNode('<span data-bind="text: name"></span>', 'my-popup');
    expect(el.tagName).toBe('DIV');
    expect(el.className).toBe('my-popup');
    expect(el.innerHTML).toBe('<span data-bind="text: name"></span>');
    expect(el._tpl).toBe('<span data-bind="text: name"></span>');
  });

  it('resetPopupNode restores the innerHTML from the cached template', () => {
    const el = makePopupNode('<span>original</span>', 'x');
    el.innerHTML = '<span>mutated by knockout</span>';
    resetPopupNode(el);
    expect(el.innerHTML).toBe('<span>original</span>');
  });

  it('resetPopupNode is a no-op for a node with no cached template', () => {
    const el = document.createElement('div');
    el.innerHTML = '<span>x</span>';
    expect(() => resetPopupNode(el)).not.toThrow();
    expect(el.innerHTML).toBe('<span>x</span>');
  });

  it('resetPopupNode tolerates a null element', () => {
    expect(() => resetPopupNode(null)).not.toThrow();
  });
});

describe('bindKoToPopup / unbindKoFromPopup', () => {
  it('applies bindings and marks the element as bound', () => {
    const el = makePopupNode('<span data-bind="text: name"></span>', 'x');
    bindKoToPopup(ko, { name: 'Jane' }, el);
    expect(el.__ko_bound__).toBe(true);
    expect(el.textContent).toBe('Jane');
  });

  it('is a no-op when the element is already bound', () => {
    const el = makePopupNode('<span data-bind="text: name"></span>', 'x');
    bindKoToPopup(ko, { name: 'Jane' }, el);
    // Rebinding with different data should NOT apply, since __ko_bound__ guards it.
    expect(() => bindKoToPopup(ko, { name: 'Bob' }, el)).not.toThrow();
    expect(el.textContent).toBe('Jane');
  });

  it('tolerates a null element', () => {
    expect(() => bindKoToPopup(ko, {}, null)).not.toThrow();
  });

  it('resets to the pristine template before binding', () => {
    const el = makePopupNode('<span data-bind="text: name"></span>', 'x');
    el.innerHTML = '<span>stale content from a previous open</span>';
    bindKoToPopup(ko, { name: 'Jane' }, el);
    expect(el.textContent).toBe('Jane');
  });

  it('unbindKoFromPopup cleans the node, clears the flag, and restores the pristine template', () => {
    const el = makePopupNode('<span data-bind="text: name"></span>', 'x');
    bindKoToPopup(ko, { name: 'Jane' }, el);
    unbindKoFromPopup(ko, el);
    expect(el.__ko_bound__).toBeUndefined();
    expect(el.innerHTML).toBe('<span data-bind="text: name"></span>');
  });

  it('unbindKoFromPopup is a no-op when the element was never bound', () => {
    const el = makePopupNode('<span>x</span>', 'x');
    expect(() => unbindKoFromPopup(ko, el)).not.toThrow();
    expect(el.__ko_bound__).toBeUndefined();
  });

  it('unbindKoFromPopup tolerates a null element', () => {
    expect(() => unbindKoFromPopup(ko, null)).not.toThrow();
  });

  it('unbindKoFromPopup still clears state and resets the node if ko.cleanNode throws', () => {
    const el = makePopupNode('<span data-bind="text: name"></span>', 'x');
    bindKoToPopup(ko, { name: 'Jane' }, el);
    const cleanSpy = vi.spyOn(ko, 'cleanNode').mockImplementation(() => { throw new Error('interrupted'); });
    expect(() => unbindKoFromPopup(ko, el)).not.toThrow();
    expect(el.__ko_bound__).toBeUndefined();
    expect(el.innerHTML).toBe('<span data-bind="text: name"></span>');
    cleanSpy.mockRestore();
  });
});

describe('deferPopupUpdate', () => {
  it('is a no-op for a null popup', () => {
    expect(() => deferPopupUpdate(null)).not.toThrow();
  });

  it('calls p.update() via both the microtask and the animation-frame callback', async () => {
    // Stubbing rAF to run synchronously means it actually fires the *second*
    // p.update() call before the microtask's first one -- either way, both
    // paths are exercised, so assert the total count rather than ordering.
    const rafSpy = vi.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => { cb(); return 1; });
    const p = { update: vi.fn() };
    deferPopupUpdate(p);
    expect(p.update).toHaveBeenCalledTimes(1); // the rAF path, run synchronously by the stub
    await Promise.resolve();
    expect(p.update).toHaveBeenCalledTimes(2); // the microtask path
    rafSpy.mockRestore();
  });

  it('tolerates a popup with no update method', async () => {
    const rafSpy = vi.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => { cb(); return 1; });
    expect(() => deferPopupUpdate({})).not.toThrow();
    await Promise.resolve();
    rafSpy.mockRestore();
  });
});
