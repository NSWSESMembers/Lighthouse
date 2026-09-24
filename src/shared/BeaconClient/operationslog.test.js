import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, requestPaginated } from './core/request.js';
import { search, get, create, resolve, unresolvedActionsLog, searchLog } from './operationslog.js';

vi.mock('./core/request.js', async () => {
  const actual = await vi.importActual('./core/request.js');
  return { ...actual, request: vi.fn(), requestPaginated: vi.fn() };
});

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset();
  vi.mocked(requestPaginated).mockReset().mockResolvedValue({ results: [], totalItems: 0 });
});

describe('search', () => {
  it('requests up to 1000 entries and normalises via toCollection', async () => {
    vi.mocked(request).mockResolvedValue({ Results: [{ Id: 1 }], TotalItems: 1 });
    const result = await search('job1', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toContain('PageIndex=1&PageSize=1000');
    expect(url).toContain('JobIds%5B%5D=job1');
    expect(result).toEqual({ results: [{ Id: 1 }], totalItems: 1 });
  });

  it('tolerates a null body', async () => {
    vi.mocked(request).mockResolvedValue(null);
    const result = await search('job1', ctx);
    expect(result).toEqual({ results: [], totalItems: 0 });
  });
});

describe('get', () => {
  it('requests a single ops-log entry by id', async () => {
    vi.mocked(request).mockResolvedValue({ Id: 5 });
    await get('entry5', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toBe(
      'https://beacon.test/Api/v1/OperationsLog/entry5?LighthouseFunction=GetOperationsLogEntryfromBeacon&userId=u1',
    );
  });
});

describe('create', () => {
  it('POSTs the payload as a form body', async () => {
    await create({ Text: 'note' }, ctx);
    const [url, opts] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/OperationsLog');
    expect(opts).toMatchObject({ method: 'POST', token: 'tok', form: { Text: 'note' } });
  });
});

describe('resolve', () => {
  it('PUTs a form body with the resolution text, defaulting the other fields', async () => {
    await resolve(276535, 'test resolution', ctx);
    const [url, opts] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/OperationsLog/276535/Resolve');
    expect(opts).toMatchObject({
      method: 'PUT',
      token: 'tok',
      form: { Id: 276535, Text: 'test resolution', FurtherActionRequired: false, ActionReminder: '' },
    });
  });

  it('accepts a payload object and lets it override the defaults', async () => {
    await resolve(276535, { Text: 'note', FurtherActionRequired: true }, ctx);
    const [, opts] = vi.mocked(request).mock.calls[0];
    expect(opts).toMatchObject({
      form: { Id: 276535, Text: 'note', FurtherActionRequired: true, ActionReminder: '' },
    });
  });
});

describe('searchLog', () => {
  it('builds an HQ/date-scoped query and delegates pagination to requestPaginated', async () => {
    vi.mocked(requestPaginated).mockResolvedValue({ results: [{ Id: 1 }, { Id: 2 }], totalItems: 2 });

    const result = await searchLog(
      {
        entityIds: [5],
        dateFrom: new Date('2026-01-01T00:00:00.000Z'),
        dateTo: new Date('2026-01-02T00:00:00.000Z'),
      },
      { ...ctx, pageSize: 1 },
    );

    const [url, opts] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).toContain('EntityIds%5B0%5D=5');
    expect(url).toContain('DateFrom=2026-01-01T00%3A00%3A00.000Z');
    expect(url).toContain('DateTo=2026-01-02T00%3A00%3A00.000Z');
    expect(opts.pageSize).toBe(1);
    expect(result).toEqual({ results: [{ Id: 1 }, { Id: 2 }], totalItems: 2 });
  });

  it('includes job/event filters when given', async () => {
    await searchLog({ jobIds: ['job1'], eventIds: ['event1'] }, ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).toContain('JobIds%5B0%5D=job1');
    expect(url).toContain('EventIds%5B0%5D=event1');
  });

  it('includes a tag filter when given', async () => {
    await searchLog({ tagIds: [6, 42] }, ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).toContain('TagIds%5B0%5D=6');
    expect(url).toContain('TagIds%5B1%5D=42');
  });

  it('passes pageLimit/onPage through to requestPaginated for incremental loading', async () => {
    const onPage = vi.fn();
    await searchLog({ entityIds: [5] }, { ...ctx, pageLimit: 1, onPage });
    const [, opts] = vi.mocked(requestPaginated).mock.calls[0];
    expect(opts.pageLimit).toBe(1);
    expect(opts.onPage).toBe(onPage);
  });

  it('omits EntityIds entirely when no HQ/unit is selected -- an unscoped query, not one scoped to nothing', async () => {
    await searchLog({ entityIds: [] }, ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).not.toContain('EntityIds');
  });
});

describe('unresolvedActionsLog', () => {
  it('builds a query from the job and normalises the response', async () => {
    vi.mocked(request).mockResolvedValue({ Results: [{ Id: 9 }], TotalItems: 1 });
    const job = { jobReceived: () => '2026-01-01T00:00:00.000Z', id: () => 'job1' };
    const result = await unresolvedActionsLog(job, ctx);

    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toContain('DateFrom=2026-01-01T00%3A00%3A00.000Z');
    expect(url).toContain('JobIds%5B0%5D=job1');
    expect(url).toContain('UnresolvedActionsOnly=true');
    expect(result).toEqual({ results: [{ Id: 9 }], totalItems: 1 });
  });
});
