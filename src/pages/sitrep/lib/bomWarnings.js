/*
  Current Bureau of Meteorology warnings for NSW/ACT, from BOM's public RSS
  feed (https://www.bom.gov.au/fwo/IDZ00054.warnings_nsw.xml). The feed lists
  only warnings that are current *now*, one item per warning with a title
  ("19/14:02 EST Severe Weather Warning for ..."), a link to the full warning
  and a publish time -- no warning text -- so the sitrep quotes title + link.
  It is state-wide: it can't be narrowed to the selected HQs, so the operator
  trims what isn't relevant.

  Needs the https://www.bom.gov.au/* host permission in the manifest.

  WHY THE EXTRA RULE: from an extension page BOM answers 403. Its edge rejects
  any request carrying an `Origin` header (which `fetch` adds to cross-origin
  requests) and any non-browser User-Agent; the identical request without an
  Origin returns 200. `Origin` can't be dropped from page code, so a
  declarativeNetRequest rule (static/rules/bom-strip-origin.json, declared in the
  manifest with the "declarativeNetRequest" permission) removes it for this one
  URL. If BOM is still refused, Get Data reports it in Data Status.
*/

import { formatSydney } from './sydneyTime.js';

export const BOM_NSW_WARNINGS_URL = 'https://www.bom.gov.au/fwo/IDZ00054.warnings_nsw.xml';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(itemXml, name) {
  const m = itemXml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
}

// The routine marine wind summary is issued for every state all day and isn't
// something a land-based SES sitrep needs; everything else BOM lists is kept.
export function isRelevantWarning(title) {
  return !/marine wind warning summary/i.test(title);
}

/**
 * @param {string} xml  the RSS feed
 * @returns {Array<{title: string, link: string, publishedAt: Date|null}>}  relevant warnings, feed order
 */
export function parseBomWarnings(xml) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  return items
    .map((item) => {
      const published = new Date(tag(item, 'pubDate'));
      return { title: tag(item, 'title'), link: tag(item, 'link'), publishedAt: isNaN(published.getTime()) ? null : published };
    })
    .filter((w) => w.title && isRelevantWarning(w.title));
}

/**
 * @param {typeof fetch} [fetchImpl]
 * @param {AbortSignal} [signal]
 * @returns {Promise<{warnings: ReturnType<typeof parseBomWarnings>, fetchedAt: Date}>}  rejects if BOM can't be reached or answers with something that isn't the feed
 */
export async function fetchBomWarnings(fetchImpl = fetch, signal) {
  // no cookies/referrer: nothing extra for BOM to object to (the Origin header itself is removed by the manifest's DNR rule)
  const response = await fetchImpl(BOM_NSW_WARNINGS_URL, { signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
  if (!response.ok) throw new Error(`BOM responded ${response.status}`);
  const xml = await response.text();
  if (!/<rss[\s>]/i.test(xml)) throw new Error('BOM did not return the warnings feed');
  return { warnings: parseBomWarnings(xml), fetchedAt: new Date() };
}

/**
 * The text written into the sitrep.
 *
 * @param {ReturnType<typeof parseBomWarnings>} warnings
 * @param {Date} asAt
 * @returns {string}
 */
export function buildBomBlock(warnings, asAt) {
  if (warnings.length === 0) return `BOM warnings: none current for NSW/ACT as at ${formatSydney(asAt)}.`;
  const lines = warnings.map((w) => `- ${w.title}${w.link ? ` (${w.link})` : ''}`);
  return [`BOM warnings current for NSW/ACT as at ${formatSydney(asAt)}:`, ...lines].join('\n');
}
