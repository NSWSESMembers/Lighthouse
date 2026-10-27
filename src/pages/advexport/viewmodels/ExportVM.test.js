import { describe, it, expect, vi, beforeEach } from 'vitest';
import ko from 'knockout';
import { ExportVM, PREVIEW_ROWS, NO_TOKEN_MS, NO_TOKEN_TEXT } from './ExportVM.js';
import { CHOICES_KEY } from '../data/choices.js';
import { DEFAULT_KEYS } from '../data/fields.js';

const UNIT = { Id: 9001, Code: 'DEM', Name: 'Demo City', ParentEntity: { Code: 'DMZ' } };

function makeJobs(n, icemsEvery = 0) {
  return Array.from({ length: n }, (_, i) => ({
    Id: 1000 + i,
    Identifier: `2610-${1000 + i}`,
    JobReceived: '2026-10-27T08:00:00',
    JobType: { Name: 'Storm' },
    ICEMSIncidentIdentifier: icemsEvery && i % icemsEvery === 0 ? `ICEMS-${i}` : null,
    Tags: [],
    JobStatusTypeHistory: [],
  }));
}

/** A fake Beacon: honours pageSize/pageLimit like requestPaginated. */
function makeClient({ jobs = makeJobs(3) } = {}) {
  const client = {
    jobs,
    unit: { getName: vi.fn(async () => UNIT) },
    job: {
      search: vi.fn(async (scope, start, end, ctx) => {
        const { pageSize = 100, pageLimit = 0 } = ctx;
        const all = client.jobs;
        const rows = pageLimit ? all.slice(0, pageSize * pageLimit) : all;
        if (ctx.onProgress) ctx.onProgress(rows.length, all.length);
        return { results: rows, totalItems: all.length };
      }),
    },
    operationslog: {
      search: vi.fn(async () => ({ results: [{ Subject: 'Incident Update Message' }, { Subject: 'Incident Update Message' }] })),
    },
  };
  return client;
}

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; }, data };
}

const params = {
  host: 'https://beacon.test', source: 'https://beacon.test', userId: '17', hqIds: ['9001'],
  start: new Date('2026-10-26T13:00:00Z'), end: new Date('2026-10-27T12:59:00Z'),
};

function make(opts = {}) {
  const client = opts.client || makeClient();
  const storage = opts.storage || memoryStorage();
  const saveFile = vi.fn();
  let clock = +new Date('2026-10-27T00:00:00Z');
  const vm = new ExportVM({ params: opts.params || params, client, storage, saveFile, now: () => new Date(clock) });
  return { vm, client, storage, saveFile, advance: (ms) => { clock += ms; } };
}

async function loaded(opts) {
  const made = make(opts);
  made.vm.setToken('t');
  await made.vm.load();
  ko.tasks.runEarly();
  return made;
}

