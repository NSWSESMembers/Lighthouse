// @vitest-environment jsdom
//
// team.js's search() builds its query string via jQuery's $.param(), which
// needs a real `window` to resolve to the full jQuery object rather than its
// no-op factory stub -- hence jsdom just for this file.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, requestPaginated } from './core/request.js';
import { getTasking, getHistory, get, search, getTeamGeoJson } from './team.js';
import { PAGING_PARAMS_LENGTH } from './core/queryBatches.js';

vi.mock('./core/request.js', () => ({ request: vi.fn(), requestPaginated: vi.fn() }));

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(requestPaginated).mockReset().mockResolvedValue({ results: [], totalItems: 0 });
});

describe('getTasking', () => {
  it('requests tasking for the team, single page', async () => {
    await getTasking('team1', ctx);
    const [url, opts] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).toContain('TeamIds=team1');
    expect(opts.pageSize).toBe(100);
  });
});

describe('getHistory', () => {
  it('caps at pageLimit 1, pageSize 20', async () => {
    await getHistory('team1', ctx);
    const [, opts] = vi.mocked(requestPaginated).mock.calls[0];
    expect(opts).toMatchObject({ pageLimit: 1, pageSize: 20 });
  });
});

describe('get', () => {
  it('defaults viewModelType to 1', async () => {
    await get('team1', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toContain('viewModelType=1');
  });
});

describe('search', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const end = new Date('2026-01-02T00:00:00.000Z');

  it('sets both AssignedToId and CreatedAtId for a single unit', async () => {
    await search({ Id: 5 }, start, end, ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).toContain('AssignedToId=5');
    expect(url).toContain('CreatedAtId=5');
  });

  it('sets both id lists for an array of units', async () => {
    await search([{ Id: 1 }, { Id: 2 }], start, end, ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    // $.param(params, true) is "traditional" serialisation: arrays repeat the
    // flat key rather than using key[]= bracket notation.
    expect(url).toContain('AssignedToId=1');
    expect(url).toContain('AssignedToId=2');
    expect(url).toContain('CreatedAtId=1');
  });

  it('omits AssignedToId/CreatedAtId for a null unit', async () => {
    await search(null, start, end, ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).not.toContain('AssignedToId');
    expect(url).not.toContain('CreatedAtId');
  });

  it('omits TypeIds when not given, includes it when given', async () => {
    await search(null, start, end, ctx);
    let [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).not.toContain('TypeIds');

    vi.mocked(requestPaginated).mockClear();
    await search(null, start, end, { ...ctx, typeIds: [1, 3] });
    [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).toContain('TypeIds=1');
    expect(url).toContain('TypeIds=3');
  });

  it('splits a long unit list across requests and merges the teams', async () => {
    const units = Array.from({ length: 300 }, (_, i) => ({ Id: i + 1 }));
    vi.mocked(requestPaginated).mockImplementation(async (url) =>
      url.includes('AssignedToId=1&') ? { results: [{ Id: 't1' }, { Id: 't2' }], totalItems: 2 } : { results: [{ Id: 't2' }, { Id: 't3' }], totalItems: 2 },
    );
    const found = await search(units, start, end, { ...ctx, typeIds: [1] });
    const urls = vi.mocked(requestPaginated).mock.calls.map(([url]) => url);
    expect(urls.length).toBeGreaterThan(1);
    urls.forEach((url) => {
      expect(url.split('?')[1].length + PAGING_PARAMS_LENGTH).toBeLessThanOrEqual(3800);
      expect(url).toContain('TypeIds=1');
      expect(url).not.toMatch(/&$/);
    });
    const assigned = urls.flatMap((url) => [...url.matchAll(/AssignedToId=(\d+)/g)].map((m) => +m[1]));
    const created = urls.flatMap((url) => [...url.matchAll(/CreatedAtId=(\d+)/g)].map((m) => +m[1]));
    expect(assigned).toEqual(units.map((u) => u.Id));
    expect(created).toEqual(units.map((u) => u.Id));
    expect(found.results.map((t) => t.Id)).toEqual(['t1', 't2', 't3']);
    expect(found.totalItems).toBe(3);
  });

  it('pages at 50', async () => {
    await search(null, start, end, ctx);
    const [, opts] = vi.mocked(requestPaginated).mock.calls[0];
    expect(opts.pageSize).toBe(50);
  });
});

describe('getTeamGeoJson', () => {
  const job = (statusName) => ({
    JobStatusType: { Name: statusName },
    Address: { Longitude: 151.2, Latitude: -33.8 },
    Id: 'job1',
  });

  const taskingRow = (overrides) => ({
    CurrentStatusTime: '2026-01-01T10:00:00.000Z',
    CurrentStatus: 'OnRoute',
    Job: job('Open'),
    Team: { Id: 'team1', Callsign: 'RESCUE1' },
    Onsite: null,
    Offsite: null,
    ...overrides,
  });

  it('emits one feature per team using its most recent non-Tasked/Untasked status', async () => {
    vi.mocked(requestPaginated)
      .mockResolvedValueOnce({ results: [{ Id: 'team1' }], totalItems: 1 }) // team.search
      .mockResolvedValueOnce({
        results: [
          taskingRow({ CurrentStatusTime: '2026-01-01T09:00:00.000Z', CurrentStatus: 'Tasked' }),
          taskingRow({ CurrentStatusTime: '2026-01-01T10:00:00.000Z', CurrentStatus: 'OnRoute' }),
        ],
        totalItems: 2,
      }); // getTasking for team1

    const geoJson = await getTeamGeoJson([], null, null, ctx);

    expect(geoJson.type).toBe('FeatureCollection');
    expect(geoJson.features).toHaveLength(1);
    expect(geoJson.features[0].properties.teamId).toBe('team1');
    expect(geoJson.features[0].geometry.coordinates).toEqual([151.2, -33.8]);
  });

  it('excludes teams whose only tasking is Tasked/Untasked', async () => {
    vi.mocked(requestPaginated)
      .mockResolvedValueOnce({ results: [{ Id: 'team1' }], totalItems: 1 })
      .mockResolvedValueOnce({ results: [taskingRow({ CurrentStatus: 'Tasked' })], totalItems: 1 });

    const geoJson = await getTeamGeoJson([], null, null, ctx);
    expect(geoJson.features).toHaveLength(0);
  });

  it('excludes Complete/Finalised/Cancelled/Rejected jobs when no date range is given', async () => {
    vi.mocked(requestPaginated)
      .mockResolvedValueOnce({ results: [{ Id: 'team1' }], totalItems: 1 })
      .mockResolvedValueOnce({ results: [taskingRow({ Job: job('Complete') })], totalItems: 1 });

    const geoJson = await getTeamGeoJson([], null, null, ctx);
    expect(geoJson.features).toHaveLength(0);
  });

  it('filters by date range instead of job status when start/end are given', async () => {
    vi.mocked(requestPaginated)
      .mockResolvedValueOnce({ results: [{ Id: 'team1' }], totalItems: 1 })
      .mockResolvedValueOnce({
        results: [taskingRow({ Job: job('Complete'), CurrentStatusTime: '2026-01-01T10:00:00.000Z' })],
        totalItems: 1,
      });

    const inRange = await getTeamGeoJson(
      [],
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
      ctx,
    );
    expect(inRange.features).toHaveLength(1); // Complete status is fine when a date range is given

    vi.mocked(requestPaginated).mockReset();
    vi.mocked(requestPaginated)
      .mockResolvedValueOnce({ results: [{ Id: 'team1' }], totalItems: 1 })
      .mockResolvedValueOnce({
        results: [taskingRow({ CurrentStatusTime: '2026-01-01T10:00:00.000Z' })],
        totalItems: 1,
      });

    const outOfRange = await getTeamGeoJson(
      [],
      new Date('2026-02-01T00:00:00.000Z'),
      new Date('2026-02-02T00:00:00.000Z'),
      ctx,
    );
    expect(outOfRange.features).toHaveLength(0);
  });

  it('includes primaryTask when PrimaryTaskType is present', async () => {
    vi.mocked(requestPaginated)
      .mockResolvedValueOnce({ results: [{ Id: 'team1' }], totalItems: 1 })
      .mockResolvedValueOnce({
        results: [taskingRow({ PrimaryTaskType: { Name: 'Rescue' } })],
        totalItems: 1,
      });

    const geoJson = await getTeamGeoJson([], null, null, ctx);
    expect(geoJson.features[0].properties.primaryTask).toBe('Rescue');
  });
});
