import { describe, it, expect, vi } from 'vitest';
import ko from 'knockout';
import { NitcExportVM, PREVIEW_ROWS, NO_TOKEN_MS, NO_TOKEN_TEXT, REPORT_KEY } from './NitcExportVM.js';
import { ACTIVITY_HEADER } from '../data/reports.js';

const UNIT = { Id: 9001, Code: 'DEM', Name: 'Demo City', ParentEntity: { Code: 'DMZ' } };

function makeTasks(n) {
  return Array.from({ length: n }, (_, i) => ({
    Id: 500 + i,
    Name: `Task ${i}`,
    StartDate: '2026-10-20T18:00:00',
    EndDate: '2026-10-20T20:00:00',
    CreatedAt: { Id: 9001, Code: 'DEM' },
    Tags: [{ Name: i % 2 ? 'Training' : 'Maintenance' }],
    Participants: [{ Person: { Id: 1, FullName: 'Alex Sample' }, StartDate: null, EndDate: null }],
  }));
}

/** A fake Beacon: honours pageSize/pageLimit like requestPaginated. */
function makeClient({ tasks = makeTasks(3) } = {}) {
  const client = {
    tasks,
    unit: { getName: vi.fn(async () => UNIT) },
    nitc: {
      search: vi.fn(async (filters, start, end, ctx) => {
        const { pageSize = 100, pageLimit = 0 } = ctx;
        const all = client.tasks;
        const rows = pageLimit ? all.slice(0, pageSize * pageLimit) : all;
        if (ctx.onProgress) ctx.onProgress(rows.length, all.length);
        return { results: rows, totalItems: all.length };
      }),
    },
  };
  return client;
}

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}

const params = {
  host: 'https://beacon.test', source: 'https://beacon.test', userId: '17', hqIds: ['9001'],
  start: new Date('2026-09-27T13:00:00Z'), end: new Date('2026-10-27T12:59:00Z'),
};
const filters = { EntityIds: '9001', TagIds: '7' };

function make(opts = {}) {
  const client = opts.client || makeClient();
  const storage = opts.storage || memoryStorage();
  const saveFile = vi.fn();
  let clock = +new Date('2026-10-27T00:00:00Z');
  const vm = new NitcExportVM({ params: opts.params || params, filters, client, storage, saveFile, now: () => new Date(clock) });
  return { vm, client, storage, saveFile, advance: (ms) => { clock += ms; } };
}

async function ready(opts) {
  const made = make(opts);
  made.vm.setToken('tok');
  await made.vm.load();
  ko.tasks.runEarly();
  return made;
}

describe('NitcExportVM opening', () => {
  it('waits for the token, then asks for one small page with the NITC screen\'s filters', async () => {
    const { vm, client } = make();
    expect(client.nitc.search).not.toHaveBeenCalled();
    vm.setToken('tok');
    await vm.load();
    expect(client.nitc.search).toHaveBeenCalledTimes(1);
    const [f, start, end, ctx] = client.nitc.search.mock.calls[0];
    expect(f).toBe(filters);
    expect(start).toBe(params.start);
    expect(end).toBe(params.end);
    expect(ctx).toMatchObject({ host: 'https://beacon.test', userId: '17', token: 'tok', pageSize: PREVIEW_ROWS, pageLimit: 1 });
    expect(vm.loading()).toBe(false);
    expect(vm.pageTitle()).toBe('NITC Export: Demo City');
    expect(vm.filtersText).toBe('Filtered to 1 tag');
  });

  it('shows Beacon\'s total and a note when there are more tasks than the preview', async () => {
    const { vm } = await ready({ client: makeClient({ tasks: makeTasks(25) }) });
    expect(vm.countText()).toBe('25 tasks');
    expect(vm.previewRows()).toHaveLength(PREVIEW_ROWS);
    expect(vm.previewNote()).toBe('Newest 10 of 25 tasks. Download CSV fetches them all.');
    vm.report('member');
    expect(vm.previewNote()).toBe('Hours from the newest 10 of 25 tasks. Download CSV adds up all of them.');
  });

  it('says so when the range has no tasks, with download off', async () => {
    const { vm } = await ready({ client: makeClient({ tasks: [] }) });
    expect(vm.isEmpty()).toBe(true);
    expect(vm.canDownload()).toBe(false);
  });

  it('shows a Beacon error, and Try again loads', async () => {
    const client = makeClient();
    client.nitc.search.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 503 }));
    const { vm } = make({ client });
    vm.setToken('tok');
    await vm.load();
    expect(vm.error()).toBe('Beacon returned 503.');
    expect(vm.loading()).toBe(true);
    await vm.retry();
    expect(vm.error()).toBe(null);
    expect(vm.loading()).toBe(false);
  });

  it('refuses a missing date range without asking Beacon', async () => {
    const { vm, client } = make({ params: { ...params, start: new Date(NaN) } });
    vm.setToken('tok');
    await vm.load();
    expect(vm.error()).toMatch(/without a valid start and end date/);
    expect(client.nitc.search).not.toHaveBeenCalled();
  });

  it('gives up waiting for a sign-in after a while', () => {
    const { vm, advance } = make();
    advance(NO_TOKEN_MS - 1);
    vm.tick();
    expect(vm.error()).toBe(null);
    advance(1);
    vm.tick();
    expect(vm.error()).toBe(NO_TOKEN_TEXT);
  });
});

