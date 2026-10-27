/*
  End-to-end checks for the built Incident Export page, in headless Chrome
  against the fake demo data. Complements the vitest unit tests
  (src/pages/advexport/**\/*.test.js), which can't run the bindings, the
  download or the page.

    npm run dev && npm run advexport:check
    npm run advexport:check -- --verbose

  Exits non-zero if any check fails.
*/

import { launchExport, waitForExport, downloadCsv, searchRows, settle } from './launch.mjs';
import { buildScenario } from './scenario.mjs';
import { assert, runChecks } from '../page-docs/runners.mjs';

const NOW = '2026-10-15T15:30:00+11:00';
const verbose = process.argv.includes('--verbose');
const base = { now: NOW, verbose };

const DEFAULT_HEADER = [
  'Identifier', 'JobReceived', 'JobPriorityType.Name', 'JobType.Name', 'JobStatusType.Name', 'SituationOnScene', 'Tags',
  'EntityAssignedTo.Code', 'Address.Level', 'Address.StreetNumber', 'Address.Street', 'Address.Locality', 'Address.PostCode',
  'Address.AdditionalAddressInfo', 'CallerFirstName', 'CallerLastName', 'CallerPhoneNumber', 'ContactFirstName',
  'ContactLastName', 'ContactPhoneNumber',
];

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

/** What Beacon would return for the launch range (launchPage's default: the 72 h to NOW). */
function expectedJobs(scenario, hqs = scenario.units.map((u) => u.Id)) {
  const end = new Date(NOW);
  return searchRows(scenario, { hqs, start: new Date(end.getTime() - 72 * 3600e3), end });
}

const field = (page, key) => page.locator(`.export-field:has(input[value="${key}"]) input`);

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

async function withPage(opts, fn) {
  const launched = await launchExport({ ...base, ...opts });
  try {
    await fn(launched);
    assert(!launched.pageErrors.length, `page errors: ${launched.pageErrors.join('; ')}`);
  } finally {
    await launched.browser.close();
  }
}

check('loads all four demo units: count, title, default columns and preview match Beacon', () => withPage({}, async ({ page, scenario }) => {
  await waitForExport(page);
  const want = expectedJobs(scenario);
  assert(want.length > 100, 'scenario too thin to check anything');
  assert(!(await page.evaluate(() => window.exportVM.error())), 'error shown');
  assert(await page.title() === 'Incident Export: 4 DMZ units', `title "${await page.title()}"`);
  const count = await page.locator('#preview-title').textContent();
  assert(count.includes(`${want.length} incidents`), `preview says "${count}", expected ${want.length} incidents`);
  assert(await page.locator('.export-field input:checked').count() === 20, 'not 20 default columns ticked');
  assert(await page.locator('#preview-table tbody tr').count() === 10, 'preview is not 10 rows');
  const headers = await page.locator('#preview-table thead th').allTextContents();
  assert(headers[0] === 'Id' && headers[1] === 'Received' && headers.includes('Incident Contact - First Name'), `preview headers ${headers.slice(0, 3)}`);
  const firstId = await page.locator('#preview-table tbody tr').first().locator('td').first().textContent();
  assert(firstId === want[0].Identifier, `first row ${firstId}, expected ${want[0].Identifier}`);
  assert((await page.locator('#download').textContent()).includes(`Download CSV (${want.length} incidents)`), 'download button text');
  assert(await page.locator('.lh-page-footer').isVisible(), 'footer hidden after loading');
}));

