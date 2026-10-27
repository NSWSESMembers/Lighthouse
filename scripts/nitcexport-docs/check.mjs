/*
  End-to-end checks for the built NITC Export page, in headless Chrome
  against the fake demo data. Complements the vitest unit tests
  (src/pages/nitcexport/**\/*.test.js), which can't run the bindings, the
  download or the page.

    npm run dev && npm run nitcexport:check
    npm run nitcexport:check -- --verbose

  Exits non-zero if any check fails.
*/

import { launchNitc, waitForNitc, downloadCsv, searchRows, settle } from './launch.mjs';
import { assert, runChecks } from '../page-docs/runners.mjs';

const NOW = '2026-10-15T15:30:00+11:00';
const verbose = process.argv.includes('--verbose');
const base = { now: NOW, verbose };

const ACTIVITY_HEADER = ['Name', 'StartDate', 'EndDate', 'Unit', 'Tags', 'TotalParticipants', 'TotalHours', 'Participants'];
const ISO = /^2026-(09|10)-\d\dT\d\d:\d\d:\d\d\+1[01]:00$/;

/** A minimal CSV reader for what the page writes (every field quoted, no line breaks in fields). */
function parseCsv(text) {
  const lines = text.split('\n');
  assert(lines.pop() === '', 'CSV does not end with a line break');
  return lines.map((line) => {
    const cells = [];
    const re = /"((?:[^"]|"")*)"(,|$)/g;
    let m;
    let at = 0;
    while (at < line.length && (m = re.exec(line))) {
      assert(m.index === at, `malformed CSV line: ${line.slice(0, 80)}`);
      cells.push(m[1].replace(/""/g, '"'));
      at = re.lastIndex;
    }
    return cells;
  });
}

/** What Beacon would return for the launch range (the harness default: the 30 days to NOW). */
function expectedTasks(scenario, filter = {}) {
  const end = new Date(NOW);
  return searchRows(scenario, { entityIds: scenario.units.map((u) => u.Id), ...filter, start: new Date(end.getTime() - 30 * 24 * 3600e3), end });
}

const hoursBetween = (a, b) => Math.round(((new Date(b) - new Date(a)) / 36e5) * 100) / 100;

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

async function withPage(opts, fn) {
  const launched = await launchNitc({ ...base, ...opts });
  try {
    await fn(launched);
    assert(!launched.pageErrors.length, `page errors: ${launched.pageErrors.join('; ')}`);
  } finally {
    await launched.browser.close();
  }
}

check('opens with one small request: count, title, Activity List preview match Beacon', () => withPage({}, async ({ page, scenario, stats }) => {
  await waitForNitc(page);
  assert(stats.searches === 1 && stats.pageSizes[0] === 10, `opening asked Beacon ${stats.searches} times, page sizes ${stats.pageSizes}`);
  const want = expectedTasks(scenario);
  assert(want.length > 100, 'scenario too thin to check anything');
  assert(await page.title() === 'NITC Export: 4 DMZ units', `title "${await page.title()}"`);
  assert((await page.locator('#preview-title').textContent()).includes(`${want.length} tasks`), 'count');
  assert(await page.locator('#report-activity').isChecked(), 'Activity List not the default');
  assert(await page.locator('#preview-table tbody tr').count() === 10, 'preview is not 10 rows');
  const first = await page.locator('#preview-table tbody tr').first().locator('td').allTextContents();
  assert(first[0] === want[0].Name, `first row "${first[0]}", expected "${want[0].Name}"`);
  assert(/^(\S.*?\[\d+(\.\d+)?\])( \S.*?\[\d+(\.\d+)?\])*$/.test(first[7]), `participants "${first[7]}" not Name[hours]`);
  assert((await page.locator('#download').textContent()).includes(`Download CSV (${want.length} tasks)`), 'download button text');
  assert(await page.locator('.lh-page-footer').isVisible(), 'footer hidden after loading');
}));

