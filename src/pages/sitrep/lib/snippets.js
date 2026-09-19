/*
  Pre-determined content that can be merged into a sitrep section (the +
  button beside each section label). The content itself lives in
  data/sectionSnippets.json.
*/

/**
 * @param {Record<string, Array<{label: string, text: string}>>} data  the parsed JSON
 * @param {string} sectionKey
 * @returns {Array<{label: string, text: string}>}  well-formed entries only
 */
export function snippetsForSection(data, sectionKey) {
  const list = data && Array.isArray(data[sectionKey]) ? data[sectionKey] : [];
  return list.filter((s) => s && typeof s.label === 'string' && typeof s.text === 'string' && s.text.trim());
}

/**
 * Adds `snippetText` to the end of `current` on its own line; a snippet
 * already present verbatim isn't added twice.
 *
 * @param {string} current
 * @param {string} snippetText
 * @returns {string}
 */
export function mergeSnippet(current, snippetText) {
  const add = snippetText.trim();
  const base = current.replace(/\s+$/, '');
  if (base.includes(add)) return current;
  return base ? `${base}\n${add}` : add;
}
