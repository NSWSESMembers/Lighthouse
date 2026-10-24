export const escapeHtml = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Formatting tags kept from third-party feed HTML; their attributes are always dropped.
const ALLOWED = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI']);
// Dropped along with everything inside them.
const DROPPED = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'SVG', 'MATH']);

/**
 * Rebuilds free-text HTML from an external feed (e.g. a council's Live
 * Traffic report) as safe markup: text is escaped, simple formatting tags are
 * kept without attributes, links keep only an http(s) href, and anything
 * else is reduced to its text. Parsed with DOMParser, which runs no scripts
 * and loads nothing.
 */
export function sanitizeFeedHtml(html) {
  if (html == null || html === '') return '';
  const doc = new DOMParser().parseFromString(String(html), 'text/html');

  const walk = (node) => {
    let out = '';
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        out += escapeHtml(child.nodeValue);
        return;
      }
      if (child.nodeType !== 1) return;
      const tag = child.tagName.toUpperCase();
      if (DROPPED.has(tag)) return;
      const inner = walk(child);
      if (tag === 'BR') out += '<br>';
      else if (ALLOWED.has(tag)) out += `<${tag.toLowerCase()}>${inner}</${tag.toLowerCase()}>`;
      else if (tag === 'A' && /^https?:\/\//i.test(child.getAttribute('href') || '')) {
        out += `<a href="${escapeHtml(child.getAttribute('href'))}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
      } else out += inner;
    });
    return out;
  };

  return walk(doc.body)
    .replace(/<p>\s*<\/p>/g, '')
    .trim();
}
