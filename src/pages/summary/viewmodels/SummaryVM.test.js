import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ko from 'knockout';
import { SummaryVM, REFRESH_SECONDS, LOADER_DELAY_MS } from './SummaryVM.js';
import { THEME_KEY, SOUND_KEY } from '../data/settings.js';

const H = 3600 * 1000;
const NOW = new Date('2026-10-15T05:00:00Z');

const params = {
  host: 'https://api.test',
  source: 'https://web.test',
  userId: '17',
  hqIds: ['1'],
  start: new Date('2026-10-14T13:00:00Z'),
  end: new Date('2026-10-15T12:59:00Z'),
};

const report = (counts) => ({ result: Object.entries(counts).map(([Name, Count]) => ({ Name, Count })) });

function memoryStorage(init = {}) {
  const data = { ...init };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

function makeVM({ summary, getName, hqIds = params.hqIds, storage, ...rest } = {}) {
  const client = {
    unit: { getName: getName || vi.fn(async (id) => ({ Id: Number(id), Name: 'Demo City', ParentEntity: { Code: 'DMZ' } })) },
    job: { summary: summary || vi.fn(async () => report({ New: 2, Active: 3, Complete: 5, Storm: 10 })) },
  };
  const playSound = vi.fn();
  const applyTheme = vi.fn();
  const vm = new SummaryVM({ params: { ...params, hqIds }, client, now: () => NOW, storage, playSound, applyTheme, ...rest });
  return { vm, client, playSound, applyTheme };
}

const values = (tiles) => Object.fromEntries(tiles.map((t) => [t.tileKey, t.tileValue]));

describe('SummaryVM', () => {
  beforeEach(() => {
    ko.options.deferUpdates = false;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the ring only if the first load takes a moment', async () => {
    vi.useFakeTimers();
    let answer;
    const summary = vi.fn(() => new Promise((resolve) => { answer = resolve; }));
    const { vm } = makeVM({ summary });
    vm.setToken('t');
    expect(vm.showLoader()).toBe(false);
    await vi.advanceTimersByTimeAsync(LOADER_DELAY_MS + 10);
    expect(vm.showLoader()).toBe(true);
    answer(report({ New: 1 }));
    await vm.load();
    expect(vm.showLoader()).toBe(false);
  });

  it('never shows the ring for a quick load', async () => {
    vi.useFakeTimers();
    const { vm } = makeVM();
    vm.setToken('t');
    await vm.load();
    await vi.advanceTimersByTimeAsync(LOADER_DELAY_MS * 2);
    expect(vm.loading()).toBe(false);
    expect(vm.showLoader()).toBe(false);
  });

  it('shows a first-load error straight away', async () => {
    vi.useFakeTimers();
    const { vm } = makeVM({ summary: vi.fn(async () => { throw Object.assign(new Error('x'), { status: 500 }); }) });
    vm.setToken('t');
    await vm.load();
    expect(vm.showLoader()).toBe(true);
  });

  it('loads the summary when the first token arrives', async () => {
    const { vm, client } = makeVM();
    vm.setToken('tok');
    await vm.load(); // joins the in-flight load
    expect(client.unit.getName).toHaveBeenCalledWith('1', expect.objectContaining({ token: 'tok', host: params.host }));
    expect(client.job.summary).toHaveBeenCalledWith(
      expect.objectContaining({ Id: 1 }), params.start, params.end, expect.objectContaining({ token: 'tok', userId: '17' }),
    );
    expect(vm.loading()).toBe(false);
    expect(vm.pageTitle()).toBe('Incident Summary: Demo City');
    expect(values(vm.headlineTiles())).toEqual({ outstanding: '5', completed: '5', total: '10' });
    expect(values(vm.openTiles())).toEqual({ new: '2', active: '3', tasked: '0', referred: '0' });
    expect(vm.typeTiles().find((t) => t.tileKey === 'storm').tilePct).toBe('100%');
  });

  it('asks for all of NSW with no HQ, and several HQs as an array', async () => {
    const nsw = makeVM({ hqIds: [] });
    nsw.vm.setToken('t');
    await nsw.vm.load();
    expect(nsw.client.job.summary.mock.calls[0][0]).toEqual([]);
    expect(nsw.vm.scopeTitle()).toBe('NSW');

    const two = makeVM({ hqIds: ['1', '2'] });
    two.vm.setToken('t');
    await two.vm.load();
    expect(two.client.job.summary.mock.calls[0][0].map((u) => u.Id)).toEqual([1, 2]);
    expect(two.vm.scopeTitle()).toBe('2 DMZ units');
  });

  it('formats big numbers and gives their length for sizing', async () => {
    const { vm } = makeVM({ summary: vi.fn(async () => report({ Storm: 12345, New: 12345 })) });
    vm.setToken('t');
    await vm.load();
    const total = vm.headlineTiles().find((t) => t.tileKey === 'total');
    expect(total.tileValue).toBe('12,345');
    expect(total.tileChars).toBe('6');
  });

  it('never leaves a tile field empty (secure binding would read window)', async () => {
    const { vm } = makeVM({ summary: vi.fn(async () => report({})) });
    vm.setToken('t');
    await vm.load();
    for (const t of [...vm.headlineTiles(), ...vm.openTiles(), ...vm.closedTiles(), ...vm.typeTiles()]) {
      for (const [k, v] of Object.entries(t)) expect(v, `${t.tileKey}.${k}`).toBeTruthy();
    }
    expect(vm.isEmpty()).toBe(true);
  });

  it('looks up the units once, not on every refresh', async () => {
    const { vm, client } = makeVM();
    vm.setToken('t');
    await vm.load();
    await vm.load();
    expect(client.unit.getName).toHaveBeenCalledTimes(1);
    expect(client.job.summary).toHaveBeenCalledTimes(2);
  });

  it('plays the sound and highlights New when new incidents arrive', async () => {
    let n = 2;
    const summary = vi.fn(async () => report({ New: n }));
    const { vm, playSound } = makeVM({ summary, storage: memoryStorage({ [SOUND_KEY]: 'Chime' }) });
    vm.setToken('t');
    await vm.load();
    expect(playSound).not.toHaveBeenCalled(); // not on the first load
    n = 3;
    await vm.load();
    expect(playSound).toHaveBeenCalledWith('sounds/chime.mp3');
    expect(vm.newHighlight()).toBe(true);
    n = 1;
    await vm.load();
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it('stays quiet with no sound picked, and on a range change', async () => {
    let n = 2;
    const summary = vi.fn(async () => report({ New: n }));
    const quiet = makeVM({ summary });
    quiet.vm.setToken('t');
    await quiet.vm.load();
    n = 5;
    await quiet.vm.load();
    expect(quiet.playSound).not.toHaveBeenCalled();
    expect(quiet.vm.newHighlight()).toBe(true);

    n = 2;
    const loud = makeVM({ summary, storage: memoryStorage({ [SOUND_KEY]: 'Ding' }) });
    loud.vm.setToken('t');
    await loud.vm.load();
    n = 9;
    loud.vm.rangeChoice('72');
    await loud.vm.load();
    expect(loud.playSound).not.toHaveBeenCalled();
  });

  it('range buttons load the last N hours to now', async () => {
    const { vm, client } = makeVM();
    vm.setToken('t');
    await vm.load();
    vm.rangeChoice('24');
    await vm.load();
    const [, start, end] = client.job.summary.mock.calls.at(-1);
    expect(end).toBe(NOW);
    expect(NOW - start).toBe(24 * H);
  });

  it('shows the error and a retry when Beacon fails', async () => {
    const summary = vi.fn(async () => { throw Object.assign(new Error('x'), { status: 401 }); });
    const { vm } = makeVM({ summary });
    vm.setToken('t');
    await vm.load();
    expect(vm.loading()).toBe(true);
    expect(vm.error()).toMatch(/Reopen Incident Summary from Beacon/);
    summary.mockImplementation(async () => report({ New: 1 }));
    vm.retry();
    await vm.load();
    expect(vm.error()).toBe(null);
    expect(vm.loading()).toBe(false);
  });

  it('refuses a missing date range', async () => {
    const { vm, client } = makeVM({ params: { ...params, start: new Date('x') } });
    vm.setToken('t');
    await vm.load();
    expect(vm.error()).toMatch(/valid start and end/);
    expect(client.job.summary).not.toHaveBeenCalled();
  });

  it('counts down and refreshes', async () => {
    const { vm, client } = makeVM();
    vm.setToken('t');
    await vm.load();
    for (let i = 0; i < REFRESH_SECONDS - 1; i++) vm.tick();
    expect(vm.countdownText()).toBe('00:01');
    vm.tick();
    await vm.load();
    expect(client.job.summary).toHaveBeenCalledTimes(2);
  });

  it('applies and remembers the theme and sound', () => {
    const storage = memoryStorage({ [THEME_KEY]: 'night' });
    const { vm, applyTheme, playSound } = makeVM({ storage });
    expect(applyTheme).toHaveBeenCalledWith('dark');
    vm.theme('light');
    expect(applyTheme).toHaveBeenLastCalledWith('light');
    expect(storage.data[THEME_KEY]).toBe('light');
    vm.sound('Ding');
    expect(storage.data[SOUND_KEY]).toBe('Ding');
    expect(playSound).toHaveBeenCalledWith('sounds/ding.mp3'); // a preview of the pick
  });

  it('titles a long unit name by its code, and splits the range ends', async () => {
    const getName = vi.fn(async () => ({ Id: 1, Code: 'DLN', Name: 'Demo Long Name Heights', ParentEntity: { Code: 'DMZ' } }));
    const { vm } = makeVM({ getName });
    vm.setToken('t');
    await vm.load();
    expect(vm.scopeShort()).toBe('DLN');
    expect(vm.pageTitle()).toBe('Incident Summary: Demo Long Name Heights');
    const start = vm.rangeStart();
    expect(Object.values(start).every(Boolean)).toBe(true);
    expect(start.dateText).toMatch(/2026/);
  });

  it('links to the summary guide unless told otherwise', () => {
    expect(makeVM().vm.guideUrl).toBe('https://lighthouse.ses.nsw.gov.au/guides/summary/');
    expect(makeVM({ guideUrl: 'https://x.test/preview/guides/summary/' }).vm.guideUrl).toBe('https://x.test/preview/guides/summary/');
  });
});
