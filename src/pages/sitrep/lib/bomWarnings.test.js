import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseBomWarnings, isRelevantWarning, fetchBomWarnings, buildBomBlock, BOM_NSW_WARNINGS_URL } from './bomWarnings.js';

const feed = (items) => `<?xml version="1.0"?><rss version="2.0"><channel><title>Weather Warnings for NSW</title>${items}</channel></rss>`;
const item = (title, link, pub = 'Sat, 19 Sep 2026 05:00:13 GMT') => `<item><title>${title}</title><link>${link}</link><pubDate>${pub}</pubDate><guid>${link}</guid></item>`;

describe('parseBomWarnings', () => {
  it('reads title, link and publish time of each warning, ignoring the channel header', () => {
    const w = parseBomWarnings(feed(item('19/14:02 EST Severe Weather Warning for the Hunter', 'http://reg.bom.gov.au/products/IDN21037.shtml')));
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ title: '19/14:02 EST Severe Weather Warning for the Hunter', link: 'http://reg.bom.gov.au/products/IDN21037.shtml' });
    expect(w[0].publishedAt.toISOString()).toBe('2026-09-19T05:00:13.000Z');
  });
  it('collapses titles that wrap over lines and decodes entities', () => {
    const w = parseBomWarnings(feed(item('19/10:46 EST\n\t\t\tFlood Watch &amp; Warning\n\t\t\tfor the Hawkesbury', 'http://x')));
    expect(w[0].title).toBe('19/10:46 EST Flood Watch & Warning for the Hawkesbury');
  });
  it('leaves out the routine marine wind summary but keeps everything else', () => {
    const w = parseBomWarnings(feed(item('19/15:00 EST Marine Wind Warning Summary for New South Wales', 'http://a') + item('19/16:00 EST Flood Warning for the Nepean River', 'http://b')));
    expect(w.map((x) => x.link)).toEqual(['http://b']);
    expect(isRelevantWarning('Marine Wind Warning Summary for Victoria')).toBe(false);
  });
  it('is empty for a feed with no warnings', () => {
    expect(parseBomWarnings(feed(''))).toEqual([]);
  });
});

describe('fetchBomWarnings', () => {
  it('fetches the NSW feed and parses it', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, text: async () => feed(item('Storm', 'http://x')) }));
    const r = await fetchBomWarnings(fetchImpl);
    expect(fetchImpl.mock.calls[0][0]).toBe(BOM_NSW_WARNINGS_URL);
    expect(r.warnings).toHaveLength(1);
    expect(r.fetchedAt).toBeInstanceOf(Date);
  });
  it('rejects on an error status or a non-feed body rather than reporting "no warnings"', async () => {
    await expect(fetchBomWarnings(async () => ({ ok: false, status: 403, text: async () => '' }))).rejects.toThrow('403');
    await expect(fetchBomWarnings(async () => ({ ok: true, status: 200, text: async () => '<html>blocked</html>' }))).rejects.toThrow('not return');
  });
});

describe('buildBomBlock', () => {
  const asAt = new Date('2026-09-19T05:30:00Z');
  it('lists each warning with its link', () => {
    const b = buildBomBlock([{ title: 'Flood Warning for X', link: 'http://l', publishedAt: null }], asAt);
    expect(b.split('\n')).toEqual(['BOM warnings current for NSW/ACT as at 19/09/2026, 15:30 AEST:', '- Flood Warning for X (http://l)']);
  });
  it('says none are current when there are none (a successful empty fetch)', () => {
    expect(buildBomBlock([], asAt)).toContain('none current for NSW/ACT');
  });
});

describe('Origin-stripping rule (BOM returns 403 to requests carrying an Origin header)', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../static/manifest.json'), 'utf8'));
  const ruleset = manifest.declarative_net_request?.rule_resources?.find((r) => r.id === 'bom_strip_origin');

  it('is declared in the manifest with the permissions it needs', () => {
    expect(manifest.permissions).toContain('declarativeNetRequest');
    expect(manifest.host_permissions).toContain('https://www.bom.gov.au/*');
    expect(ruleset).toMatchObject({ enabled: true, path: 'rules/bom-strip-origin.json' });
  });

  it('removes only the Origin request header, and only for the warnings feed URL', () => {
    const rules = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../static', ruleset.path), 'utf8'));
    expect(rules).toHaveLength(1);
    expect(rules[0].action).toEqual({ type: 'modifyHeaders', requestHeaders: [{ header: 'origin', operation: 'remove' }] });
    expect(rules[0].condition.urlFilter).toBe('||' + BOM_NSW_WARNINGS_URL.replace('https://', ''));
    expect(rules[0].condition.resourceTypes).toEqual(['xmlhttprequest']);
  });
});
