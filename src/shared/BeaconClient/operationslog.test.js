import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { search, get, create, unresolvedActionsLog } from './operationslog.js';

vi.mock('./core/request.js', async () => {
  const actual = await vi.importActual('./core/request.js');
  return { ...actual, request: vi.fn() };
});

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset();
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
