import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestPaginated } from './core/request.js';
import { search } from './frao.js';

vi.mock('./core/request.js', () => ({ requestPaginated: vi.fn() }));

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(requestPaginated).mockReset().mockResolvedValue({ results: [], totalItems: 0 });
});

describe('search', () => {
  it('sends the status date range and pages at 50', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-01-02T00:00:00.000Z');
    await search(start, end, ctx);
    const [url, opts] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).toContain('StatusStartDate=2026-01-01T00%3A00%3A00.000Z');
    expect(url).toContain('StatusEndDate=2026-01-02T00%3A00%3A00.000Z');
    expect(opts.pageSize).toBe(50);
  });
});