check('Activity List CSV: every task, old header, ISO times, Name[hours] (PR #608), # kept', () => withPage({ pageDelayMs: 300 }, async ({ page, scenario, stats }) => {
  await waitForNitc(page);
  const want = expectedTasks(scenario);
  const before = stats.searches;
  const downloaded = downloadCsv(page);
  await page.locator('#download-progress .loader-ring').waitFor();
  const { name, text } = await downloaded;
  assert(stats.searches - before === Math.ceil(want.length / 100), `download made ${stats.searches - before} searches for ${want.length} tasks`);
  await page.locator('#download-progress').waitFor({ state: 'detached' });
  assert(/^NITC activities - 4 DMZ units - 2026-10-15 15\d\d\.csv$/.test(name), `file name "${name}"`);
  const rows = parseCsv(text);
  assert(JSON.stringify(rows[0]) === JSON.stringify(ACTIVITY_HEADER), `header ${rows[0].join(',')}`);
  assert(rows.length === want.length + 1, `${rows.length - 1} rows, expected ${want.length}`);
  rows.slice(1).forEach((r, i) => {
    const t = want[i];
    assert(r[0] === t.Name, `row ${i} is "${r[0]}", expected "${t.Name}"`);
    assert(ISO.test(r[1]) && ISO.test(r[2]), `row ${i} times "${r[1]}" "${r[2]}"`);
    assert(r[3] === t.CreatedAt.Code, `row ${i} unit ${r[3]}`);
    assert(r[4] === t.Tags.map((g) => g.Name).join(','), `row ${i} tags "${r[4]}"`);
    assert(Number(r[5]) === t.Participants.length, `row ${i} ${r[5]} participants`);
    const parts = t.Participants.map((p) => `${p.Person.FullName}[${hoursBetween(p.StartDate, p.EndDate || t.EndDate)}]`);
    assert(r[7] === parts.join(' '), `row ${i} participants "${r[7]}", expected "${parts.join(' ')}"`);
  });
  assert(rows[1][0] === 'Hall #2 clean-up (east wing)', `"#" or brackets lost: "${rows[1][0]}"`);
  assert(rows.slice(1).every((r) => !r.some((c) => c === 'undefined' || c === 'null' || c === 'NaN' || c.includes('[object'))), 'a cell says undefined/null/NaN/[object');
}));

check('Member List CSV: a row per member, Total Hours, a column per tag and No tag', () => withPage({}, async ({ page, scenario }) => {
  await waitForNitc(page);
  await page.locator('#report-member').check();
  await settle(page, 200);
  const headers = await page.locator('#preview-table thead th').allTextContents();
  assert(headers[0] === 'Name' && headers[1] === 'Total hours', `member preview headers ${headers.slice(0, 3)}`);
  const { name, text } = await downloadCsv(page);
  assert(/^NITC members - 4 DMZ units - /.test(name), `file name "${name}"`);
  const rows = parseCsv(text);
  const header = rows[0];
  const want = expectedTasks(scenario);
  const tagNames = [...new Set(want.flatMap((t) => t.Tags.map((g) => g.Name)))].sort((a, b) => a.localeCompare(b, 'en-AU', { sensitivity: 'base' }));
  assert(JSON.stringify(header) === JSON.stringify(['Name', 'TotalHours', ...tagNames, 'No tag']), `header ${header.join(',')}`);
  const members = new Set(want.flatMap((t) => t.Participants.map((p) => p.Person.Id)));
  assert(rows.length - 1 === members.size, `${rows.length - 1} member rows, expected ${members.size}`);
  const twin = scenario.people[0].FullName;
  assert(rows.filter((r) => r[0] === twin).length === 2, `the two members called ${twin} are not on separate rows`);
  // Total Hours adds up to the same as the participants' hours over all tasks.
  const total = want.reduce((sum, t) => sum + t.Participants.reduce((s, p) => s + hoursBetween(p.StartDate, p.EndDate || t.EndDate), 0), 0);
  const got = rows.slice(1).reduce((sum, r) => sum + Number(r[1]), 0);
  assert(Math.abs(got - total) < 0.05, `Total Hours add up to ${got}, expected ${total}`);
  // The untagged task's hours land under No tag.
  const untagged = want.find((t) => !t.Tags.length);
  const p = untagged.Participants[0];
  const row = rows.find((r) => r[0] === p.Person.FullName && Number(r[header.length - 1]) > 0);
  assert(row, `${p.Person.FullName} has no No tag hours`);
}));

check('remembers the report picked', () => withPage({}, async ({ page }) => {
  await waitForNitc(page);
  await page.locator('#report-member').check();
  await settle(page, 200);
  await page.reload();
  await waitForNitc(page);
  assert(await page.locator('#report-member').isChecked(), 'Member List not remembered');
}));

check('passes the NITC screen\'s filters to Beacon and names them in the header', () => withPage({ hq: [9002], filters: { TagIds: '702,703', IncludeCompleted: 'true' } }, async ({ page, scenario, stats }) => {
  await waitForNitc(page);
  const q = new URLSearchParams(stats.urls[0]);
  assert(q.getAll('EntityIds[]').join() === '9002' && q.getAll('TagIds[]').join() === '702,703' && q.get('IncludeCompleted') === 'true', `search ${stats.urls[0]}`);
  const want = expectedTasks(scenario, { entityIds: [9002], tagIds: [702, 703] });
  assert((await page.locator('#preview-title').textContent()).includes(`${want.length} tasks`), 'count with filters');
  assert(await page.title() === 'NITC Export: Demo Heights', `title "${await page.title()}"`);
  assert((await page.locator('#filters-text').textContent()) === 'Filtered to 2 tags, completed tasks included', 'filters text');
}));

