import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ko from 'knockout';
import { StatsVM, REFRESH_SECONDS } from './StatsVM.js';

const H = 3600 * 1000;
const NOW = new Date('2026-10-15T05:00:00Z');

const params = {
  host: 'https://api.test',
  source: 'https://web.test',
  userId: '17',
  hqIds: ['1'],
  start: new Date('2026-10-12T05:00:00Z'),
  end: NOW,
};

function beaconJob(Id, { activeAt, completeAt } = {}) {
  const history = [];
  if (activeAt) history.push({ Type: 2, Timelogged: activeAt });
  if (completeAt) history.push({ Type: 6, Timelogged: completeAt });
  return {
    Id, Identifier: `J${Id}`, JobReceived: '2026-10-15T01:00:00Z', Type: 'Storm',
    JobStatusType: { Name: completeAt ? 'Complete' : 'Active' }, JobStatusTypeHistory: history, Tags: [],
    EntityAssignedTo: { Name: 'Demo City' }, Address: {}, SituationOnScene: 'tree down',
  };
}

/** Stands in for StatsCharts: keeps the facts, no filtering. */
function fakeCharts() {
  return {
    built: false,
    facts: [],
    load: vi.fn(function (facts) { this.built = true; this.facts = facts; }),
    filteredFacts() { return this.facts; },
    totalCount() { return this.facts.length; },
    latest(n) { return this.facts.slice(0, n); },
    isFiltered: () => false,
    filterLabels: () => [],
    resetChart: vi.fn(),
    resetAll: vi.fn(),
  };
}

function makeVM({ jobs = [beaconJob(1)], search, getName } = {}) {
  const client = {
    unit: { getName: getName || vi.fn(async () => ({ Id: 1, Name: 'Demo City', ParentEntity: { Code: 'DMZ' } })) },
    job: { search: search || vi.fn(async () => ({ results: jobs })) },
  };
  const charts = fakeCharts();
  const vm = new StatsVM({ params, client, charts, now: () => NOW, clusters: async () => null });
  return { vm, client, charts };
}

