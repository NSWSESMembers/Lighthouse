/*
  End-to-end checks for LAD's trackable assets (team matching, the matched
  and unmatched asset layers, and the asset feed refresh), in headless Chrome
  against the fake demo data. Complements the vitest unit tests next to the
  source, which can't run the view model, Knockout's deferred updates or the
  map markers.

    npm run dev && npm run lad:assets-check
    npm run lad:assets-check -- --only "hidden tab"   # checks whose name contains it
    npm run lad:assets-check -- --verbose

  Each check drives the page the way Beacon would (a team or tasking payload,
  or the radio feed changing between polls) and asserts that every asset with
  no visible team keeps exactly one pin, where the asset is.

  Exits non-zero if any check fails.
*/

/* global ko -- the page's Knockout, inside page.evaluate() */

import { launchLad, closeConfigAndLoad, settle } from './launch.mjs';
import { assert, runChecks } from '../page-docs/runners.mjs';

const NOW = '2026-10-15T10:00:00';
const verbose = process.argv.includes('--verbose');
const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : null;

const CORS = { 'access-control-allow-origin': '*' };
const flatRadio = (scenario) => (Array.isArray(scenario.radio[0]) ? scenario.radio.flat() : scenario.radio);

/**
 * LAD loaded with both asset layers on, a controllable radio feed and a
 * switch to hold animation frames (which is what a hidden tab does).
 *
 * feed.mode: 'normal' | 'drop' (leave out feed.dropId) | 'fail' (500) |
 * 'nullgeo' (feed.dropId with null coordinates). feed.extra: features to add.
 * feed.delayMs delays each response; feed.requests counts them.
 */
async function launch() {
  const launched = await launchLad({ now: NOW, verbose });
  const { page, scenario } = launched;
  const feed = { mode: 'normal', dropId: null, extra: [], delayMs: 0, requests: 0 };
  await page.route('**/ResourceLocations/Radio**', async (route) => {
    feed.requests += 1;
    if (feed.delayMs) await new Promise((r) => setTimeout(r, feed.delayMs));
    if (feed.mode === 'fail') return route.fulfill({ status: 500, body: 'error', headers: CORS });
    let rows = JSON.parse(JSON.stringify(flatRadio(scenario))).concat(JSON.parse(JSON.stringify(feed.extra)));
    if (feed.mode === 'drop') rows = rows.filter((f) => f.properties.id !== feed.dropId);
    if (feed.mode === 'nullgeo') {
      rows.forEach((f) => { if (f.properties.id === feed.dropId) f.geometry = { type: 'Point', coordinates: [null, null] }; });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows), headers: CORS });
  });
  await settle(launched.page, 800);
  await closeConfigAndLoad(page);
  await settle(page, 3000);
  await page.evaluate(async () => {
    const vm = ko.dataFor(document.body);
    const map = vm.mapVM.map;
    if (!map.hasLayer(vm.mapVM.assetLayer)) map.addLayer(vm.mapVM.assetLayer);
    if (!map.hasLayer(vm.mapVM.unmatchedAssetLayer)) map.addLayer(vm.mapVM.unmatchedAssetLayer);
    const realRaf = window.requestAnimationFrame.bind(window);
    const held = [];
    window.requestAnimationFrame = (cb) => {
      if (!window.__holdFrames) return realRaf(cb);
      held.push(cb);
      return -held.length;
    };
    window.__releaseFrames = () => { window.__holdFrames = false; held.splice(0).forEach((cb) => realRaf(cb)); };
    await new Promise((r) => setTimeout(r, 800));
  });
  return { ...launched, feed };
}

const wait = (page, ms) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);

// One asset fetch, as the 30 s timer does, past the 20 s localStorage cache.
const poll = (page) => page.evaluate(async () => {
  Object.keys(localStorage).filter((k) => k.includes('LighthouseFetched')).forEach((k) => localStorage.removeItem(k));
  await ko.dataFor(document.body).fetchAllTrackableAssets();
  await new Promise((r) => setTimeout(r, 400));
});