const field = (vm, key) => vm.groups.flatMap((g) => g.fields).find((f) => f.key === key);
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ExportVM preview', () => {
  it('asks Beacon for one small page once the token arrives', async () => {
    const { vm, client } = await loaded({ client: makeClient({ jobs: makeJobs(250) }) });
    expect(client.unit.getName).toHaveBeenCalledWith('9001', expect.objectContaining({ token: 't' }));
    expect(client.job.search).toHaveBeenCalledTimes(1);
    const [scope, start, end, ctx] = client.job.search.mock.calls[0];
    expect(scope).toBe(UNIT);
    expect(start).toBe(params.start);
    expect(end).toBe(params.end);
    expect(ctx).toMatchObject({ pageSize: PREVIEW_ROWS, pageLimit: 1 });
    expect(vm.loading()).toBe(false);
    expect(vm.previewJobs()).toHaveLength(PREVIEW_ROWS);
    expect(vm.countText()).toBe('250 incidents');
    expect(vm.downloadText()).toBe('Download CSV (250 incidents)');
    expect(vm.previewNote()).toBe(`Newest ${PREVIEW_ROWS} of 250 incidents. Download CSV fetches them all.`);
    expect(vm.pageTitle()).toBe('Incident Export: Demo City');
  });

  it('re-renders for ticked columns without asking Beacon again', async () => {
    const { vm, client } = await loaded({ client: makeClient({ jobs: makeJobs(15) }) });
    vm.groups.forEach((g) => g.selectNone());
    field(vm, 'Identifier').checked(true);
    field(vm, 'JobReceived').checked(true);
    expect(vm.previewHeader()).toEqual(['Id', 'Received']);
    expect(vm.previewRows()[0].cells.map((c) => c.text)).toEqual(['2610-1000', '2026-10-27T08:00:00+11:00']);
    expect(client.job.search).toHaveBeenCalledTimes(1);
  });

  it('shows the error and tries again on request', async () => {
    const client = makeClient();
    client.job.search.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 503 }));
    const { vm } = await loaded({ client });
    expect(vm.loading()).toBe(true);
    expect(vm.error()).toBe('Beacon returned 503.');
    await vm.retry();
    expect(vm.error()).toBe(null);
    expect(vm.loading()).toBe(false);
  });

  it('keeps the last preview when a reload fails', async () => {
    const { vm, client } = await loaded();
    client.job.search.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 500 }));
    await vm.reload();
    expect(vm.loading()).toBe(false);
    expect(vm.error()).toBe('Beacon returned 500.');
    expect(vm.previewJobs()).toHaveLength(3);
    expect(vm.canDownload()).toBe(true);
  });

  it('refuses a missing date range without asking Beacon', async () => {
    const { vm, client } = await loaded({ params: { ...params, start: new Date(NaN) } });
    expect(vm.error()).toMatch(/valid start and end date/);
    expect(client.job.search).not.toHaveBeenCalled();
  });

  it('says so when no Beacon sign-in arrives', () => {
    const { vm, advance } = make();
    advance(NO_TOKEN_MS - 1000);
    vm.tick();
    expect(vm.error()).toBe(null);
    advance(1000);
    vm.tick();
    expect(vm.error()).toBe(NO_TOKEN_TEXT);
    vm.retry();
    expect(vm.error()).toBe(NO_TOKEN_TEXT);
  });

  it('can\'t download with no incidents', async () => {
    const { vm, saveFile } = await loaded({ client: makeClient({ jobs: [] }) });
    expect(vm.isEmpty()).toBe(true);
    expect(vm.canDownload()).toBe(false);
    await vm.download();
    expect(saveFile).not.toHaveBeenCalled();
  });
});

describe('ExportVM columns', () => {
  it('starts with the defaults, and remembers changes', async () => {
    const { vm, storage } = await loaded();
    expect(vm.selectedKeys()).toEqual(DEFAULT_KEYS);
    expect(vm.isDefaultChoice()).toBe(true);
    field(vm, 'LGA').checked(true);
    ko.tasks.runEarly();
    expect(JSON.parse(storage.data[CHOICES_KEY])).toContain('LGA');
    expect(vm.isDefaultChoice()).toBe(false);
    vm.resetChoices();
    ko.tasks.runEarly();
    expect(vm.selectedKeys()).toEqual(DEFAULT_KEYS);
    expect(storage.data[CHOICES_KEY]).toBeUndefined();
  });

  it('opens with the saved columns', async () => {
    const { vm } = await loaded({ storage: memoryStorage({ [CHOICES_KEY]: JSON.stringify(['Tags', 'Identifier']) }) });
    expect(vm.selectedKeys()).toEqual(['Identifier', 'Tags']);
  });

  it('ticks and clears a whole group; no columns, no download', async () => {
    const { vm } = await loaded();
    const address = vm.groups[1];
    address.selectAll();
    expect(address.allChecked()).toBe(true);
    address.selectNone();
    expect(address.noneChecked()).toBe(true);
    vm.groups.forEach((g) => g.selectNone());
    expect(vm.noneSelected()).toBe(true);
    expect(vm.canDownload()).toBe(false);
    expect(vm.downloadHint()).toMatch(/Tick at least one column/);
  });
});

