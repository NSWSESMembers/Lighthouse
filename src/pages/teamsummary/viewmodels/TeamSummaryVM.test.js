import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ko from 'knockout';
import { TeamSummaryVM, REFRESH_SECONDS, LOADER_DELAY_MS, MAX_RETRY_SECONDS, FIRST_RETRY_SECONDS, retryDelay, scopeName, rangeText } from './TeamSummaryVM.js';
import { SETTINGS_KEY } from '../data/settings.js';

const NOW = new Date('2026-11-15T15:30:00');

const params = {
  host: 'https://api.test',
  source: 'https://web.test',
  userId: '17',
  hqIds: ['1'],
  start: new Date('2026-11-15T00:00:00'),
  end: new Date('2026-11-15T23:59:00'),
};

const member = (Id, name, leader = false, TimeOn = '2026-11-15T09:00:00') => {
  const [FirstName, LastName] = name.split(' ');
  return { Id, TimeOn, TeamLeader: leader, Person: { Id: Id + 100, FullName: name, FirstName, LastName } };
};

const team = (Id, Callsign, status = 'Activated', extra = {}) => ({
  Id,
  Callsign,
  TeamStatusStartDate: '2026-11-15T09:00:00',
  TeamStatusType: { Name: status },
  TeamType: { Name: 'Field' },
  Members: [member(Id * 10, 'Alex Nguyen', true), member(Id * 10 + 1, 'Sam Okafor')],
  Resources: [],
  TaskedJobCount: 1,
  ...extra,
});

const history = (callsign) => ({
  results: [
    { Name: `${callsign} Onsite on job 2611-0013`, Description: 'Tasking updated by Alex Nguyen', TimeStamp: '2026-11-15T15:06:00' },
    { Name: 'Team set as Activated', Description: 'Status changed by Alex Nguyen', TimeStamp: '2026-11-15T09:00:00' },
  ],
  totalItems: 2,
});