// The first asset showing on the unmatched layer.
const pickUnmatched = (page) => page.evaluate(() => {
  const a = ko.dataFor(document.body).unmatchedTrackableAssets().find((x) => x.unmatchedMarker);
  return a ? { id: a.id(), name: a.name() } : null;
});

// Where an asset is in the lists, and every pin drawn for its id.
const assetState = (page, id) => page.evaluate((assetId) => {
  const vm = ko.dataFor(document.body);
  const a = vm.assetsById.get(assetId);
  const pins = [vm.mapVM.assetLayer, vm.mapVM.unmatchedAssetLayer]
    .flatMap((layer) => layer.getLayers().filter((m) => m._assetId === assetId))
    .map((m) => m.getLatLng());
  return {
    inList: !!a && vm.trackableAssets().includes(a),
    teams: a ? a.matchingTeams().map((t) => t.callsign()) : [],
    unmatched: !!a && vm.unmatchedTrackableAssets().includes(a),
    matched: !!a && vm.filteredTrackableAssets().includes(a),
    pins: pins.map((p) => [+p.lat.toFixed(5), +p.lng.toFixed(5)]),
    at: a ? [+(+a.latitude()).toFixed(5), +(+a.longitude()).toFixed(5)] : null,
  };
}, id);

// The asset is listed once, shown on one layer, with one pin where it is.
function assertOnePinAtAsset(s, label) {
  assert(s.inList, `${label}: asset not in the asset list`);
  assert(s.unmatched || s.matched, `${label}: asset on neither layer (teams: ${s.teams.join(', ') || 'none'})`);
  assert(s.pins.length === 1, `${label}: ${s.pins.length} pins for the asset ${JSON.stringify(s.pins)}`);
  assert(s.pins[0][0] === s.at[0] && s.pins[0][1] === s.at[1], `${label}: pin at ${s.pins[0]}, asset at ${s.at}`);
}

// A team record in the shape Beacon's Teams/Search and team pushes use.
const teamJson = (id, callsign, { hqId, status, statusDate, typeName }) => ({
  Id: id,
  Callsign: callsign,
  AssignedTo: { Id: hqId, Code: 'HQ', Name: 'HQ' },
  CreatedAt: { Id: hqId, Code: 'HQ', Name: 'HQ' },
  TeamStatusType: status,
  TeamStatusStartDate: statusDate,
  TeamType: typeName ? { Name: typeName } : undefined,
});

// Fields of a team that passes the config filters, to build one that does.
const visibleTeamFields = (page) => page.evaluate(() => {
  const t = ko.dataFor(document.body).filteredTeamsAgainstConfig()[0];
  return {
    hqId: t.assignedTo().id(), status: t.teamStatusType(),
    statusDate: t.statusDate().toISOString(), typeName: t.teamType()?.Name,
  };
});

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

// ── 1. SignalR team admission ──

check('a pushed team outside the filters does not take the asset', async () => {
  const { browser, page } = await launch();
  try {
    const asset = await pickUnmatched(page);
    assert(asset, 'no unmatched asset in the demo data');
    // admitTeamIfInFilter for a new team at another HQ, then a refresh.
    await page.evaluate((name) => {
      const vm = ko.dataFor(document.body);
      const team = vm.getOrCreateTeam({
        Id: 987654321, Callsign: name, AssignedTo: { Id: 999999, Code: 'XXX', Name: 'Other HQ' },
        TeamStatusType: { Id: 1, Name: 'Activated' }, TeamStatusStartDate: new Date().toISOString(),
      });
      if (!vm.teamMatchesConfigFilters(team)) {
        vm.teamsById.delete(team.id());
        vm.teams.remove(team);
      }
    }, asset.name);
    await wait(page, 1000);
    assertOnePinAtAsset(await assetState(page, asset.id), 'after the push');
    await poll(page);
    assertOnePinAtAsset(await assetState(page, asset.id), 'after the next poll');
  } finally {
    await browser.close();
  }
});