describe('NitcExportVM report', () => {
  it('previews the Activity List by default, the Member List when picked', async () => {
    const { vm } = await ready();
    expect(vm.previewHeader().map((h) => h.text)).toEqual(['Name', 'Start', 'End', 'Unit', 'Tags', 'People', 'Total hours', 'Participants [hours]']);
    expect(vm.previewRows()[0].cells.at(-1).text).toBe('Alex Sample[2]');
    vm.report('member');
    expect(vm.previewHeader().map((h) => h.text)).toEqual(['Name', 'Total hours', 'Maintenance', 'Training']);
    expect(vm.previewRows().map((r) => r.cells.map((c) => c.text))).toEqual([['Alex Sample', '6', '4', '2']]);
  });

  it('remembers the report picked', async () => {
    const storage = memoryStorage();
    const { vm } = make({ storage });
    vm.report('member');
    expect(storage.data[REPORT_KEY]).toBe('member');
    expect(make({ storage }).vm.report()).toBe('member');
    expect(make({ storage: memoryStorage({ [REPORT_KEY]: 'nonsense' }) }).vm.report()).toBe('activity');
  });
});

describe('NitcExportVM download', () => {
  it('fetches every task and saves the CSV for the report', async () => {
    const { vm, client, saveFile } = await ready({ client: makeClient({ tasks: makeTasks(25) }) });
    await vm.download();
    expect(client.nitc.search).toHaveBeenCalledTimes(2);
    expect(client.nitc.search.mock.calls[1][3]).not.toHaveProperty('pageLimit');
    const [name, text] = saveFile.mock.calls[0];
    expect(name).toBe('NITC activities - Demo City - 2026-10-27 1100.csv');
    const lines = text.trim().split('\n');
    expect(lines[0]).toBe(ACTIVITY_HEADER.map((h) => `"${h}"`).join(','));
    expect(lines).toHaveLength(26);
    expect(vm.downloading()).toBe(false);

    vm.report('member');
    await vm.download();
    const [memberName, memberText] = saveFile.mock.calls[1];
    expect(memberName).toBe('NITC members - Demo City - 2026-10-27 1100.csv');
    expect(memberText).toBe('"Name","TotalHours","Maintenance","Training"\n"Alex Sample","50","26","24"\n');
  });

  it('keeps the dialog open with the error, and Try again downloads', async () => {
    const { vm, client, saveFile } = await ready();
    client.nitc.search.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 500, statusText: 'Server Error' }));
    await vm.download();
    expect(vm.downloading()).toBe(true);
    expect(vm.dlError()).toBe('Beacon returned 500 Server Error.');
    await vm.retryDownload();
    expect(saveFile).toHaveBeenCalledTimes(1);
    expect(vm.downloading()).toBe(false);
  });

  it('Cancel aborts the fetch and saves nothing', async () => {
    const client = makeClient();
    const { vm, saveFile } = await ready({ client });
    let signal;
    client.nitc.search.mockImplementationOnce((f, s, e, ctx) => {
      signal = ctx.signal;
      return new Promise((resolve) => setTimeout(() => resolve({ results: client.tasks, totalItems: 3 }), 10));
    });
    const done = vm.download();
    vm.cancelDownload();
    await done;
    expect(signal.aborted).toBe(true);
    expect(saveFile).not.toHaveBeenCalled();
    expect(vm.downloading()).toBe(false);
  });
});
