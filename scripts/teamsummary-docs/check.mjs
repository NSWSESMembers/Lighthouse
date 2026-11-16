/*
  End-to-end checks for the built Team Summary page, in headless Chrome
  against the fake demo data. Complements the vitest unit tests
  (src/pages/teamsummary/**\/*.test.js), which can't run the bindings or the page.

    npm run dev && npm run teamsummary:check
    npm run teamsummary:check -- --verbose

  Exits non-zero if any check fails.
*/

import { launchTeamSummary, waitForTeams, settle } from './launch.mjs';
import { assert, runChecks } from '../page-docs/runners.mjs';

const NOW = '2026-11-15T15:30:00+11:00';
const verbose = process.argv.includes('--verbose');
const base = { now: NOW, launch: 'today', verbose };

// The scenario's activated field teams: what the page shows to start with.
const ACTIVATED_FIELD = ['DEM01', 'DEM02', 'DEM03', 'DMH01', 'DMH02', 'DMP01', 'DMV01'];

const shownCallsigns = (page) => page.$$eval('.team-card .team-callsign', (els) => els.map((e) => e.textContent.trim()).sort());
const card = (page, callsign) => page.locator('.team-card', { has: page.locator('.team-callsign', { hasText: callsign }) });

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

check('lists the teams to pick from on open, like the old page, with the activated field teams ticked', async () => {
  const { browser, page, pageErrors } = await launchTeamSummary(base);
  try {
    await waitForTeams(page, { keepDialog: true });
    assert(await page.locator('#teams-modal.show').isVisible(), 'Team Filter did not open on load');
    assert(await page.locator('#teams-title').textContent() === 'Team Filter', 'dialog title');
    const items = await page.$$eval('#teams-modal .team-picker .list-group-item', (els) => els.map((e) => [e.innerText.replace(/\s+/g, ' ').trim(), e.classList.contains('active')]));
    assert(items.length === 12, `${items.length} teams listed`);
    const ticked = items.filter(([, on]) => on).map(([t]) => t.split(' ')[1]).sort();
    assert(JSON.stringify(ticked) === JSON.stringify(ACTIVATED_FIELD), `ticked ${ticked.join(',')}`);
    assert(items[0][0] === 'Field DEM01 Activated - Nov 15 02.18', `first item "${items[0][0]}"`);
    // Only once: not again after a refresh.
    await page.locator('#teams-modal .modal-footer button').click();
    await page.locator('#teams-modal').waitFor({ state: 'hidden' });
    await page.locator('.footer-refresh button').click();
    await waitForTeams(page, { keepDialog: true });
    assert(!(await page.locator('#teams-modal.show').count()), 'Team Filter opened again on refresh');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('loads the demo units: activated field teams shown, counts and history right, no page errors', async () => {
  const { browser, page, scenario, pageErrors } = await launchTeamSummary(base);
  try {
    await waitForTeams(page);
    assert(!(await page.evaluate(() => window.teamSummaryVM.error())), 'error shown');
    const shown = await shownCallsigns(page);
    assert(JSON.stringify(shown) === JSON.stringify(ACTIVATED_FIELD), `shown ${shown.join(',')}`);
    const members = scenario.teams.filter((t) => ACTIVATED_FIELD.includes(t.Callsign)).reduce((n, t) => n + t.Members.length, 0);
    const counts = (await page.locator('#counts-button').innerText()).replace(/\s+/g, ' ').trim();
    assert(counts === `Displayed Members: ${members} | Displayed Teams: 7 | Hidden Teams: 5`, `counts "${counts}"`);
    assert(await page.title() === 'DMZ Team Summary', `title "${await page.title()}"`);
    assert(await page.locator('.ts-heading').textContent() === 'Team summary for DMZ', 'heading');
    assert(await page.locator('.ts-range').textContent() === 'Sun, 15/11/2026, 00:00:00 to Sun, 15/11/2026, 23:59:00', 'range');

    const dem01 = card(page, 'DEM01');
    assert(await dem01.evaluate((el) => el.classList.contains('status-activated')), 'DEM01 not coloured as Activated');
    assert(await dem01.locator('.history-entry').count() === 5, 'DEM01 does not show 5 history entries');
    const first = await dem01.locator('.history-entry').first().locator('.history-title').textContent();
    assert(first === 'Onsite on job 2611-0013', `first entry "${first}"`);
    const pos = await dem01.locator('.position-status').textContent();
    assert(pos === 'Onsite 2611-0013 (24 minutes ago)', `last seen "${pos}"`);
    assert(await dem01.locator('.team-tasked').textContent() === 'Active Incidents: 1', 'tasked');
    assert(await dem01.locator('.team-status-for').textContent() === 'Activated For 13 hrs', 'status for');
    assert(/Pretend Way/.test(await dem01.locator('.position-address').textContent()), 'no address');
    assert(await dem01.locator('.team-sector').textContent() === 'North Demo Sector', 'sector');
    assert(await dem01.locator('.team-member.is-leader').count() === 1, 'no team leader in bold');
    // Members added at the same moment roll into one entry.
    assert(await card(page, 'DMH02').locator('.history-title', { hasText: 'Members added to team' }).count() === 1, 'members not grouped');
    // DEM01 has been Activated for 13 h: red.
    assert(await dem01.locator('.team-status-for.level-red').count() === 1, 'long status not flagged');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('asks Beacon for the HQs and status types; one HQ shows its name, none is NSW', async () => {
  for (const [hq, title, count] of [[[9002], 'Team summary for Demo Heights', 2], [[], 'Team summary for NSW', 7]]) {
    const { browser, page, requests, pageErrors } = await launchTeamSummary({ ...base, hq });
    try {
      await waitForTeams(page);
      const got = await page.locator('.ts-heading').textContent();
      assert(got === title, `heading "${got}", expected "${title}"`);
      assert((await shownCallsigns(page)).length === count, `${title}: ${(await shownCallsigns(page)).length} shown`);
      const search = new URL('https://x' + requests.find((r) => r.startsWith('/Api/v1/Teams/Search')));
      assert(search.searchParams.getAll('StatusTypeId').join(',') === '1,2,3,4', 'status types');
      assert(search.searchParams.getAll('AssignedToId').join(',') === hq.join(','), `HQs ${search.searchParams.getAll('AssignedToId')}`);
      assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
    } finally {
      await browser.close();
    }
  }
});

check('Team Filter: Select All, Unselect All, and picking one team loads its history', async () => {
  const { browser, page, pageErrors } = await launchTeamSummary(base);
  try {
    await waitForTeams(page);
    await page.locator('#counts-button').click();
    await page.locator('#teams-modal.show').waitFor();
    await page.locator('#show-all').click();
    await waitForTeams(page, { keepDialog: true });
    assert((await shownCallsigns(page)).length === 12, 'Select All did not show every team');
    await page.locator('#show-none').click();
    await settle(page, 300);
    assert(await page.locator('.team-card').count() === 0, 'Unselect All left cards up');
    await page.locator('#teams-modal .list-group-item', { hasText: 'DEM04' }).click();
    await waitForTeams(page, { keepDialog: true });
    await page.locator('#teams-modal .modal-footer button').click();
    await page.locator('#teams-modal').waitFor({ state: 'hidden' });
    assert(JSON.stringify(await shownCallsigns(page)) === '["DEM04"]', 'DEM04 not the only team');
    const dem04 = card(page, 'DEM04');
    assert(await dem04.evaluate((el) => el.classList.contains('status-standby')), 'DEM04 not coloured as Standby');
    assert(await dem04.locator('.history-entry').count() > 0, 'no history for a picked team');
    assert(await page.locator('#count-hidden').textContent() === '11', 'hidden count');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('No teams shown says so and offers the Team Filter', async () => {
  const { browser, page } = await launchTeamSummary({ ...base, storage: { LighthouseTeamSummarySettings: JSON.stringify({ autoShow: false }) } });
  try {
    await waitForTeams(page);
    assert(await page.locator('.ts-empty', { hasText: 'No teams shown.' }).isVisible(), 'no empty message');
    await page.locator('.ts-empty button').click();
    await page.locator('#teams-modal.show').waitFor();
  } finally {
    await browser.close();
  }
});

check('a refresh adds a newly Activated team and rolls up members added together', async () => {
  const { browser, page, scenario, pageErrors } = await launchTeamSummary(base);
  try {
    await waitForTeams(page);
    scenario.setStatus('DEM04', 'Activated');
    scenario.addMembers('DEM02', 2);
    await page.locator('.footer-refresh button').click();
    await page.waitForFunction(() => [...document.querySelectorAll('.team-callsign')].some((e) => e.textContent.trim() === 'DEM04'));
    await waitForTeams(page);
    const top = await card(page, 'DEM02').locator('.history-entry').first().textContent();
    assert(/Members added to team/.test(top), `DEM02 newest entry "${top.trim()}"`);
    assert(await page.locator('#count-shown').textContent() === '8', 'shown count after refresh');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('clicking an incident in the history shows it; Escape closes it', async () => {
  const { browser, page, pageErrors } = await launchTeamSummary(base);
  try {
    await waitForTeams(page);
    await card(page, 'DEM01').locator('.history-incident').first().click();
    const pop = page.locator('.incident-popover');
    await pop.locator('.incident-number').waitFor();
    assert(await pop.locator('.incident-number').textContent() === '2611-0013', 'wrong incident');
    assert(/Pretend Way/.test(await pop.locator('.incident-address').textContent()), 'no address');
    const href = await pop.locator('a.incident-link').getAttribute('href');
    assert(/\/Jobs\/70013$/.test(href), `Open in Beacon ${href}`);
    await page.keyboard.press('Escape');
    await pop.waitFor({ state: 'detached' });
    // And again, for a different one (the popup element moves between popovers).
    await card(page, 'DMV01').locator('.history-incident').first().click();
    await page.locator('.incident-popover .incident-number', { hasText: '2611-0020' }).waitFor();
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('Team Filter options hide parts of the cards and set the grid width; Settings sets dark colours; all remembered', async () => {
  const { browser, page } = await launchTeamSummary(base);
  try {
    await waitForTeams(page);
    await page.locator('#teams-button').click();
    await page.locator('#teams-modal.show').waitFor();
    await page.locator('label[for="show-members"]').click();
    await page.locator('label[for="show-resources"]').click();
    await page.locator('#columns-select').selectOption('4');
    await page.locator('#teams-modal .modal-footer button').click();
    await page.locator('#teams-modal').waitFor({ state: 'hidden' });
    await page.locator('#settings-button').click();
    await page.locator('#settings-modal.show').waitFor();
    await page.locator('label[for="theme-dark"]').click();
    await settle(page, 300);
    assert(await page.locator('.team-members').count() === 0, 'members still shown');
    assert(await page.locator('.team-resources').count() === 0, 'resources still shown');
    const cols = () => page.$eval('.team-grid', (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert(await cols() === 4, `grid has ${await cols()} columns`);
    assert(await page.evaluate(() => document.documentElement.getAttribute('data-bs-theme')) === 'dark', 'not dark');
    await page.locator('#settings-modal .modal-footer button').click();
    await page.locator('#settings-modal').waitFor({ state: 'hidden' });
    await page.reload();
    await waitForTeams(page);
    assert(await page.locator('.team-members').count() === 0, 'members back after reload');
    assert(await cols() === 4, 'columns not remembered');
    assert(await page.evaluate(() => document.documentElement.getAttribute('data-bs-theme')) === 'dark', 'not dark after reload');
  } finally {
    await browser.close();
  }
});

check('the heading is coloured by Beacon: orange, green for Train, blue for Dev', async () => {
  for (const [env, colour] of [['production', 'rgb(247, 147, 29)'], ['trainbeacon', 'rgb(33, 159, 86)'], ['devbeacon', 'rgb(45, 158, 224)']]) {
    const { browser, page } = await launchTeamSummary({ ...base, env });
    try {
      await waitForTeams(page);
      const bg = await page.$eval('.ts-header', (el) => getComputedStyle(el).backgroundColor);
      assert(bg === colour, `${env}: heading ${bg}`);
    } finally {
      await browser.close();
    }
  }
});

check('dark mode: dark cards, readable text, callsigns dark on the status colour', async () => {
  const { browser, page } = await launchTeamSummary({ ...base, dark: true });
  try {
    await waitForTeams(page);
    assert(await page.evaluate(() => document.documentElement.getAttribute('data-bs-theme')) === 'dark', 'OS dark mode not followed');
    const [cardBg, text, callsign] = await page.evaluate(() => {
      const c = document.querySelector('.team-card');
      return [getComputedStyle(c).backgroundColor, getComputedStyle(c.querySelector('.team-row')).color, getComputedStyle(c.querySelector('.team-callsign a')).color];
    });
    assert(cardBg === 'rgb(37, 40, 48)', `card ${cardBg}`);
    assert(text === 'rgb(243, 244, 246)', `text ${text}`);
    assert(callsign === 'rgb(31, 34, 41)', `callsign ${callsign}`);
  } finally {
    await browser.close();
  }
});

check('fits a phone: one team across, no sideways scrolling', async () => {
  const { browser, page, pageErrors } = await launchTeamSummary({ ...base, viewport: { width: 390, height: 844 } });
  try {
    await waitForTeams(page);
    const cols = await page.$eval('.team-grid', (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert(cols === 1, `${cols} columns on a phone`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(wide <= 0, `page scrolls sideways by ${wide}px`);
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('range buttons reload with the new dates', async () => {
  const { browser, page, requests } = await launchTeamSummary(base);
  try {
    await waitForTeams(page);
    const before = requests.filter((r) => r.startsWith('/Api/v1/Teams/Search')).length;
    await page.locator('label[for="range-168"]').click();
    await page.waitForFunction(() => /^Sun, 08\/11\/2026/.test(document.querySelector('.ts-range').textContent));
    const searches = requests.filter((r) => r.startsWith('/Api/v1/Teams/Search'));
    assert(searches.length === before + 1, `${searches.length - before} searches`);
    const start = new URL('https://x' + searches.at(-1)).searchParams.get('StatusStartDate');
    assert(start.startsWith('2026-11-08T04:30'), `StatusStartDate ${start}`);
  } finally {
    await browser.close();
  }
});

check('a Beacon error shows why and offers Try again', async () => {
  const { browser, page, pageErrors } = await launchTeamSummary({ ...base, failSearch: 500 });
  try {
    await waitForTeams(page);
    const text = await page.locator('#teams-loading .alert-danger').textContent();
    assert(/Beacon returned 500/.test(text), `error "${text.trim()}"`);
    assert(await page.locator('#teams-loading button', { hasText: 'Try again' }).isVisible(), 'no Try again');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('a failed first load tries again by itself', async () => {
  const { browser, page, pageErrors } = await launchTeamSummary({ ...base, failSearchTimes: 1 });
  try {
    await page.locator('#teams-loading .alert-danger').waitFor();
    const text = await page.locator('#retry-countdown').textContent();
    assert(/^Trying again in 00:(30|29|28)$/.test(text), `retry text "${text}"`);
    await page.evaluate(() => window.teamSummaryVM.secondsToRefresh(2)); // skip the wait
    await page.waitForFunction(() => !window.teamSummaryVM.loading(), null, { timeout: 8000 });
    await waitForTeams(page);
    assert(await page.locator('.team-card').count() === 7, 'no teams after the retry');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

/** Answer the page's next Teams/Search requests with `status` until the returned function is called. */
async function breakBeacon(page, status) {
  const handler = (route) => route.fulfill({ status, contentType: 'application/json', body: '{"Message":"Demo failure"}' });
  await page.route('**/Teams/Search**', handler);
  return () => page.unroute('**/Teams/Search**', handler);
}

check('a failed refresh keeps the teams up and recovers by itself', async () => {
  const { browser, page, pageErrors } = await launchTeamSummary(base);
  try {
    await waitForTeams(page);
    const fix = await breakBeacon(page, 503);
    await page.locator('.footer-refresh button').click();
    await page.locator('.alert-warning', { hasText: "Couldn't refresh" }).waitFor();
    assert(await page.locator('.team-card').count() === 7, 'cards gone after a failed refresh');
    const t0 = await page.evaluate(() => window.teamSummaryVM.secondsToRefresh());
    await page.waitForTimeout(2200);
    const t1 = await page.evaluate(() => window.teamSummaryVM.secondsToRefresh());
    assert(t1 < t0, `countdown stuck at ${t0} after the error`);
    await fix();
    await page.evaluate(() => window.teamSummaryVM.secondsToRefresh(2)); // skip the wait
    await page.waitForFunction(() => !window.teamSummaryVM.error(), null, { timeout: 8000 });
    assert(!(await page.locator('.alert-warning').count()), 'warning still showing');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('a failed range switch keeps the shown dates and range button', async () => {
  const { browser, page } = await launchTeamSummary(base);
  try {
    await waitForTeams(page);
    const dates = await page.locator('.ts-range').textContent();
    await breakBeacon(page, 500);
    await page.locator('label[for="range-168"]').click();
    await page.locator('.alert-warning', { hasText: "Couldn't refresh" }).waitFor();
    await settle(page, 300);
    assert(await page.locator('.ts-range').textContent() === dates, 'dates changed for a range that failed to load');
    assert(await page.locator('#range-launch').isChecked(), 'range button not put back');
  } finally {
    await browser.close();
  }
});

check('a failed team history shows on the card, the teams still load', async () => {
  const { browser, page, pageErrors } = await launchTeamSummary({ ...base, failHistory: 500 });
  try {
    await waitForTeams(page);
    assert(await page.locator('.team-card').count() === 7, 'teams missing');
    const text = await card(page, 'DEM01').locator('.history-error').textContent();
    assert(/^Couldn't load the history: Beacon returned 500\b/.test(text), `history error "${text}"`);
    assert(!(await page.locator('.alert-warning').count()), 'page-wide warning for a history');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('a slow Beacon: the ring spins, then says it is still waiting', async () => {
  const { browser, page, pageErrors } = await launchTeamSummary({ ...base, searchDelayMs: 30000 });
  try {
    await page.locator('#teams-loading .loader-ring.spinning').waitFor({ timeout: 5000 });
    const first = await page.locator('#teams-loading .loader-title').textContent();
    assert(first === 'Asking Beacon for the teams…', `title "${first}"`);
    await page.locator('#teams-loading .loader-slow').waitFor({ timeout: 15000 });
    assert(await page.locator('#teams-loading button', { hasText: 'Load the last 24 h instead' }).isVisible(), 'no shorter-range button');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('Settings links to the guide (preview copy in a Development build)', async () => {
  for (const [watermark, expected] of [[false, 'https://lighthouse.ses.nsw.gov.au/guides/teams/'], [true, 'https://lighthouse.ses.nsw.gov.au/preview/guides/teams/']]) {
    const { browser, page } = await launchTeamSummary({ ...base, watermark });
    try {
      await waitForTeams(page);
      await page.locator('#settings-button').click();
      await page.locator('#settings-modal.show').waitFor();
      const href = await page.locator('#settings-modal a.guide-link').getAttribute('href');
      assert(href === expected, `guide link ${href}, expected ${expected}`);
    } finally {
      await browser.close();
    }
  }
});

await runChecks(checks);
