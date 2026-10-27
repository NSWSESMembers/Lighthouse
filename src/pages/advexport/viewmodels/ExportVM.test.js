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

function makeClient({ jobs = makeJobs(3), fail = null } = {}) {
  return {
    unit: { getName: vi.fn(async () => UNIT) },
    job: {
      search: vi.fn(async (scope, start, end, ctx) => {
        if (fail) throw fail;
        ctx.onProgress && ctx.onProgress(jobs.length, jobs.length);
        return { results: jobs, totalItems: jobs.length };
      }),
    },
    operationslog: {
      search: vi.fn(async () => ({ results: [{ Subject: 'Incident Update Message' }, { Subject: 'Incident Update Message' }] })),
    },
  };
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

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ExportVM loading', () => {
  it('loads once the token arrives, with the HQ looked up', async () => {
    const { vm, client } = await loaded();
    expect(client.unit.getName).toHaveBeenCalledWith('9001', expect.objectContaining({ token: 't' }));
    const [scope, start, end] = client.job.search.mock.calls[0];
    expect(scope).toBe(UNIT);
    expect(start).toBe(params.start);
    expect(end).toBe(params.end);
    expect(vm.loading()).toBe(false);
    expect(vm.pageTitle()).toBe('Incident Export: Demo City');
    expect(vm.countText()).toBe('3 incidents');
  });

  it('shows the error and tries again on request', async () => {
    const client = makeClient({ fail: Object.assign(new Error('x'), { status: 503 }) });
    const { vm } = await loaded({ client });
    expect(vm.loading()).toBe(true);
    expect(vm.error()).toBe('Beacon returned 503.');
    client.job.search.mockImplementation(async () => ({ results: makeJobs(2) }));
    await vm.retry();
    expect(vm.error()).toBe(null);
    expect(vm.loading()).toBe(false);
    expect(vm.jobs()).toHaveLength(2);
  });

  it('keeps the last incidents when a reload fails', async () => {
    const { vm, client } = await loaded();
    client.job.search.mockImplementation(async () => { throw Object.assign(new Error('x'), { status: 500 }); });
    await vm.reload();
    expect(vm.loading()).toBe(false);
    expect(vm.error()).toBe('Beacon returned 500.');
    expect(vm.jobs()).toHaveLength(3);
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

  it('ticks and clears a whole group', async () => {
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

describe('ExportVM preview and download', () => {
  it('previews the first rows with labels, all rows go in the CSV', async () => {
    const { vm, saveFile } = await loaded({ client: makeClient({ jobs: makeJobs(PREVIEW_ROWS + 5) }) });
    vm.groups.forEach((g) => g.selectNone());
    field(vm, 'Identifier').checked(true);
    field(vm, 'JobReceived').checked(true);
    expect(vm.previewHeader()).toEqual(['Id', 'Received']);
    expect(vm.previewRows()).toHaveLength(PREVIEW_ROWS);
    expect(vm.previewRows()[0].cells.map((c) => c.text)).toEqual(['2610-1000', '2026-10-27T08:00:00+11:00']);
    expect(vm.previewNote()).toBe(`First ${PREVIEW_ROWS} of 15 incidents. The download has them all.`);

    await vm.download();
    const [name, text] = saveFile.mock.calls[0];
    expect(name).toBe('Incident export - Demo City - 2026-10-27 1100.csv');
    const lines = text.trim().split('\n');
    expect(lines[0]).toBe('"Identifier","JobReceived"');
    expect(lines).toHaveLength(16);
  });

  it('can\'t download with no incidents', async () => {
    const { vm, saveFile } = await loaded({ client: makeClient({ jobs: [] }) });
    expect(vm.isEmpty()).toBe(true);
    expect(vm.canDownload()).toBe(false);
    await vm.download();
    expect(saveFile).not.toHaveBeenCalled();
  });
});

describe('ExportVM ICEMS update counts', () => {
  it('only counts when the column is ticked, and only ICEMS incidents', async () => {
    const { vm, client } = await loaded({ client: makeClient({ jobs: makeJobs(6, 2) }) });
    expect(client.operationslog.search).not.toHaveBeenCalled();
    field(vm, 'ICEMSIUMTransactions').checked(true);
    ko.tasks.runEarly();
    expect(vm.icemsCounting()).toBe(true);
    expect(vm.canDownload()).toBe(false);
    expect(vm.previewRows()[0].cells.at(-1).text).toBe('…');
    await vm.countIcems();
    ko.tasks.runEarly();
    expect(client.operationslog.search).toHaveBeenCalledTimes(3);
    expect(vm.icemsCounting()).toBe(false);
    expect(vm.canDownload()).toBe(true);
    const cells = vm.previewRows().map((r) => r.cells.at(-1).text);
    expect(cells).toEqual(['2', '', '2', '', '2', '']);
  });

  it('counts again after a reload, not before', async () => {
    const storage = memoryStorage({ [CHOICES_KEY]: JSON.stringify(['Identifier', 'ICEMSIUMTransactions']) });
    const { vm, client } = await loaded({ storage, client: makeClient({ jobs: makeJobs(2, 1) }) });
    await vm.countIcems();
    expect(client.operationslog.search).toHaveBeenCalledTimes(2);
    await vm.reload();
    await vm.countIcems();
    expect(client.operationslog.search).toHaveBeenCalledTimes(4);
  });

  it('notes incidents whose Ops Log could not be read', async () => {
    const client = makeClient({ jobs: makeJobs(2, 1) });
    client.operationslog.search.mockImplementation(async (id) => {
      if (id === 1001) throw new Error('503');
      return { results: [] };
    });
    const storage = memoryStorage({ [CHOICES_KEY]: JSON.stringify(['ICEMSIUMTransactions']) });
    const { vm } = await loaded({ storage, client });
    await vm.countIcems();
    expect(vm.icemsText()).toBe("Couldn't read the Ops Log for 1 ICEMS incident: their count is left empty.");
    expect(vm.csvText()).toBe('"ICEMSIUMTransactions"\n"0"\n""\n');
  });
});