check('a pushed team inside the filters still takes the asset', async () => {
  const { browser, page } = await launch();
  try {
    const asset = await pickUnmatched(page);
    const fields = await visibleTeamFields(page);
    await page.evaluate(({ json }) => ko.dataFor(document.body).getOrCreateTeam(json), { json: teamJson(987654322, asset.name, fields) });
    await wait(page, 1000);
    const s = await assetState(page, asset.id);
    assert(s.teams.includes(asset.name), `asset not matched to the new team (teams: ${s.teams.join(', ')})`);
    assert(s.matched && !s.unmatched, 'asset not on the matched layer');
    assertOnePinAtAsset(s, 'matched');
  } finally {
    await browser.close();
  }
});

// ── 2. Teams known only from an incident's taskings ──

for (const [label, team] of [
  ['the cut-down team in a tasking', (name) => ({ Id: 44444401, Callsign: name, CreatedAtId: 1, TeamTypeId: 1, CurrentStatusId: 2, Members: [], IsDeleted: false })],
  ['a stood-down team at another HQ', (name) => ({
    Id: 44444402, Callsign: name, AssignedTo: { Id: 999999, Code: 'XXX', Name: 'Other HQ' },
    TeamStatusType: { Id: 3, Name: 'Stood Down' }, TeamStatusStartDate: new Date().toISOString(),
  })],
]) {
  check(`a tasking for ${label} does not hide the asset`, async () => {
    const { browser, page } = await launch();
    try {
      const asset = await pickUnmatched(page);
      await page.evaluate(({ teamJson: t }) => {
        const vm = ko.dataFor(document.body);
        const job = vm.filteredJobsAgainstConfig()[0];
        vm.upsertTaskingFromPayload({ Id: 55555501, CurrentStatus: 'Complete', CurrentStatusId: 6, Team: t }, { jobContext: job });
      }, { teamJson: team(asset.name) });
      await wait(page, 1000);
      assertOnePinAtAsset(await assetState(page, asset.id), 'after the tasking');
      await poll(page);
      assertOnePinAtAsset(await assetState(page, asset.id), 'after the next poll');
    } finally {
      await browser.close();
    }
  });
}

// ── 3. An asset leaving the feed ──

check('an asset that leaves the feed is unlinked from its team, and comes back to it', async () => {
  const { browser, page, feed } = await launch();
  try {
    const picked = await page.evaluate(() => {
      const vm = ko.dataFor(document.body);
      const a = vm.filteredTrackableAssets().find((x) => x.marker);
      return a ? { id: a.id(), team: a.matchingTeams()[0].id() } : null;
    });
    assert(picked, 'no matched asset in the demo data');
    await page.evaluate((id) => { window.__oldAsset = ko.dataFor(document.body).assetsById.get(id); }, picked.id);
    feed.mode = 'drop';
    feed.dropId = picked.id;
    await poll(page);
    const gone = await page.evaluate(({ team }) => {
      const vm = ko.dataFor(document.body);
      const old = window.__oldAsset;
      return { oldTeams: old.matchingTeams().length, teamHasOld: vm.teamsById.get(team).trackableAssets().includes(old) };
    }, picked);
    assert(gone.oldTeams === 0, `removed asset still linked to ${gone.oldTeams} team(s)`);
    assert(!gone.teamHasOld, 'team still lists the removed asset');
    feed.mode = 'normal';
    await poll(page);
    const back = await assetState(page, picked.id);
    assert(back.matched, 'asset not back on the matched layer');
    assertOnePinAtAsset(back, 'after it comes back');
  } finally {
    await browser.close();
  }
});

// ── 4. Pins when an asset is replaced ──

check('an asset that leaves and comes back while the tab is hidden has one pin', async () => {
  const { browser, page, feed } = await launch();
  try {
    const asset = await pickUnmatched(page);
    feed.dropId = asset.id;
    await page.evaluate(() => { window.__holdFrames = true; });
    feed.mode = 'drop';
    await poll(page);
    feed.mode = 'normal';
    await poll(page);
    await page.evaluate(() => window.__releaseFrames());
    await wait(page, 500);
    assertOnePinAtAsset(await assetState(page, asset.id), 'after the tab is shown');
  } finally {
    await browser.close();
  }
});

