import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, requestPaginated, toFormUrlEncoded, toCollection, BeaconApiError } from './request.js';

function mockFetch(response) {
  global.fetch = vi.fn().mockResolvedValue(response);
}

function jsonResponse(status, body, statusText = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => JSON.stringify(body),
  };
}

describe('toFormUrlEncoded', () => {
  it('serialises a plain object', () => {
    expect(toFormUrlEncoded({ a: 1, b: 'x y' })).toBe('a=1&b=x%20y');
  });

  it('emits array values as key[]', () => {
    expect(toFormUrlEncoded({ tags: ['a', 'b'] })).toBe('tags%5B%5D=a&tags%5B%5D=b');
  });

  it('treats null/undefined as empty string', () => {
    expect(toFormUrlEncoded({ a: null, b: undefined })).toBe('a=&b=');
  });
});

describe('toCollection', () => {
  it('normalises a Results/TotalItems payload', () => {
    expect(toCollection({ Results: [1, 2], TotalItems: 2 })).toEqual({ results: [1, 2], totalItems: 2 });
  });

  it('tolerates a bare array', () => {
    expect(toCollection([1, 2, 3])).toEqual({ results: [1, 2, 3], totalItems: 3 });
  });

  it('tolerates a null/empty body', () => {
    expect(toCollection(null)).toEqual({ results: [], totalItems: 0 });
  });
});

describe('request', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a Bearer header when a token is given', async () => {
    mockFetch(jsonResponse(200, { ok: true }));
    await request('https://beacon.test/api/x', { token: 'abc123' });
    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer abc123');
  });

  it('defaults credentials to omit', async () => {
    mockFetch(jsonResponse(200, { ok: true }));
    await request('https://beacon.test/api/x');
    const [, init] = global.fetch.mock.calls[0];
    expect(init.credentials).toBe('omit');
  });

  it('parses a JSON response body', async () => {
    mockFetch(jsonResponse(200, { hello: 'world' }));
    const result = await request('https://beacon.test/api/x');
    expect(result).toEqual({ hello: 'world' });
  });

  it('rejects with a BeaconApiError on a non-2xx response', async () => {
    mockFetch(jsonResponse(500, { message: 'boom' }, 'Internal Server Error'));
    await expect(request('https://beacon.test/api/x')).rejects.toBeInstanceOf(BeaconApiError);
  });

  it('resolves null instead of throwing when nullOnError is set', async () => {
    mockFetch(jsonResponse(500, { message: 'boom' }));
    await expect(request('https://beacon.test/api/x', { nullOnError: true })).resolves.toBeNull();
  });

  it('returns null for a 204 response', async () => {
    mockFetch({ ok: true, status: 204, statusText: '', text: async () => '' });
    await expect(request('https://beacon.test/api/x')).resolves.toBeNull();
  });
});

describe('requestPaginated', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns all results from a single page', async () => {
    mockFetch(jsonResponse(200, { Results: [1, 2, 3], TotalItems: 3 }));
    const result = await requestPaginated('https://beacon.test/api/search');
    expect(result).toEqual({ results: [1, 2, 3], totalItems: 3 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('walks pages until totalItems is reached', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { Results: [1, 2], TotalItems: 5 }))
      .mockResolvedValueOnce(jsonResponse(200, { Results: [3, 4], TotalItems: 5 }))
      .mockResolvedValueOnce(jsonResponse(200, { Results: [5], TotalItems: 5 }));

    const result = await requestPaginated('https://beacon.test/api/search', { pageSize: 2 });
    expect(result).toEqual({ results: [1, 2, 3, 4, 5], totalItems: 5 });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const pageUrls = global.fetch.mock.calls.map(([url]) => url);
    expect(pageUrls).toEqual([
      'https://beacon.test/api/search?PageIndex=1&PageSize=2',
      'https://beacon.test/api/search?PageIndex=2&PageSize=2',
      'https://beacon.test/api/search?PageIndex=3&PageSize=2',
    ]);
  });

  it('stops early once a page comes back empty', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { Results: [1], TotalItems: 5 }))
      .mockResolvedValueOnce(jsonResponse(200, { Results: [], TotalItems: 5 }));

    const result = await requestPaginated('https://beacon.test/api/search');
    expect(result).toEqual({ results: [1], totalItems: 5 });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('stops at pageLimit even if more results remain', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(200, { Results: [1, 2], TotalItems: 10 }));
    const result = await requestPaginated('https://beacon.test/api/search', { pageLimit: 2 });
    expect(result.results).toHaveLength(4);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('calls onPage and onProgress for each page', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { Results: [1, 2], TotalItems: 3 }))
      .mockResolvedValueOnce(jsonResponse(200, { Results: [3], TotalItems: 3 }));

    const onPage = vi.fn();
    const onProgress = vi.fn();
    await requestPaginated('https://beacon.test/api/search', { onPage, onProgress });

    expect(onPage).toHaveBeenNthCalledWith(1, { results: [1, 2], totalItems: 3 });
    expect(onPage).toHaveBeenNthCalledWith(2, { results: [3], totalItems: 3 });
    expect(onProgress).toHaveBeenNthCalledWith(1, 2, 3);
    expect(onProgress).toHaveBeenNthCalledWith(2, 3, 3);
  });

  it('appends PageIndex/PageSize after existing query params', async () => {
    mockFetch(jsonResponse(200, { Results: [], TotalItems: 0 }));
    await requestPaginated('https://beacon.test/api/search?userId=abc');
    expect(global.fetch.mock.calls[0][0]).toBe('https://beacon.test/api/search?userId=abc&PageIndex=1&PageSize=100');
  });
});
