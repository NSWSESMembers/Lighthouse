/*
  End-to-end checks for the built Incident Summary page, in headless Chrome
  against the fake demo data. Complements the vitest unit tests
  (src/pages/summary/**\/*.test.js), which can't run the bindings or the page.

    npm run dev && npm run summary:check
    npm run summary:check -- --verbose

  Exits non-zero if any check fails.
*/

import { launchSummary, waitForSummary, settle } from './launch.mjs';
import { summaryRows } from './scenario.mjs';
import { assert, runChecks } from '../page-docs/runners.mjs';

const NOW = '2026-10-15T15:30:00+11:00';
const verbose = process.argv.includes('--verbose');
const base = { now: NOW, launch: 'today', verbose };

const cell = (page, key) => page.locator(`#tile-${key} .lh-value`);
const cellNumber = async (page, key) => Number((await cell(page, key).textContent()).replace(/,/g, ''));

/** What the mock would answer for the page's current range, summed like the page. */
async function expectedCounts(page, scenario, hqs) {
  const range = await page.evaluate(() => {
    const r = window.summaryVM.range();
    return { start: r.start.toISOString(), end: r.end.toISOString() };
  });
  const rows = Object.fromEntries(summaryRows(scenario, { hqs, start: new Date(range.start), end: new Date(range.end) }).map((r) => [r.Name, r.Count]));
  const sum = (...names) => names.reduce((n, k) => n + rows[k], 0);
  return {
    outstanding: sum('New', 'Active', 'Tasked', 'Referred'),
    completed: sum('Complete', 'Cancelled', 'Rejected', 'Finalised'),
    new: rows.New,
    rescue: sum('RCR', 'FR', 'WR', 'VR', 'CFR', 'LAR', 'GLR', 'PAD'),
    flood: sum('Flood Misc', 'Medical Resupply', 'Fodder Drop', 'Resupply', 'Vet Assistance'),
  };
}

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