check('overlapping fetches where one loses the radio feed leave one pin', async () => {
  const { browser, page, feed } = await launch();
  try {
    const asset = await pickUnmatched(page);
    // The first radio request fails after a delay, so it lands after the
    // second; the rest fall through to the normal feed.
    let n = 0;
    await page.route('**/ResourceLocations/Radio**', async (route) => {
      n += 1;
      if (n === 1) {
        await new Promise((r) => setTimeout(r, 300));
        return route.fulfill({ status: 500, body: 'error', headers: CORS });
      }
      return route.fallback();
    });
    feed.mode = 'normal';
    await page.evaluate(async () => {
      const clear = () => Object.keys(localStorage).filter((k) => k.includes('LighthouseFetched')).forEach((k) => localStorage.removeItem(k));
      const vm = ko.dataFor(document.body);
      clear();
      const first = vm.fetchAllTrackableAssets();
      await new Promise((r) => setTimeout(r, 50));
      clear();
      const second = vm.fetchAllTrackableAssets();
      await Promise.all([first, second]);
      await new Promise((r) => setTimeout(r, 400));
    });
    await poll(page);
    assertOnePinAtAsset(await assetState(page, asset.id), 'after both fetches and a poll');
  } finally {
    await browser.close();
  }
});

// ── 5. Missing coordinates ──

check('a poll with no coordinates leaves the pin where it was', async () => {
  const { browser, page, feed } = await launch();
  try {
    const asset = await pickUnmatched(page);
    const before = await assetState(page, asset.id);
    feed.dropId = asset.id;
    feed.mode = 'nullgeo';
    await poll(page);
    await wait(page, 1000); // past the 700 ms move animation
    const s = await assetState(page, asset.id);
    assert(JSON.stringify(s.pins) === JSON.stringify(before.pins), `pin moved from ${before.pins} to ${s.pins}`);
    assertOnePinAtAsset(s, 'after the null poll');
    feed.mode = 'normal';
    await poll(page);
    await wait(page, 1000);
    assertOnePinAtAsset(await assetState(page, asset.id), 'after the next poll');
  } finally {
    await browser.close();
  }
});

check('a new asset with no coordinates gets a pin once it has a position', async () => {
  const { browser, page, scenario, feed } = await launch();
  try {
    const tpl = flatRadio(scenario)[0];
    const fresh = JSON.parse(JSON.stringify(tpl));
    fresh.properties.id = 777001;
    fresh.properties.name = 'ZZZ901';
    fresh.properties.lastSeen = tpl.properties.lastSeen;
    fresh.geometry = { type: 'Point', coordinates: [null, null] };
    feed.extra = [fresh];
    await poll(page);
    const none = await assetState(page, 777001);
    assert(none.inList, 'new asset not added');
    assert(none.pins.length === 0, `pin drawn with no position: ${JSON.stringify(none.pins)}`);
    feed.extra = [{ ...fresh, geometry: tpl.geometry }];
    await poll(page);
    await wait(page, 1000);
    assertOnePinAtAsset(await assetState(page, 777001), 'once it has a position');
  } finally {
    await browser.close();
  }
});

// ── 6. One asset fetch at a time ──

check('asset fetches do not overlap, and a failed one does not block the next', async () => {
  const { browser, page, feed } = await launch();
  try {
    feed.delayMs = 1000;
    const start = feed.requests;
    await page.evaluate(async () => {
      Object.keys(localStorage).filter((k) => k.includes('LighthouseFetched')).forEach((k) => localStorage.removeItem(k));
      const vm = ko.dataFor(document.body);
      await Promise.all([vm.fetchAllTrackableAssets(), vm.fetchAllTrackableAssets()]);
    });
    assert(feed.requests - start === 1, `${feed.requests - start} radio requests for two overlapping fetches`);
    feed.delayMs = 0;
    feed.mode = 'fail';
    await poll(page);
    feed.mode = 'normal';
    const beforeNext = feed.requests;
    await poll(page);
    assert(feed.requests - beforeNext === 1, 'no fetch after a failed one');
  } finally {
    await browser.close();
  }
});

await runChecks(only ? checks.filter((c) => c.name.includes(only)) : checks);
