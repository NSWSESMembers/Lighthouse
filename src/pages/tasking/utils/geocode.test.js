import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AwsLambdaGeocoderProvider } from './geocode.js';

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('AwsLambdaGeocoderProvider', () => {
  it('strips a trailing slash from the endpoint', () => {
    const p = new AwsLambdaGeocoderProvider({ endpoint: 'https://example.com/geocode/' });
    expect(p.endpoint).toBe('https://example.com/geocode');
  });

  it('returns [] for an empty/whitespace-only query without calling fetch', async () => {
    global.fetch = vi.fn();
    const p = new AwsLambdaGeocoderProvider({ endpoint: 'https://example.com/geocode' });
    expect(await p.search({ query: '' })).toEqual([]);
    expect(await p.search({ query: '   ' })).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends the trimmed query as a ?q= param', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));
    const p = new AwsLambdaGeocoderProvider({ endpoint: 'https://example.com/geocode' });
    await p.search({ query: '  123 Main St  ' });
    const [url] = fetch.mock.calls[0];
    expect(new URL(url).searchParams.get('q')).toBe('123 Main St');
  });

  it('maps ALS results to leaflet-geosearch { x, y, label, raw } entries', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      results: [{ Position: [151.2, -33.8], Address: { Label: '1 Main St, Sydney' } }],
    }));
    const p = new AwsLambdaGeocoderProvider({ endpoint: 'https://example.com/geocode' });
    const results = await p.search({ query: 'Main St' });
    expect(results).toEqual([{ x: 151.2, y: -33.8, label: '1 Main St, Sydney', raw: { Position: [151.2, -33.8], Address: { Label: '1 Main St, Sydney' } } }]);
  });

  it('drops results with a missing label or non-finite coordinates', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      results: [
        { Position: [151.2, -33.8], Address: { Label: '' } },
        { Position: ['not-a-number', -33.8], Address: { Label: 'x' } },
        { Position: [151.2, -33.8], Address: { Label: 'Valid' } },
      ],
    }));
    const p = new AwsLambdaGeocoderProvider({ endpoint: 'https://example.com/geocode' });
    const results = await p.search({ query: 'x' });
    expect(results).toHaveLength(1);
    expect(results[0].label).toBe('Valid');
  });

  it('tolerates a non-array/missing results field', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}));
    const p = new AwsLambdaGeocoderProvider({ endpoint: 'https://example.com/geocode' });
    expect(await p.search({ query: 'x' })).toEqual([]);
  });

  it('includes an Authorization header when getToken is given', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));
    const p = new AwsLambdaGeocoderProvider({ endpoint: 'https://example.com/geocode', getToken: async () => 'tok123' });
    await p.search({ query: 'x' });
    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer tok123');
  });

  it('merges custom fetchOptions (including its own headers)', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));
    const p = new AwsLambdaGeocoderProvider({
      endpoint: 'https://example.com/geocode',
      fetchOptions: { credentials: 'omit', headers: { 'X-Custom': '1' } },
    });
    await p.search({ query: 'x' });
    const [, opts] = fetch.mock.calls[0];
    expect(opts.credentials).toBe('omit');
    expect(opts.headers['X-Custom']).toBe('1');
  });

  it('throws with the status and body text on a non-2xx response', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ error: 'boom' }, false, 503));
    const p = new AwsLambdaGeocoderProvider({ endpoint: 'https://example.com/geocode' });
    await expect(p.search({ query: 'x' })).rejects.toThrow(/503/);
  });
});