describe('StatsVM', () => {
  beforeEach(() => {
    ko.options.deferUpdates = false;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts loading when the first token arrives', async () => {
    const { vm, client, charts } = makeVM();
    vm.setToken('tok');
    await vm.load(); // joins the in-flight load
    expect(client.unit.getName).toHaveBeenCalledWith('1', expect.objectContaining({ token: 'tok', host: params.host }));
    expect(charts.load).toHaveBeenCalledTimes(1);
    expect(vm.loading()).toBe(false);
    expect(vm.totalCount()).toBe(1);
    expect(vm.pageTitle()).toBe('Incident Statistics: Demo City');
  });

  it('links to the stats guide (the stable copy unless told otherwise)', () => {
    expect(makeVM().vm.guideUrl).toBe('https://lighthouse.ses.nsw.gov.au/guides/stats/');
    const vm = new StatsVM({ params, client: {}, charts: fakeCharts(), guideUrl: 'https://x.test/preview/guides/stats/' });
    expect(vm.guideUrl).toBe('https://x.test/preview/guides/stats/');
  });

  it('does not reload when the token is renewed', async () => {
    const { vm, client } = makeVM();
    vm.setToken('a');
    await vm.load();
    vm.setToken('b');
    await Promise.resolve();
    expect(client.job.search).toHaveBeenCalledTimes(1);
    expect(vm.token()).toBe('b');
  });

  it('looks up the units once, not on every refresh', async () => {
    const { vm, client } = makeVM();
    vm.setToken('t');
    await vm.load();
    await vm.load();
    expect(client.unit.getName).toHaveBeenCalledTimes(1);
    expect(client.job.search).toHaveBeenCalledTimes(2);
  });

  it('summarises completion times and builds table rows', async () => {
    const { vm } = makeVM({
      jobs: [
        beaconJob(1, { activeAt: '2026-10-15T01:00:00Z', completeAt: '2026-10-15T03:00:00Z' }),
        beaconJob(2),
      ],
    });
    vm.setToken('t');
    await vm.load();
    expect(vm.durations().count).toBe(1);
    expect(vm.durationTiles()[4].value).toBe('2 hours');
    const [done, open] = vm.latestJobs();
    expect(done.jobUrl).toBe('https://web.test/Jobs/1');
    expect(open.closedText).toBe('—');
    expect(open.addressText).toBe('—');
  });

  it('spins until Beacon gives a total, then counts incidents by page', async () => {
    const seen = [];
    const search = vi.fn(async (_u, _s, _e, ctx) => {
      seen.push(vm.loader().title);
      ctx.onProgress(100, 250);
      seen.push([vm.loader().title, vm.loader().centreValue, vm.loader().centreLabel, vm.loader().centreLabel2, vm.loader().meta]);
      ctx.onProgress(200, 250);
      seen.push(vm.loader().pageDots.map((d) => d.done));
      return { results: [] };
    });
    const { vm } = makeVM({ search });
    vm.setToken('t');
    await vm.load();
    expect(seen[0]).toBe('Asking Beacon for incidents…');
    expect(seen[1]).toEqual(['Loading incidents', '100', 'of 250', 'incidents', 'page 1 of 3']);
    expect(seen[2]).toEqual([true, true, false]);
    expect(vm.loading()).toBe(false);
  });

  it('shows Building charts once every page is in', async () => {
    const { vm, charts } = makeVM();
    let titleWhenBuilding = null;
    const realLoad = charts.load;
    charts.load = vi.fn(function (...args) {
      titleWhenBuilding = vm.loader().title;
      return realLoad.apply(this, args);
    });
    vm.setToken('t');
    await vm.load();
    expect(titleWhenBuilding).toBe('Building charts…');
  });

  it('offers a shorter range from the loader', async () => {
    const { vm } = makeVM();
    vm.setToken('t');
    await vm.load();
    vm.loadShorterRange();
    expect(vm.rangeChoice()).toBe('24');
  });

  it('shows Beacon errors and recovers on retry', async () => {
    let fail = true;
    const search = vi.fn(async () => {
      if (fail) throw Object.assign(new Error('x'), { status: 401 });
      return { results: [beaconJob(1)] };
    });
    const { vm } = makeVM({ search });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vm.setToken('t');
    await vm.load();
    expect(vm.error()).toMatch(/401/);
    expect(vm.loading()).toBe(true);
    fail = false;
    vm.retry();
    await vm.load();
    expect(vm.error()).toBeNull();
    expect(vm.loading()).toBe(false);
  });

  it('refuses an invalid launch range', async () => {
    const { client } = makeVM();
    const vm = new StatsVM({ params: { ...params, start: new Date('x') }, client, charts: fakeCharts(), now: () => NOW });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vm.setToken('t');
    await vm.load();
    expect(vm.error()).toMatch(/valid start and end/);
    expect(client.job.search).not.toHaveBeenCalled();
  });

  it('reloads the last N hours when the range changes', async () => {
    const { vm, client } = makeVM();
    vm.setToken('t');
    await vm.load();
    vm.rangeChoice('24');
    await vm.load();
    const [, start, end] = client.job.search.mock.calls.at(-1);
    expect(end).toBe(NOW);
    expect(NOW - start).toBe(24 * H);
  });

  it('keeps the heading and range buttons on the old range when switching fails', async () => {
    let fail = false;
    const search = vi.fn(async () => {
      if (fail) throw Object.assign(new Error('x'), { status: 500 });
      return { results: [beaconJob(1)] };
    });
    const { vm, charts } = makeVM({ search });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vm.setToken('t');
    await vm.load();
    const shown = vm.range();
    const heading = vm.rangeText();
    fail = true;
    vm.rangeChoice('24');
    await vm.load();
    expect(vm.error()).toMatch(/500/);
    expect(vm.range()).toBe(shown);
    expect(vm.rangeText()).toBe(heading);
    expect(vm.rangeChoice()).toBe('launch');
    // Putting the button back doesn't load the old range again.
    expect(search).toHaveBeenCalledTimes(2);
    expect(charts.load).toHaveBeenCalledTimes(1);
  });

  it('shows the new range in the heading once it has loaded', async () => {
    const { vm } = makeVM();
    vm.setToken('t');
    await vm.load();
    vm.rangeChoice('24');
    await vm.load();
    expect(NOW - vm.range().start).toBe(24 * H);
    expect(vm.rangeChoice()).toBe('24');
  });

  it('counts down and refreshes when the timer runs out', async () => {
    const { vm, client } = makeVM();
    vm.setToken('t');
    await vm.load();
    expect(vm.countdownText()).toBe('03:00');
    vm.secondsToRefresh(1);
    vm.tick();
    await vm.load();
    expect(client.job.search).toHaveBeenCalledTimes(2);
    expect(vm.secondsToRefresh()).toBe(REFRESH_SECONDS);
  });

  it('pauses the countdown while there is an error', async () => {
    const { vm } = makeVM();
    vm.error('boom');
    vm.loading(false);
    vm.secondsToRefresh(10);
    vm.tick();
    expect(vm.secondsToRefresh()).toBe(10);
  });

  it('describes the filter state', async () => {
    const { vm, charts } = makeVM({ jobs: [beaconJob(1), beaconJob(2)] });
    vm.setToken('t');
    await vm.load();
    expect(vm.countText()).toBe('2 incidents');
    expect(vm.isFiltered()).toBe(false);
    charts.filteredFacts = () => charts.facts.slice(0, 1);
    vm.syncFromCharts();
    expect(vm.isFiltered()).toBe(true);
    expect(vm.countText()).toBe('1 of 2 incidents selected');
    vm.resetAll();
    expect(charts.resetAll).toHaveBeenCalled();
  });
});