function memoryStorage(init = {}) {
  const data = { ...init };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

const job = { Id: 70013, Identifier: '2611-0013', Address: { PrettyAddress: '172 Pretend Way, Demo City, NSW 2999' }, JobPriorityType: { Description: 'Priority Response' } };

function makeVM({ teams, search, getHistory, getJob, hqIds = params.hqIds, storage, ...rest } = {}) {
  const callsigns = new Map();
  const client = {
    unit: { getName: vi.fn(async (id) => ({ Id: Number(id), Name: 'Demo City', ParentEntity: { Code: 'DMZ' } })) },
    team: {
      search: search || vi.fn(async () => {
        const results = teams || [team(1, 'DEM01'), team(2, 'DEM02', 'Standby'), team(3, 'DEM10', 'Activated', { TeamType: { Name: 'Operations' } })];
        results.forEach((t) => callsigns.set(t.Id, t.Callsign));
        return { results, totalItems: results.length };
      }),
      getHistory: getHistory || vi.fn(async (id) => history(callsigns.get(id) || 'X')),
    },
    job: { get: getJob || vi.fn(async () => job) },
  };
  const applyTheme = vi.fn();
  const vm = new TeamSummaryVM({ params: { ...params, hqIds }, client, now: () => NOW, storage, applyTheme, ...rest });
  return { vm, client, applyTheme };
}

/** Let the history loads started by a load finish. */
async function histories(vm) {
  await vm.load();
  await Promise.all(vm.teams().map((t) => t.historyBusy));
}

const callsigns = (list) => list.map((t) => t.callsign());

describe('TeamSummaryVM', () => {
  beforeEach(() => {
    ko.options.deferUpdates = false;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the teams when the first token arrives, with Beacon\'s status types', async () => {
    const { vm, client } = makeVM();
    vm.setToken('tok');
    await vm.load();
    expect(client.team.search).toHaveBeenCalledTimes(1);
    const [scope, start, end, ctx] = client.team.search.mock.calls[0];
    expect(scope).toMatchObject({ Id: 1 }); // one HQ: the entity, not an array
    expect(start).toEqual(params.start);
    expect(end).toEqual(params.end);
    expect(ctx).toMatchObject({ host: 'https://api.test', userId: '17', token: 'tok', statusTypes: [1, 2, 3, 4] });
    expect(vm.pageTitle()).toBe('Demo City Team Summary');
    expect(vm.bannerTitle()).toBe('Team summary for Demo City');
    expect(vm.loading()).toBe(false);
  });

  it('searches all of NSW with no HQ', async () => {
    const { vm, client } = makeVM({ hqIds: [] });
    vm.setToken('t');
    await vm.load();
    expect(client.team.search.mock.calls[0][0]).toEqual([]);
    expect(vm.scopeTitle()).toBe('NSW');
  });

  it('shows activated field teams to start with, and counts what is shown', async () => {
    const { vm } = makeVM();
    vm.setToken('t');
    await histories(vm);
    expect(callsigns(vm.shownTeams())).toEqual(['DEM01']);
    expect(vm.membersText()).toBe('2');
    expect(vm.shownText()).toBe('1');
    expect(vm.hiddenText()).toBe('2');
  });

  it('shows nothing by itself with Show activated field teams off', async () => {
    const storage = memoryStorage({ [SETTINGS_KEY]: JSON.stringify({ autoShow: false }) });
    const { vm } = makeVM({ storage });
    vm.setToken('t');
    await vm.load();
    expect(vm.teamsShown()).toBe(0);
    expect(vm.allHidden()).toBe(true);
  });

  it('All, Activated only and None in the Teams dialog', async () => {
    const { vm } = makeVM();
    vm.setToken('t');
    await vm.load();
    vm.showAll();
    expect(vm.teamsShown()).toBe(3);
    vm.showActivated();
    expect(callsigns(vm.shownTeams())).toEqual(['DEM01', 'DEM10']);
    vm.showNone();
    expect(vm.teamsShown()).toBe(0);
  });

  it('loads a team\'s history and where it was last seen when it is shown', async () => {
    const { vm, client } = makeVM();
    vm.setToken('t');
    await histories(vm);
    const dem01 = vm.shownTeams()[0];
    expect(client.team.getHistory).toHaveBeenCalledWith(1, expect.objectContaining({ token: 't' }));
    expect(dem01.entries().map((e) => e.entryTitle)).toEqual(['Onsite on job 2611-0013', 'Team set as Activated']);
    expect(dem01.positionText()).toBe('Onsite 2611-0013 (24 minutes ago)');
    expect(dem01.positionAddress()).toBe('172 Pretend Way, Demo City 2999');
    // Hidden teams wait until they're shown.
    expect(client.team.getHistory).toHaveBeenCalledTimes(1);
    const dem02 = vm.teams()[1];
    dem02.toggle();
    await dem02.historyBusy;
    expect(client.team.getHistory).toHaveBeenCalledWith(2, expect.anything());
    expect(dem02.entries()).toHaveLength(2);
  });

  it('looks up an incident\'s address once', async () => {
    const { vm, client } = makeVM({ teams: [team(1, 'DEM01')] });
    vm.setToken('t');
    await histories(vm);
    await vm.load();
    await vm.teams()[0].historyBusy;
    expect(client.team.getHistory).toHaveBeenCalledTimes(2);
    expect(client.job.get).toHaveBeenCalledTimes(1);
    expect(client.job.get.mock.calls[0][0]).toBe('26110013');
  });

  it('a failed history shows on its card, and the rest of the page carries on', async () => {
    const getHistory = vi.fn(async () => { throw Object.assign(new Error('x'), { status: 500 }); });
    const { vm } = makeVM({ getHistory });
    vm.setToken('t');
    await histories(vm);
    const dem01 = vm.shownTeams()[0];
    expect(dem01.historyError()).toBe("Couldn't load the history: Beacon returned 500.");
    expect(vm.error()).toBeNull();
    expect(vm.historyLoading()).toBe(false);
  });

  it('a refresh keeps what is shown, updates the cards and drops teams Beacon no longer returns', async () => {
    let results = [team(1, 'DEM01'), team(2, 'DEM02', 'Standby'), team(4, 'DEM04', 'Standby')];
    const search = vi.fn(async () => ({ results, totalItems: results.length }));
    const { vm } = makeVM({ search });
    vm.setToken('t');
    await vm.load();
    vm.teams()[2].shown(true); // DEM04 picked by hand
    const dem01 = vm.teams()[0];
    results = [team(1, 'DEM01', 'Activated', { TaskedJobCount: 3 }), team(4, 'DEM04', 'Standby')];
    await vm.load();
    expect(callsigns(vm.teams())).toEqual(['DEM01', 'DEM04']);
    expect(vm.teams()[0]).toBe(dem01); // the same card, updated
    expect(dem01.taskedText()).toBe('Active Incidents: 3');
    expect(callsigns(vm.shownTeams())).toEqual(['DEM01', 'DEM04']);
  });

  it('lists the teams to pick from once they first load, as the old page did', async () => {
    const openTeams = vi.fn();
    const search = vi.fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue({ results: [team(1, 'DEM01')], totalItems: 1 });
    const { vm } = makeVM({ search, openTeams });
    vm.setToken('t');
    await vm.load();
    expect(openTeams).not.toHaveBeenCalled(); // not for a failed load
    await vm.load();
    expect(openTeams).toHaveBeenCalledTimes(1);
    await vm.load();
    vm.rangeChoice('24');
    await vm.load();
    expect(openTeams).toHaveBeenCalledTimes(1); // not on refreshes or range changes
  });

  it('shows a team of any type that becomes Activated, as the old page did', async () => {
    let status = 'Standby';
    const search = vi.fn(async () => ({ results: [team(3, 'DEM10', status, { TeamType: { Name: 'Operations' } })], totalItems: 1 }));
    const { vm } = makeVM({ search });
    vm.setToken('t');
    await vm.load();
    expect(vm.teamsShown()).toBe(0);
    status = 'Activated';
    await vm.load();
    expect(vm.teamsShown()).toBe(1);
  });

  it('shows a team that becomes Activated, unless that is turned off', async () => {
    for (const autoShow of [true, false]) {
      let status = 'Standby';
      const search = vi.fn(async () => ({ results: [team(2, 'DEM02', status)], totalItems: 1 }));
      const storage = memoryStorage({ [SETTINGS_KEY]: JSON.stringify({ autoShow }) });
      const { vm } = makeVM({ search, storage });
      vm.setToken('t');
      await vm.load();
      expect(vm.teamsShown()).toBe(0);
      status = 'Activated';
      await vm.load();
      expect(vm.teamsShown()).toBe(autoShow ? 1 : 0);
    }
  });

  it('a hidden team stays hidden while it stays Activated', async () => {
    const { vm } = makeVM();
    vm.setToken('t');
    await vm.load();
    vm.showNone();
    await vm.load();
    expect(vm.teamsShown()).toBe(0);
  });

  it('flags long hours and few incidents', async () => {
    const teams = [team(1, 'DEM01', 'Activated', {
      TeamStatusStartDate: '2026-11-15T02:00:00', // 13 h
      TaskedJobCount: 0,
      Members: [member(10, 'Alex Nguyen', true, '2026-11-15T05:00:00'), member(11, 'Sam Okafor', false, '2026-11-15T14:00:00')],
    })];
    const { vm } = makeVM({ teams });
    vm.setToken('t');
    await vm.load();
    const t = vm.teams()[0];
    expect(t.statusForText()).toBe('Activated For 13 hrs');
    expect(t.statusForClass()).toBe('level-red');
    expect(t.taskedText()).toBe('Active Incidents: 0');
    expect(t.taskedClass()).toBe('level-red');
    expect(t.members().map((m) => m.memberClass)).toEqual(['is-leader level-amber', 'member']);
    expect(t.members()[0].memberTitle).toBe('Alex Nguyen has been Activated for 10hrs');
  });

  it('links to Beacon: the team, its history and a message to its members', async () => {
    const { vm } = makeVM();
    vm.setToken('t');
    await vm.load();
    const t = vm.teams()[0];
    expect(t.editUrl()).toBe('https://web.test/Teams/1/Edit');
    expect(t.historyUrl()).toBe('https://web.test/Teams/History/1');
    expect(t.messageUrl()).toBe(`https://web.test/Messages/Create?lhquickrecipient=${encodeURIComponent('[110,111]')}`);
  });

  it('member changes in the history follow the setting', async () => {
    const getHistory = vi.fn(async () => ({
      results: [
        { Name: 'Sam Okafor added to team', Description: 'Member added by Alex Nguyen', TimeStamp: '2026-11-15T10:00:00' },
        { Name: 'Team set as Activated', Description: '', TimeStamp: '2026-11-15T09:00:00' },
      ],
    }));
    const { vm } = makeVM({ getHistory });
    vm.setToken('t');
    await histories(vm);
    const t = vm.shownTeams()[0];
    expect(t.entries()).toHaveLength(2);
    vm.showMemberChanges(false);
    expect(t.entries().map((e) => e.entryTitle)).toEqual(['Team set as Activated']);
  });

  it('remembers the settings and applies the colours', () => {
    const storage = memoryStorage();
    const { vm, applyTheme } = makeVM({ storage });
    expect(applyTheme).toHaveBeenCalledWith('auto');
    vm.theme('dark');
    vm.columns(4);
    vm.showResources(false);
    expect(applyTheme).toHaveBeenLastCalledWith('dark');
    expect(JSON.parse(storage.data[SETTINGS_KEY])).toMatchObject({ theme: 'dark', columns: 4, showResources: false, showMembers: true });
    expect(vm.gridClass()).toBe('team-grid cols-4');
    const again = makeVM({ storage }).vm;
    expect(again.theme()).toBe('dark');
    expect(again.showResources()).toBe(false);
  });

  it('shows the ring only if the first load takes a moment', async () => {
    vi.useFakeTimers();
    let answer;
    const search = vi.fn(() => new Promise((resolve) => { answer = resolve; }));
    const { vm } = makeVM({ search });
    vm.setToken('t');
    expect(vm.showLoader()).toBe(false);
    await vi.advanceTimersByTimeAsync(LOADER_DELAY_MS + 10);
    expect(vm.showLoader()).toBe(true);
    answer({ results: [], totalItems: 0 });
    await vm.load();
    expect(vm.showLoader()).toBe(false);
    expect(vm.noTeams()).toBe(true);
  });

  it('refreshes every 3 minutes, and keeps trying after a failure', async () => {
    const { vm, client } = makeVM({ teams: [] });
    vm.setToken('t');
    await vm.load();
    expect(vm.secondsToRefresh()).toBe(REFRESH_SECONDS);
    expect(REFRESH_SECONDS).toBe(180);
    client.team.search.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 503 }));
    vm.secondsToRefresh(1);
    vm.tick();
    await vm.load();
    expect(vm.error()).toBe('Beacon returned 503.');
    expect(vm.secondsToRefresh()).toBe(FIRST_RETRY_SECONDS);
    vm.secondsToRefresh(1);
    vm.tick();
    await vm.load();
    expect(vm.error()).toBeNull();
    expect(client.team.search).toHaveBeenCalledTimes(3);
  });

  it('backs off after failures in a row', () => {
    expect(retryDelay(0)).toBe(REFRESH_SECONDS);
    expect(retryDelay(1)).toBe(30);
    expect(retryDelay(2)).toBe(60);
    expect(retryDelay(10)).toBe(MAX_RETRY_SECONDS);
  });

  it('a range button reloads; a failed switch puts the old range back', async () => {
    const { vm, client } = makeVM();
    vm.setToken('t');
    await vm.load();
    vm.rangeChoice('48');
    await vm.load();
    const [, start, end] = client.team.search.mock.calls[1];
    expect(end).toEqual(NOW);
    expect(start).toEqual(new Date(NOW.getTime() - 48 * 3600e3));
    client.team.search.mockRejectedValueOnce(new Error('down'));
    vm.rangeChoice('168');
    await vm.load();
    expect(vm.error()).toBe('down');
    expect(vm.rangeChoice()).toBe('48');
    expect(client.team.search).toHaveBeenCalledTimes(3); // not reloaded by the put-back
  });

  it('says why when opened without dates', async () => {
    const { client } = makeVM();
    const bad = new TeamSummaryVM({ params: { ...params, start: new Date(NaN) }, client, now: () => NOW });
    bad.setToken('t');
    await bad.load();
    expect(bad.error()).toBe('This page was opened without a valid start and end date.');
    expect(client.team.search).not.toHaveBeenCalled();
  });

  it('names the HQs and range as the old page did', () => {
    const unit = (Name, Code) => ({ Name, ParentEntity: { Code } });
    expect(scopeName([])).toBe('NSW');
    expect(scopeName([unit('Demo City', 'DMZ')])).toBe('Demo City');
    expect(scopeName([unit('Demo City', 'DMZ'), unit('Demo Vale', 'DMZ')])).toBe('DMZ');
    expect(scopeName([unit('Demo City', 'DMZ'), unit('Other', 'OTZ')])).toBe('2 units');
    expect(rangeText({ start: new Date('2026-11-15T00:00:00'), end: new Date('2026-11-15T23:59:00') }))
      .toBe('Sun, 15/11/2026, 00:00:00 to Sun, 15/11/2026, 23:59:00');
    expect(rangeText({ start: new Date(NaN), end: new Date(NaN) })).toBe('No valid date range');
  });

  it('shows an incident from the history', async () => {
    const showIncident = vi.fn();
    const incidentChanged = vi.fn();
    const { vm, client } = makeVM({ showIncident, incidentChanged });
    vm.setToken('t');
    await histories(vm);
    const entry = vm.shownTeams()[0].entries()[0];
    const anchor = {};
    const opened = vm.openIncident(entry, { currentTarget: anchor });
    expect(showIncident).toHaveBeenCalledWith(anchor);
    expect(vm.incident()).toMatchObject({ number: '2611-0013', loading: true });
    await opened;
    expect(client.job.get).toHaveBeenLastCalledWith('26110013', expect.objectContaining({ token: 't' }));
    expect(vm.incident().details).toMatchObject({ number: '2611-0013', priorityKey: 'priority', beaconUrl: 'https://web.test/Jobs/70013' });
    expect(incidentChanged).toHaveBeenCalled();
  });

  it('says so when an incident will not load', async () => {
    const getJob = vi.fn(async () => { throw Object.assign(new Error('x'), { status: 404, statusText: 'Not Found' }); });
    const { vm } = makeVM({ getJob });
    vm.setToken('t');
    await vm.load();
    await vm.openIncident({ incidentNumber: '2611-0099' }, { currentTarget: {} });
    expect(vm.incident()).toMatchObject({ loading: false, failed: "Couldn't load 2611-0099: Beacon returned 404 Not Found.", details: null });
  });
});