check('downloads every incident as CSV: old header, ISO dates, one row per incident', () => withPage({}, async ({ page, scenario }) => {
  await waitForExport(page);
  const want = expectedJobs(scenario);
  const { name, text } = await downloadCsv(page);
  assert(/^Incident export - 4 DMZ units - 2026-10-15 15\d\d\.csv$/.test(name), `file name "${name}"`);
  const rows = parseCsv(text);
  assert(JSON.stringify(rows[0]) === JSON.stringify(DEFAULT_HEADER), `header ${rows[0].join(',')}`);
  assert(rows.length === want.length + 1, `${rows.length - 1} rows, expected ${want.length}`);
  rows.slice(1).forEach((r, i) => {
    assert(r.length === DEFAULT_HEADER.length, `row ${i} has ${r.length} cells`);
    assert(r[0] === want[i].Identifier, `row ${i} is ${r[0]}, expected ${want[i].Identifier}`);
    assert(/^2026-10-1\dT\d\d:\d\d:\d\d\+11:00$/.test(r[1]), `row ${i} received "${r[1]}"`);
  });
  const tricky = rows.find((r) => r[0] === scenario.jobs[0].Identifier);
  assert(tricky && tricky[5] === 'Tree on "granny flat" roof leaking', `quote/line break cell "${tricky && tricky[5]}"`);
  assert(rows.slice(1).every((r) => !r.some((c) => c === 'undefined' || c === 'null' || c.includes('[object'))), 'a cell says undefined/null/[object');
}));

check('remembers ticked columns, All / None per group, Reset to the defaults', () => withPage({}, async ({ page }) => {
  await waitForExport(page);
  await field(page, 'LGA').check();
  await field(page, 'Identifier').uncheck();
  await settle(page, 200);
  await page.reload();
  await waitForExport(page);
  assert(await field(page, 'LGA').isChecked(), 'LGA not remembered');
  assert(!(await field(page, 'Identifier').isChecked()), 'Identifier untick not remembered');

  const address = page.locator('fieldset', { hasText: 'Address details' });
  await address.locator('.group-all').click();
  assert(await address.locator('input:checked').count() === 11, 'All did not tick the address group');
  assert(await address.locator('.group-all').isDisabled(), 'All still enabled');
  await address.locator('.group-none').click();
  assert(await address.locator('input:checked').count() === 0, 'None did not clear the address group');

  await page.locator('#reset-fields').click();
  await settle(page, 200);
  assert(await page.locator('.export-field input:checked').count() === 20, 'Reset did not restore the 20 defaults');
  assert(await page.locator('#reset-fields').isDisabled(), 'Reset still enabled at the defaults');
}));

check('no columns ticked: download off, with a hint', () => withPage({}, async ({ page }) => {
  await waitForExport(page);
  for (const g of await page.locator('.group-none').all()) if (await g.isEnabled()) await g.click();
  await settle(page, 200);
  assert(await page.locator('#download').isDisabled(), 'download enabled with no columns');
  assert(await page.getByText('Tick at least one column to export.').isVisible(), 'no hint');
  assert(await page.getByText('Tick some columns above').isVisible(), 'preview not replaced');
}));

check('ICEMS update counts: only ICEMS incidents, four at a time, counts match the Ops Logs', () => withPage({ opsLogDelayMs: 120 }, async ({ page, scenario, stats }) => {
  await waitForExport(page);
  const want = expectedJobs(scenario);
  const icems = want.filter((j) => j.ICEMSIncidentIdentifier);
  assert(icems.length >= 8, `only ${icems.length} ICEMS incidents in range`);
  assert(stats.opsLogs === 0, 'Ops Logs read before the column was ticked');
  await page.locator('#preview-table').waitFor();
  await field(page, 'ICEMSIUMTransactions').check();
  await page.locator('.icems-progress').waitFor();
  assert(await page.locator('#download').isDisabled(), 'download enabled while counting');
  await page.locator('.icems-progress').waitFor({ state: 'detached', timeout: 20000 });
  assert(stats.opsLogs === icems.length, `${stats.opsLogs} Ops Log requests for ${icems.length} ICEMS incidents`);
  assert(stats.opsLogMostAtOnce === 4, `${stats.opsLogMostAtOnce} Ops Log requests at once, expected 4`);

  const { text } = await downloadCsv(page);
  const rows = parseCsv(text);
  const col = rows[0].indexOf('ICEMSIUMTransactions');
  assert(col === rows[0].length - 1, 'ICEMS column not last');
  for (const [i, j] of want.entries()) {
    const got = rows[i + 1][col];
    const expected = j.ICEMSIncidentIdentifier ? String(scenario.opsLogs.get(j.Id).updates) : '';
    assert(got === expected, `${j.Identifier}: ${got}, expected "${expected}"`);
  }
  assert(stats.opsLogs === icems.length, 'download counted again');
}));