check('loads all four demo units: counts match Beacon, no page errors', async () => {
  const { browser, page, scenario, pageErrors } = await launchSummary(base);
  try {
    await waitForSummary(page);
    const want = await expectedCounts(page, scenario, scenario.units.map((u) => u.Id));
    assert(!(await page.evaluate(() => window.summaryVM.error())), 'error shown');
    for (const key of ['outstanding', 'completed', 'new', 'rescue', 'flood']) {
      const got = await cellNumber(page, key);
      assert(got === want[key], `${key} shows ${got}, expected ${want[key]}`);
    }
    assert(await cellNumber(page, 'total') === want.outstanding + want.completed, 'total is not outstanding + completed');
    assert(want.outstanding + want.completed > 20, 'scenario too thin to check anything');
    assert(await page.title() === 'Incident Summary: 4 DMZ units', `title "${await page.title()}"`);
    assert((await page.locator('.lh-heading-scope').textContent()) === '4 DMZ units', 'title box');
    const pct = await page.locator('#tile-new .lh-subscript').textContent();
    assert(/^(\d+%|—)$/.test(pct), `New share "${pct}"`);
    assert(/Thursday/.test(await page.locator('.date-box').textContent()), 'date box has no weekday');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('one HQ shows its name; no HQ is all of NSW', async () => {
  for (const [hq, title] of [[[9002], 'Demo Heights'], [[], 'NSW']]) {
    const { browser, page, pageErrors } = await launchSummary({ ...base, hq });
    try {
      await waitForSummary(page);
      const got = await page.locator('.lh-heading-scope').textContent();
      assert(got === title, `title box "${got}", expected "${title}"`);
      assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
    } finally {
      await browser.close();
    }
  }
});

check('range buttons reload: the last 7 days has more incidents than today', async () => {
  const { browser, page, scenario } = await launchSummary(base);
  try {
    await waitForSummary(page);
    const today = await cellNumber(page, 'total');
    await page.locator('label[for="range-168"]').click();
    await page.waitForFunction((n) => Number(document.querySelector('#tile-total .lh-value').textContent.replace(/,/g, '')) !== n, today);
    await settle(page, 300);
    const week = await cellNumber(page, 'total');
    assert(week > today, `7 days ${week} not above today ${today}`);
    const want = await expectedCounts(page, scenario, scenario.units.map((u) => u.Id));
    assert(week === want.outstanding + want.completed, `7 days shows ${week}, expected ${want.outstanding + want.completed}`);
    assert(/Thursday/.test(await page.locator('.date-box').textContent()), 'date box start is not a week ago');
  } finally {
    await browser.close();
  }
});

check('new incidents on a refresh highlight New and play the chosen sound', async () => {
  const { browser, page, scenario, pageErrors } = await launchSummary({ ...base, storage: { LighthouseSummaryNewJobSound: 'Chime' } });
  try {
    await waitForSummary(page);
    await page.evaluate(() => {
      window.__played = [];
      HTMLMediaElement.prototype.play = function () { window.__played.push(this.src); return Promise.resolve(); };
    });
    const before = await cellNumber(page, 'new');
    // A refresh with nothing new: quiet.
    await page.locator('.footer-refresh button').click();
    await settle(page, 500);
    assert(!(await page.evaluate(() => window.__played.length)), 'played with nothing new');
    scenario.addNew(3);
    await page.locator('.footer-refresh button').click();
    await page.waitForFunction((n) => Number(document.querySelector('#tile-new .lh-value').textContent) === n + 3, before);
    await settle(page, 300);
    assert(await page.locator('#tile-new.is-new').count() === 1, 'New not highlighted');
    const played = await page.evaluate(() => window.__played);
    assert(played.length === 1 && played[0].endsWith('/pages/sounds/chime.mp3'), `played ${JSON.stringify(played)}`);
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('Settings: dark colours apply, are remembered, and old themes carry over', async () => {
  const { browser, page } = await launchSummary(base);
  try {
    await waitForSummary(page);
    await page.locator('#settings-button').click();
    await page.locator('#settings-modal.show').waitFor();
    assert(await page.locator('#settings-modal input[name="theme"]').count() === 3, 'theme choices');
    assert(await page.locator('#sound-select option').count() === 5, 'sound choices');
    await page.locator('label[for="theme-dark"]').click();
    await settle(page, 300);
    assert(await page.evaluate(() => document.documentElement.getAttribute('data-bs-theme')) === 'dark', 'not dark');
    assert(await page.evaluate(() => localStorage.getItem('LighthouseSummaryTheme')) === 'dark', 'not saved');
    await page.locator('#settings-modal .modal-footer button').click();
    await page.locator('#settings-modal').waitFor({ state: 'hidden' });
    await page.reload();
    await waitForSummary(page);
    assert(await page.evaluate(() => document.documentElement.getAttribute('data-bs-theme')) === 'dark', 'not dark after reload');
  } finally {
    await browser.close();
  }
  const old = await launchSummary({ ...base, storage: { LighthouseSummaryTheme: 'boo' }, dark: true });
  try {
    await waitForSummary(old.page);
    const theme = await old.page.evaluate(() => document.documentElement.getAttribute('data-bs-theme'));
    assert(theme === 'light', `old "black on orange" gave ${theme}`);
  } finally {
    await old.browser.close();
  }
});

check('boxes are coloured by Beacon: orange, green for Train, blue for Dev', async () => {
  for (const [env, colour] of [['production', 'rgb(247, 147, 29)'], ['trainbeacon', 'rgb(33, 159, 86)'], ['devbeacon', 'rgb(45, 158, 224)']]) {
    const { browser, page } = await launchSummary({ ...base, env });
    try {
      await waitForSummary(page);
      const [title, box] = await page.evaluate(() => [
        getComputedStyle(document.querySelector('.title-box')).backgroundColor,
        getComputedStyle(document.querySelector('.headline')).backgroundColor,
      ]);
      assert(title === colour && box === colour, `${env}: title box ${title}, Summary box ${box}`);
    } finally {
      await browser.close();
    }
  }
});

check('big counts fit their cells', async () => {
  const { browser, page } = await launchSummary({ ...base, viewport: { width: 1024, height: 768 } });
  try {
    await waitForSummary(page);
    // Feed a huge report through the page's own load.
    await page.route('**/Reports/JobsSummary**', (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ result: [{ Name: 'New', Count: 120316 }, { Name: 'Complete', Count: 999999 }, { Name: 'Storm', Count: 1120315 }] }),
    }));
    await page.locator('.footer-refresh button').click();
    await page.waitForFunction(() => document.querySelector('#tile-total .lh-value').textContent === '1,120,315');
    await settle(page, 300);
    const overflow = await page.$$eval('.lh-value', (els) => els.filter((e) => e.scrollWidth > e.parentElement.clientWidth + 1).map((e) => e.textContent));
    assert(!overflow.length, `overflowing: ${overflow.join(', ')}`);
  } finally {
    await browser.close();
  }
});

check('a Beacon error shows why and offers Try again', async () => {
  const { browser, page, pageErrors } = await launchSummary({ ...base, failSummary: 500 });
  try {
    await waitForSummary(page);
    const text = await page.locator('#summary-loading .alert-danger').textContent();
    assert(/Beacon returned 500/.test(text), `error "${text.trim()}"`);
    assert(await page.locator('#summary-loading button', { hasText: 'Try again' }).isVisible(), 'no Try again');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

/** Answer the page's next JobsSummary requests with `status` until the returned function is called. */
async function breakBeacon(page, status) {
  const handler = (route) => route.fulfill({ status, contentType: 'application/json', body: '{"Message":"Demo failure"}' });
  await page.route('**/Reports/JobsSummary**', handler);
  return () => page.unroute('**/Reports/JobsSummary**', handler);
}

check('a failed refresh keeps the numbers up and recovers by itself', async () => {
  const { browser, page, pageErrors } = await launchSummary(base);
  try {
    await waitForSummary(page);
    const before = await cellNumber(page, 'total');
    const fix = await breakBeacon(page, 503);
    await page.locator('.footer-refresh button').click();
    await page.locator('.alert-warning', { hasText: "Couldn't refresh" }).waitFor();
    assert(await cellNumber(page, 'total') === before, 'numbers changed after a failed refresh');
    // The countdown keeps running after the error (it froze before).
    const t0 = await page.evaluate(() => window.summaryVM.secondsToRefresh());
    await page.waitForTimeout(2200);
    const t1 = await page.evaluate(() => window.summaryVM.secondsToRefresh());
    assert(t1 < t0, `countdown stuck at ${t0} after the error`);
    await fix();
    await page.evaluate(() => window.summaryVM.secondsToRefresh(2)); // skip the wait
    await page.waitForFunction(() => !window.summaryVM.error(), null, { timeout: 8000 });
    assert(!(await page.locator('.alert-warning').count()), 'warning still showing');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('a failed first load tries again by itself', async () => {
  const { browser, page, pageErrors } = await launchSummary({ ...base, failSummaryTimes: 1 });
  try {
    await page.locator('#summary-loading .alert-danger').waitFor();
    const text = await page.locator('#retry-countdown').textContent();
    assert(/^Trying again in 00:(30|29|28)$/.test(text), `retry text "${text}"`);
    await page.evaluate(() => window.summaryVM.secondsToRefresh(2)); // skip the wait
    await page.waitForFunction(() => !window.summaryVM.loading(), null, { timeout: 8000 });
    assert(await cellNumber(page, 'total') > 0, 'no numbers after the retry');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('a failed range switch keeps the shown dates and range button', async () => {
  const { browser, page } = await launchSummary(base);
  try {
    await waitForSummary(page);
    const dates = await page.locator('.date-box').textContent();
    await breakBeacon(page, 500);
    await page.locator('label[for="range-168"]').click();
    await page.locator('.alert-warning', { hasText: "Couldn't refresh" }).waitFor();
    await settle(page, 300);
    assert(await page.locator('.date-box').textContent() === dates, 'date box changed for a range that failed to load');
    assert(await page.locator('#range-launch').isChecked(), 'range button not put back');
  } finally {
    await browser.close();
  }
});

check('a quick load never flashes the ring', async () => {
  const { browser, page } = await launchSummary({ ...base, summaryDelayMs: 0 });
  try {
    // Watch the ring from the start: was it ever on screen?
    await page.evaluate(() => {
      const el = document.getElementById('summary-loading');
      window.__ringShown = el.offsetParent !== null;
      new MutationObserver(() => { if (el.offsetParent !== null) window.__ringShown = true; })
        .observe(el, { attributes: true, attributeFilter: ['style'] });
    });
    await waitForSummary(page);
    assert(!(await page.evaluate(() => window.__ringShown)), 'the ring showed for a quick load');
  } finally {
    await browser.close();
  }
});

check('a slow Beacon: the ring spins, then says it is still waiting', async () => {
  const { browser, page, pageErrors } = await launchSummary({ ...base, summaryDelayMs: 30000 });
  try {
    await page.locator('#summary-loading .loader-ring.spinning').waitFor({ timeout: 5000 });
    const first = await page.locator('#summary-loading .loader-title').textContent();
    assert(first === 'Asking Beacon for the incident summary…', `title "${first}"`);
    await page.locator('#summary-loading .loader-slow').waitFor({ timeout: 15000 });
    assert(await page.locator('#summary-loading .loader-title').textContent() === 'Still waiting for Beacon', 'not still waiting');
    assert(await page.locator('#summary-loading button', { hasText: 'Load the last 24 h instead' }).isVisible(), 'no shorter-range button');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('Settings links to the guide (preview copy in a Development build)', async () => {
  for (const [watermark, expected] of [[false, 'https://lighthouse.ses.nsw.gov.au/guides/summary/'], [true, 'https://lighthouse.ses.nsw.gov.au/preview/guides/summary/']]) {
    const { browser, page } = await launchSummary({ ...base, watermark });
    try {
      await waitForSummary(page);
      await page.locator('#settings-button').click();
      await page.locator('#settings-modal.show').waitFor();
      const link = page.locator('#settings-modal a.guide-link');
      assert(await link.isVisible(), 'no Guide button in Settings');
      const href = await link.getAttribute('href');
      assert(href === expected, `guide link ${href}, expected ${expected}`);
    } finally {
      await browser.close();
    }
  }
});

check('colours follow the OS dark mode by default', async () => {
  const { browser, page } = await launchSummary({ ...base, dark: true });
  try {
    await waitForSummary(page);
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-bs-theme'));
    assert(theme === 'dark', `data-bs-theme=${theme}`);
  } finally {
    await browser.close();
  }
});

await runChecks(checks);