check('Beacon errors: a message and Try again, which then loads', () => withPage({ failSearchTimes: 1 }, async ({ page, scenario }) => {
  await waitForNitc(page);
  assert(!(await page.locator('.lh-page-footer').isVisible()), 'footer showing under the loading card');
  const msg = await page.locator('#nitc-loading .alert-danger').textContent();
  assert(msg.includes('Beacon returned 503'), `message "${msg.trim()}"`);
  await page.locator('#nitc-loading button', { hasText: 'Try again' }).click();
  await page.locator('#preview-table').waitFor();
  assert((await page.locator('#preview-title').textContent()).includes(`${expectedTasks(scenario).length} tasks`), 'after Try again');
}));

check('a failed Reload keeps the preview and says so', () => withPage({}, async ({ page, stats }) => {
  await waitForNitc(page);
  stats.failNext = 1;
  await page.locator('#reload').click();
  await page.getByText("Couldn't reload:").waitFor();
  assert(await page.locator('#preview-table tbody tr').count() === 10, 'preview gone after a failed reload');
  assert(await page.locator('#download').isEnabled(), 'download off after a failed reload');
}));

check('a failed Download says why; Try again downloads, Close goes back', () => withPage({}, async ({ page, stats }) => {
  await waitForNitc(page);
  stats.failNext = 1;
  await page.locator('#download').click();
  const alert = page.locator('#download-progress .alert-danger');
  await alert.waitFor();
  assert((await alert.textContent()).includes('Beacon returned 503'), `message "${(await alert.textContent()).trim()}"`);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download-progress button', { hasText: 'Try again' }).click()]);
  assert(download.suggestedFilename().endsWith('.csv'), 'no CSV after Try again');
  await page.locator('#download-progress').waitFor({ state: 'detached' });

  stats.failNext = 1;
  await page.locator('#download').click();
  await alert.waitFor();
  await page.locator('#download-progress button', { hasText: 'Close' }).click();
  await page.locator('#download-progress').waitFor({ state: 'detached' });
  assert(await page.locator('#download').isEnabled(), 'download off after Close');
}));

check('Cancel stops a download and saves nothing', () => withPage({ pageDelayMs: 800 }, async ({ page }) => {
  await waitForNitc(page);
  let saved = false;
  page.on('download', () => { saved = true; });
  await page.locator('#download').click();
  await page.locator('#cancel-download').click();
  await page.locator('#download-progress').waitFor({ state: 'detached' });
  await page.waitForTimeout(2500);
  assert(!saved, 'a CSV was saved after Cancel');
}));

check('401 says to reopen the page from Beacon', () => withPage({ failSearch: 401 }, async ({ page }) => {
  await waitForNitc(page);
  const msg = await page.locator('#nitc-loading .alert-danger').textContent();
  assert(msg.includes('Reopen NITC Export from Beacon'), `message "${msg.trim()}"`);
}));

check('no tasks match: says so, nothing to download, footer at the bottom', () => withPage({ range: { start: new Date('2026-01-01T00:00:00+11:00'), end: new Date('2026-01-02T00:00:00+11:00') } }, async ({ page }) => {
  await waitForNitc(page);
  assert(await page.getByText("No tasks match the NITC screen's filters").isVisible(), 'no empty message');
  assert(await page.locator('#download').isDisabled(), 'download enabled with no tasks');
  // A short page: the footer sits at the bottom of the window, not under the content.
  const bottom = await page.locator('.lh-page-footer').evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
  assert(bottom === await page.evaluate(() => innerHeight), `footer ends at ${bottom}, window is ${await page.evaluate(() => innerHeight)}`);
}));

check('header colour follows Beacon; Guide links to the guide', async () => {
  const colours = {};
  for (const env of ['production', 'trainbeacon', 'devbeacon']) {
    await withPage({ env }, async ({ page }) => {
      await waitForNitc(page);
      colours[env] = await page.locator('.lh-page-header').evaluate((el) => getComputedStyle(el).backgroundColor);
      if (env === 'production') {
        const href = await page.locator('.guide-link').getAttribute('href');
        assert(/^https:\/\/lighthouse\.ses\.nsw\.gov\.au\/(preview\/)?guides\/nitc\/$/.test(href), `guide link ${href}`);
      }
    });
  }
  assert(new Set(Object.values(colours)).size === 3, `header colours ${JSON.stringify(colours)}`);
});

check('follows the OS dark mode', () => withPage({ dark: true }, async ({ page }) => {
  await waitForNitc(page);
  assert(await page.evaluate(() => document.documentElement.getAttribute('data-bs-theme')) === 'dark', 'not dark');
}));

await runChecks(checks);
