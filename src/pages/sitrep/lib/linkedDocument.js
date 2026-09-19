/*
  The working sitrep: an editable text that follows a generated "source"
  text (built from the form fields + report) until the operator types into
  it directly. From that point their edits are theirs -- further form
  changes no longer overwrite the text -- until they explicitly reset it to
  the generated version. "Edited" is derived (text differs from source), not
  a flag, so typing the text back to exactly the generated version quietly
  re-links it.
*/

/**
 * @param {object} deps
 * @param {typeof import('knockout')} deps.ko
 * @param {() => string} deps.source  a ko observable/computed of the generated text
 */
export function createLinkedDocument({ ko, source }) {
  const doc = {};
  let lastSynced = source();
  doc.text = ko.observable(lastSynced);

  source.subscribe((next) => {
    // still following the source (untouched since the last sync) -> follow it
    if (doc.text() === lastSynced) doc.text(next);
    lastSynced = next;
  });

  doc.edited = ko.pureComputed(() => doc.text() !== source());

  doc.reset = () => {
    lastSynced = source();
    doc.text(lastSynced);
  };

  return doc;
}
