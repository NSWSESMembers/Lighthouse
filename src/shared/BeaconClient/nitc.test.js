import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestPaginated } from './core/request.js';
import { search } from './nitc.js';

vi.mock('./core/request.js', () => ({ requestPaginated: vi.fn() }));

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };
const start = new Date('2026-01-01T00:00:00.000Z');
const end = new Date('2026-01-02T00:00:00.000Z');

beforeEach(() => {
  vi.mocked(requestPaginated).mockReset().mockResolvedValue({ results: [], totalItems: 0 });
});

describe('search', () => {
  it('omits filter params that are undefined', async () => {
    await search({}, start, end, ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).not.toContain('EntityIds');
    expect(url).not.toContain('NonIncidentTypeIds');
    expect(url).not.toContain('TagIds');
    expect(url).not.toContain('IncludeCompleted');
    expect(url).toContain('ViewModelType=6&SortField=Start&SortOrder=desc');
  });

  it('splits comma-separated EntityIds into repeated params', async () => {
    await search({ EntityIds: '1,2,3' }, start, end, ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).toContain('EntityIds%5B%5D=1&EntityIds%5B%5D=2&EntityIds%5B%5D=3');
  });

  it('combines EntityIds, NonIncidentTypeIds and TagIds filters without duplicating any of them', async () => {
    await search({ EntityIds: '1', NonIncidentTypeIds: '2', TagIds: '3', IncludeCompleted: 'true' }, start, end, ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    const entityIdsOccurrences = url.split('EntityIds%5B%5D=1').length - 1;
    expect(entityIdsOccurrences).toBe(1);
    expect(url).toContain('NonIncidentTypeIds%5B%5D=2');
    expect(url).toContain('TagIds%5B%5D=3');
    expect(url).toContain('IncludeCompleted=true');
  });
});
