import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, requestPaginated } from './core/request.js';
import { search, setSector, unSetSector } from './sectors.js';

vi.mock('./core/request.js', () => ({ request: vi.fn(), requestPaginated: vi.fn() }));

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(requestPaginated).mockReset().mockResolvedValue({ results: [], totalItems: 0 });
});

describe('search', () => {
  it('builds a single-EntityIds URL for a single unit', async () => {
    await search({ Id: 5 }, ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).toContain('EntityIds=5');
    expect(url).toContain('Statusids=1');
  });

  it('appends one &EntityIds= per unit for an array', async () => {
    await search([1, 2], ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).toContain('&EntityIds=1&EntityIds=2&Statusids=1');
  });

  it('omits EntityIds entirely for a null unit', async () => {
    await search(null, ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).not.toContain('EntityIds');
  });

  it('pages at 300 per page', async () => {
    await search(null, ctx);
    const [, opts] = vi.mocked(requestPaginated).mock.calls[0];
    expect(opts.pageSize).toBe(300);
  });
});

describe('setSector', () => {
  it('PUTs IdsToAdd for the job', async () => {
    await setSector('job1', 'sector1', ctx);
    const [url, opts] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Sectors/sector1/Jobs?LighthouseFunction=SetSectorForJob');
    expect(opts).toMatchObject({ method: 'PUT', json: { IdsToAdd: ['job1'], userId: 'u1' } });
  });
});

describe('unSetSector', () => {
  it('PUTs to RemoveJobFromSector', async () => {
    await unSetSector('job1', ctx);
    const [url, opts] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Sectors/RemoveJobFromSector/job1?LighthouseFunction=unSetSectorForJob');
    expect(opts).toMatchObject({ method: 'PUT', json: { userId: 'u1' } });
  });
});
