import { describe, it, expect } from 'vitest';
import ko from 'knockout';
import { createLinkedDocument } from './linkedDocument.js';

function setup() {
  const input = ko.observable('a');
  const source = ko.pureComputed(() => `doc:${input()}`);
  const doc = createLinkedDocument({ ko, source });
  return { input, doc };
}

describe('createLinkedDocument', () => {
  it('starts as the source text and follows it while untouched', () => {
    const { input, doc } = setup();
    expect(doc.text()).toBe('doc:a');
    input('b');
    expect(doc.text()).toBe('doc:b');
    expect(doc.edited()).toBe(false);
  });

  it('stops following the source once the operator edits the text, and flags it as edited', () => {
    const { input, doc } = setup();
    doc.text('doc:a plus my note');
    input('b');
    expect(doc.text()).toBe('doc:a plus my note');
    expect(doc.edited()).toBe(true);
  });

  it('reset() discards manual edits and resumes following', () => {
    const { input, doc } = setup();
    doc.text('mine');
    input('b');
    doc.reset();
    expect(doc.text()).toBe('doc:b');
    expect(doc.edited()).toBe(false);
    input('c');
    expect(doc.text()).toBe('doc:c');
  });

  it('typing the text back to exactly the generated version re-links it', () => {
    const { input, doc } = setup();
    doc.text('mine');
    doc.text('doc:a');
    input('b');
    expect(doc.text()).toBe('doc:b');
  });
});