// The same seeded scenario the page will get, to pick a failing incident up front.
const failingIcems = expectedJobs(buildScenario(new Date(NOW))).filter((j) => j.ICEMSIncidentIdentifier)[0];

check('an Ops Log that fails leaves that count empty, with a note', () => withPage({ failOpsLogFor: [failingIcems.Id], storage: { 'lh-advexport-fields': JSON.stringify(['Identifier', 'ICEMSIUMTransactions']) } }, async ({ page }) => {
  await waitForExport(page);
  const note = page.getByText("Couldn't read the Ops Log for 1 ICEMS incident: their count is left empty.");
  await note.waitFor({ timeout: 10000 });
  const { text } = await downloadCsv(page);
  const row = parseCsv(text).find((r) => r[0] === failingIcems.Identifier);
  assert(row && row[1] === '', `failed incident's count "${row && row[1]}"`);
}));

check('Beacon errors: a message and Try again, which then loads', () => withPage({ failSearchTimes: 1 }, async ({ page, scenario }) => {
  await waitForExport(page);
  assert(!(await page.locator('.lh-page-footer').isVisible()), 'footer showing under the loading card');
  const msg = await page.locator('#export-loading .alert-danger').textContent();
  assert(msg.includes('Beacon returned 503'), `message "${msg.trim()}"`);
  await page.locator('#export-loading button', { hasText: 'Try again' }).click();
  await page.locator('#preview-table').waitFor();
  const count = await page.locator('#preview-title').textContent();
  assert(count.includes(`${expectedJobs(scenario).length} incidents`), `after Try again: "${count}"`);
}));

check('a failed Reload keeps the incidents and says so', () => withPage({}, async ({ page, stats }) => {
  await waitForExport(page);
  stats.failNext = 1;
  await page.locator('#reload').click();
  await page.getByText("Couldn't reload:").waitFor();
  assert(await page.locator('#preview-table tbody tr').count() === 10, 'preview gone after a failed reload');
  assert(await page.locator('#download').isEnabled(), 'download off after a failed reload');
}));

check('401 says to reopen the page from Beacon', () => withPage({ failSearch: 401 }, async ({ page }) => {
  await waitForExport(page);
  const msg = await page.locator('#export-loading .alert-danger').textContent();
  assert(msg.includes('Reopen Incident Export from Beacon'), `message "${msg.trim()}"`);
}));

check('no incidents in range: says so, nothing to download', () => withPage({ range: { start: new Date('2026-01-01T00:00:00+11:00'), end: new Date('2026-01-02T00:00:00+11:00') } }, async ({ page }) => {
  await waitForExport(page);
  assert(await page.getByText("No incidents in this range: there's nothing to export.").isVisible(), 'no empty message');
  assert(await page.locator('#download').isDisabled(), 'download enabled with no incidents');
}));

check('one HQ shows its name; no HQ is all of NSW', async () => {
  for (const [hq, title] of [[[9002], 'Incident Export: Demo Heights'], [[], 'Incident Export: NSW']]) {
    await withPage({ hq }, async ({ page }) => {
      await waitForExport(page);
      assert(await page.title() === title, `title "${await page.title()}", expected "${title}"`);
    });
  }
});

check('header colour follows Beacon; Guide links to the guide', async () => {
  const colours = {};
  for (const env of ['production', 'trainbeacon', 'devbeacon']) {
    await withPage({ env }, async ({ page }) => {
      await waitForExport(page);
      colours[env] = await page.locator('.lh-page-header').evaluate((el) => getComputedStyle(el).backgroundColor);
      if (env === 'production') {
        const href = await page.locator('.guide-link').getAttribute('href');
        assert(/^https:\/\/lighthouse\.ses\.nsw\.gov\.au\/(preview\/)?guides\/export\/$/.test(href), `guide link ${href}`);
      }
    });
  }
  assert(new Set(Object.values(colours)).size === 3, `header colours ${JSON.stringify(colours)}`);
});

check('follows the OS dark mode', () => withPage({ dark: true }, async ({ page }) => {
  await waitForExport(page);
  assert(await page.evaluate(() => document.documentElement.getAttribute('data-bs-theme')) === 'dark', 'not dark');
}));

await runChecks(checks);