describe('ExportVM download', () => {
  it('fetches every incident on click, then saves them all', async () => {
    const { vm, client, saveFile } = await loaded({ client: makeClient({ jobs: makeJobs(250) }) });
    vm.groups.forEach((g) => g.selectNone());
    field(vm, 'Identifier').checked(true);
    field(vm, 'JobReceived').checked(true);
    await vm.download();
    expect(client.job.search).toHaveBeenCalledTimes(2);
    const ctx = client.job.search.mock.calls[1][3];
    expect(ctx.pageLimit).toBeUndefined();
    expect(ctx.signal).toBeInstanceOf(AbortSignal);
    const [name, text] = saveFile.mock.calls[0];
    expect(name).toBe('Incident export - Demo City - 2026-10-27 1100.csv');
    const lines = text.trim().split('\n');
    expect(lines[0]).toBe('"Identifier","JobReceived"');
    expect(lines).toHaveLength(251);
    expect(vm.downloading()).toBe(false);
  });

  it('fetches again on every click (the CSV is always current)', async () => {
    const { vm, client, saveFile } = await loaded();
    await vm.download();
    client.jobs = makeJobs(5);
    await vm.download();
    expect(client.job.search).toHaveBeenCalledTimes(3);
    expect(saveFile.mock.calls[1][1].trim().split('\n')).toHaveLength(6);
    expect(vm.countText()).toBe('5 incidents');
  });

  it('keeps the dialog open with the error, and can try again or close', async () => {
    const { vm, client, saveFile } = await loaded();
    client.job.search.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 502 }));
    await vm.download();
    expect(vm.downloading()).toBe(true);
    expect(vm.dlError()).toBe('Beacon returned 502.');
    expect(saveFile).not.toHaveBeenCalled();
    await vm.retryDownload();
    expect(saveFile).toHaveBeenCalledTimes(1);
    expect(vm.downloading()).toBe(false);

    client.job.search.mockRejectedValueOnce(new Error('x'));
    await vm.download();
    vm.cancelDownload();
    expect(vm.downloading()).toBe(false);
    expect(vm.dlError()).toBe(null);
  });

  it('cancel aborts the fetch and saves nothing', async () => {
    const { vm, client, saveFile } = await loaded();
    let release;
    client.job.search.mockImplementationOnce((scope, s, e, ctx) => new Promise((resolve, reject) => {
      release = () => resolve({ results: makeJobs(3), totalItems: 3 });
      ctx.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const p = vm.download();
    expect(vm.downloading()).toBe(true);
    vm.cancelDownload();
    await p;
    release();
    expect(saveFile).not.toHaveBeenCalled();
    expect(vm.downloading()).toBe(false);
    expect(vm.dlError()).toBe(null);
  });
});

describe('ExportVM ICEMS update counts', () => {
  it('counts the preview\'s ICEMS incidents when the column is ticked', async () => {
    const { vm, client } = await loaded({ client: makeClient({ jobs: makeJobs(30, 2) }) });
    expect(client.operationslog.search).not.toHaveBeenCalled();
    field(vm, 'ICEMSIUMTransactions').checked(true);
    ko.tasks.runEarly();
    expect(vm.previewRows()[0].cells.at(-1).text).toBe('…');
    await flush();
    expect(client.operationslog.search).toHaveBeenCalledTimes(5); // 5 of the 10 previewed
    expect(vm.previewRows().slice(0, 4).map((r) => r.cells.at(-1).text)).toEqual(['2', '', '2', '']);
  });

  it('counts every ICEMS incident on download', async () => {
    const storage = memoryStorage({ [CHOICES_KEY]: JSON.stringify(['Identifier', 'ICEMSIUMTransactions']) });
    const { vm, client, saveFile } = await loaded({ storage, client: makeClient({ jobs: makeJobs(30, 2) }) });
    await flush();
    client.operationslog.search.mockClear();
    await vm.download();
    expect(client.operationslog.search).toHaveBeenCalledTimes(15);
    expect(vm.icemsDone()).toBe(15);
    const rows = saveFile.mock.calls[0][1].trim().split('\n');
    expect(rows[1]).toBe('"2610-1000","2"');
    expect(rows[2]).toBe('"2610-1001",""');
  });

  it('notes incidents whose Ops Log could not be read', async () => {
    const client = makeClient({ jobs: makeJobs(2, 1) });
    client.operationslog.search.mockImplementation(async (id) => {
      if (id === 1001) throw new Error('503');
      return { results: [] };
    });
    const storage = memoryStorage({ [CHOICES_KEY]: JSON.stringify(['ICEMSIUMTransactions']) });
    const { vm, saveFile } = await loaded({ storage, client });
    await vm.download();
    expect(vm.icemsText()).toBe("Couldn't read the Ops Log for 1 ICEMS incident: their count is empty in the CSV.");
    expect(saveFile.mock.calls[0][1]).toBe('"ICEMSIUMTransactions"\n"0"\n""\n');
  });
});
