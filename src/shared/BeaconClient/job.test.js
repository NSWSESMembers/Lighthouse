import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, requestPaginated } from './core/request.js';
import { search, searchRaw, summary, get, getTasking, getHistory, cancel, reopen, reject, acknowledge, complete } from './job.js';

vi.mock('./core/request.js', () => ({ request: vi.fn(), requestPaginated: vi.fn() }));

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };
const start = new Date('2026-01-01T00:00:00.000Z');
const end = new Date('2026-01-02T00:00:00.000Z');

beforeEach(() => {
  vi.mocked(request).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(requestPaginated).mockReset().mockResolvedValue({ results: [], totalItems: 0 });
});

describe('search', () => {
  it('builds a single-Hq URL for a single unit', async () => {
    await search({ Id: 42 }, start, end, ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).toBe(
      'https://beacon.test/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&userId=u1' +
        '&StartDate=2026-01-01T00:00:00.000Z&EndDate=2026-01-02T00:00:00.000Z&Hq=42&ViewModelType=6&SortField=Id&SortOrder=desc',
    );
  });

  it('appends one &Hq= per unit for an array of units', async () => {
    await search([{ Id: 1 }, { Id: 2 }], start, end, ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).toContain('&Hq=1&Hq=2&ViewModelType=6');
  });

  it('omits &Hq= entirely for a null unit', async () => {
    await search(null, start, end, ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).not.toContain('Hq=');
  });

  it('passes pageSize=100 and forwards onProgress/onPage', async () => {
    const onProgress = vi.fn();
    const onPage = vi.fn();
    await search(null, start, end, { ...ctx, onProgress, onPage });
    const [, opts] = vi.mocked(requestPaginated).mock.calls[0];
    expect(opts).toMatchObject({ token: 'tok', pageSize: 100, onProgress, onPage });
  });
});

describe('searchRaw', () => {
  it('appends the raw query string after userId', async () => {
    await searchRaw('StartDate=2026-01-01&EndDate=2026-01-02', ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).toBe(
      'https://beacon.test/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&userId=u1&StartDate=2026-01-01&EndDate=2026-01-02',
    );
  });
});

describe('summary', () => {
  it('builds an EntityIds URL for an array of units and calls request (not paginated)', async () => {
    await summary([{ Id: 1 }, { Id: 2 }], start, end, ctx);
    expect(requestPaginated).not.toHaveBeenCalled();
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toContain('&EntityIds=1&EntityIds=2');
  });
});

describe('get', () => {
  it('defaults viewModelType to 1', async () => {
    await get('job1', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Jobs/job1?LighthouseFunction=GetJobfromBeacon&userId=u1&viewModelType=1');
  });
});

describe('getTasking', () => {
  it('uses the single-id function name for one id', async () => {
    await getTasking('job1', ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).toContain('LighthouseFunction=GetJobTaskingFromBeacon');
    expect(url).toContain('JobIds%5B%5D=job1');
  });

  it('uses the bulk function name and joins ids for an array', async () => {
    await getTasking(['job1', 'job2'], ctx);
    const [url] = vi.mocked(requestPaginated).mock.calls[0];
    expect(url).toContain('LighthouseFunction=GetBulkJobTaskingFromBeacon');
    expect(url).toContain('JobIds%5B%5D=job1&JobIds%5B%5D=job2');
  });
});

describe('getHistory', () => {
  it('requests the job History endpoint', async () => {
    await getHistory('job1', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Jobs/job1/History/?LighthouseFunction=getHistory&userId=u1');
  });
});

describe('job action helpers', () => {
  it('cancel POSTs Text/Date to the Cancel endpoint with responseType none', async () => {
    await cancel('job1', 'cancelled by test', ctx);
    const [url, opts] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Jobs/job1/Cancel?LighthouseFunction=JobCancel&userId=u1');
    expect(opts).toMatchObject({ method: 'POST', responseType: 'none' });
    expect(opts.json.Text).toBe('cancelled by test');
  });

  it('reopen POSTs with no body', async () => {
    await reopen('job1', ctx);
    const [url, opts] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Jobs/job1/Reopen?LighthouseFunction=JobReopen&userId=u1');
    expect(opts.json).toBeUndefined();
  });

  it('reject POSTs Text/Date to the Reject endpoint', async () => {
    await reject('job1', 'bad job', ctx);
    const [url, opts] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Jobs/job1/Reject?LighthouseFunction=JobReject&userId=u1');
    expect(opts.json.Text).toBe('bad job');
  });

  it('acknowledge POSTs with no body', async () => {
    await acknowledge('job1', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Jobs/job1/Acknowledge?LighthouseFunction=JobAcknowledge&userId=u1');
  });

  it('complete sends a form body, not json', async () => {
    await complete('job1', 'done', ctx);
    const [url, opts] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Jobs/job1/Complete?LighthouseFunction=JobComplete&userId=u1');
    expect(opts.form).toContain('Text=done');
    expect(opts.json).toBeUndefined();
  });
});
