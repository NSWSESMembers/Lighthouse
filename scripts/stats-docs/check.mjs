/*
  End-to-end checks for the built Incident Statistics page, in headless Chrome
  against the fake demo data. Complements the vitest unit tests
  (src/pages/stats/**\/*.test.js), which can't run dc.js or the page.

    npm run dev && npm run stats:check
    npm run stats:check -- --verbose

  Exits non-zero if any check fails.
*/

import { launchStats, waitForStats, settle } from './launch.mjs';
import { assert, runChecks } from '../page-docs/runners.mjs';
import { wordFrequencies } from '../../src/pages/stats/data/wordCount.js';

const NOW = '2026-10-15T15:30:00+11:00';
const verbose = process.argv.includes('--verbose');

const vmState = (page) => page.evaluate(() => {
  const vm = window.statsVM;
  return {
    error: vm.error(),
    loading: vm.loading(),
    total: vm.totalCount(),
    filtered: vm.filteredCount(),
    title: document.title,
    rows: vm.latestJobs().length,
    firstRow: vm.latestJobs()[0] || null,
    typeFiltered: vm.breakdowns.find((b) => b.key === 'type').filtered(),
    rangeText: vm.rangeText(),
    receivedTitle: vm.receivedTitle(),
    tiles: vm.durationTiles().map((t) => t.value),
  };
});

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

check('loads all four demo units with no page errors', async () => {
  const { browser, page, scenario, pageErrors } = await launchStats({ now: NOW, verbose });
  try {
    await waitForStats(page);
    const s = await vmState(page);
    assert(!s.error, `error shown: ${s.error}`);
    // Parse the offset-free Beacon times in the page, which is pinned to Sydney.
    const expected = await page.evaluate(({ received, from }) => received.filter((r) => new Date(r) >= new Date(from)).length,
      { received: scenario.jobs.map((j) => j.JobReceived), from: Date.parse(NOW) - 72 * 3600e3 });
    assert(s.total === expected, `total ${s.total}, expected ${expected}`);
    assert(s.filtered === s.total, 'unfiltered count differs from total');
    assert(s.title === 'Incident Statistics: 4 DMZ units', `title "${s.title}"`);
    assert(s.rows === 15, `latest incidents rows ${s.rows}`);
    assert(s.firstRow.closedText !== 'false', 'closed column shows a window global');
    assert(s.tiles.every((t) => t !== '—'), `duration tiles ${s.tiles}`);
    const pies = await page.locator('.chart-card g.pie-slice').count();
    assert(pies > 14, `only ${pies} pie slices drawn`);
    assert(await page.locator('#word-cloud svg text').count() > 10, 'word cloud empty');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('word cloud tooltips give each word\'s mention count', async () => {
  const { browser, page, scenario, pageErrors } = await launchStats({ now: NOW, verbose });
  try {
    await waitForStats(page);
    const titles = await page.$$eval('#word-cloud text title', (ts) => ts.map((t) => t.textContent));
    assert(titles.length > 10, `only ${titles.length} words`);
    const bad = titles.filter((t) => !/^[a-z'-]+: \d+ mentions?$/.test(t));
    assert(!bad.length, `tooltips like "${bad[0]}"`);
    // Counts match the page's own word counting over the loaded incidents
    // (received in the last 72 h; parsed in the page, which is on Sydney time).
    const inRange = await page.evaluate(({ jobs, from }) => jobs.filter((j) => new Date(j.received) >= new Date(from)).map((j) => j.situation),
      { jobs: scenario.jobs.map((j) => ({ received: j.JobReceived, situation: j.SituationOnScene })), from: Date.parse(NOW) - 72 * 3600e3 });
    const expected = new Map(wordFrequencies(inRange).map((w) => [w.text, w.weight]));
    for (const t of titles) {
      const [, word, count] = t.match(/^(.+): (\d+)/);
      assert(expected.get(word) === Number(count), `"${word}" shows ${count}, expected ${expected.get(word)}`);
    }
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('clicking a pie legend entry filters every figure; reset clears it', async () => {
  const { browser, page, pageErrors } = await launchStats({ now: NOW, verbose });
  try {
    await waitForStats(page);
    const before = await vmState(page);
    // The legend entry, not the slice: a big slice's centre lands on its neighbour.
    await page.locator('#legend-type .pie-legend-row').first().click();
    await settle(page, 600);
    const after = await vmState(page);
    assert(after.filtered < before.total && after.filtered > 0, `filtered ${after.filtered} of ${before.total}`);
    assert(after.typeFiltered, 'Incident Type card not marked filtered');
    assert(await page.locator('.stats-toolbar button', { hasText: 'Clear all filters' }).isVisible(), 'Clear all filters hidden');
    await page.locator('.stats-toolbar button', { hasText: 'Clear all filters' }).click();
    await settle(page, 600);
    const cleared = await vmState(page);
    assert(cleared.filtered === cleared.total, 'filters not cleared');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('brushing the received chart filters by time', async () => {
  const { browser, page, pageErrors } = await launchStats({ now: NOW, verbose });
  try {
    await waitForStats(page);
    const plot = page.locator('#chart-received g.chart-body');
    await plot.scrollIntoViewIfNeeded();
    const box = await plot.boundingBox();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.95, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await settle(page, 600);
    const s = await vmState(page);
    assert(s.filtered < s.total && s.filtered > 0, `filtered ${s.filtered} of ${s.total}`);
    assert(await page.evaluate(() => window.statsVM.receivedFiltered()), 'received chart not marked filtered');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('range buttons reload: 24 h has fewer jobs, 7 days more', async () => {
  const { browser, page, pageErrors } = await launchStats({ now: NOW, verbose });
  try {
    await waitForStats(page);
    const base = await vmState(page);
    await page.locator('label[for="range-24"]').click();
    await page.waitForFunction((n) => window.statsVM.totalCount() !== n, base.total);
    await settle(page, 500);
    const day = await vmState(page);
    assert(day.total < base.total, `24 h total ${day.total} not below ${base.total}`);
    await page.locator('label[for="range-168"]').click();
    await page.waitForFunction(() => !window.statsVM.refreshing());
    await settle(page, 500);
    const week = await vmState(page);
    assert(week.total > base.total, `7 day total ${week.total} not above ${base.total}`);
    assert(week.receivedTitle === 'Incidents received per hour', `title ${week.receivedTitle}`);
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('a 30-day launch range uses daily buckets', async () => {
  const { browser, page, pageErrors } = await launchStats({ now: NOW, verbose, hours: 24 * 30 });
  try {
    await waitForStats(page);
    const s = await vmState(page);
    assert(s.receivedTitle === 'Incidents received per day', `title ${s.receivedTitle}`);
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('a filter survives a refresh', async () => {
  const { browser, page, pageErrors } = await launchStats({ now: NOW, verbose });
  try {
    await waitForStats(page);
    await page.locator('#legend-priority .pie-legend-row').first().click();
    await settle(page, 500);
    const before = await vmState(page);
    await page.locator('.stats-toolbar button[title^="Refresh now"]').click();
    await page.waitForFunction(() => !window.statsVM.refreshing());
    await settle(page, 600);
    const after = await vmState(page);
    assert(after.filtered === before.filtered && after.filtered < after.total, `filtered ${before.filtered} -> ${after.filtered}`);
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('a single HQ is titled by its name', async () => {
  const { browser, page } = await launchStats({ now: NOW, verbose, hq: [9002] });
  try {
    await waitForStats(page);
    const s = await vmState(page);
    assert(s.title === 'Incident Statistics: Demo Heights', `title "${s.title}"`);
  } finally {
    await browser.close();
  }
});

check('the loading ring spins, then counts incidents page by page', async () => {
  const { browser, page, scenario, pageErrors } = await launchStats({ now: NOW, verbose, firstPageDelayMs: 1500, pageDelayMs: 900 });
  const view = () => page.evaluate(() => {
    const l = window.statsVM.loader();
    return { title: l.title, value: l.centreValue, label: l.centreLabel, meta: l.meta, spinning: l.indeterminate, dots: l.pageDots.map((d) => d.done) };
  });
  try {
    await page.waitForFunction(() => window.statsVM);
    const total = await page.evaluate(({ received, from }) => received.filter((r) => new Date(r) >= new Date(from)).length,
      { received: scenario.jobs.map((j) => j.JobReceived), from: Date.parse(NOW) - 72 * 3600e3 });
    const pages = Math.ceil(total / 100);
    const first = await view();
    assert(first.spinning && first.title === 'Asking Beacon for incidents…', `before the first page: ${JSON.stringify(first)}`);
    assert(await page.locator('.loader-ring.spinning').isVisible(), 'ring not spinning');
    await page.waitForFunction(() => window.statsVM.loadPhase() === 'incidents');
    const mid = await view();
    assert(!mid.spinning && mid.title === 'Loading incidents' && mid.value === '100' && mid.label === `of ${total}`, `after page 1: ${JSON.stringify(mid)}`);
    assert(mid.dots.length === pages && mid.dots.filter(Boolean).length === 1 && mid.meta === `page 1 of ${pages}`, `pages: ${JSON.stringify(mid)}`);
    assert(await page.locator('.loader-value').textContent() === '100', 'ring centre not showing the count');
    await page.waitForFunction(() => window.statsVM.loadLoaded() >= 200);
    const later = await view();
    assert(later.value === '200' && later.meta.startsWith(`page 2 of ${pages}`), `after page 2: ${JSON.stringify(later)}`);
    await waitForStats(page, { cloud: false });
    assert(!(await page.locator('#stats-loading').isVisible()), 'loader still showing');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('ring text fits inside the ring, even for big counts', async () => {
  const { browser, page } = await launchStats({ now: NOW, verbose, firstPageDelayMs: 60000 });
  try {
    // The page's own load must have started, or it resets what we set.
    await page.waitForFunction(() => window.statsVM && window.statsVM.token() && window.statsVM.loadPhase() === 'starting');
    const overflow = [];
    for (const [loaded, total] of [[100, 311], [9193, 20316], [99999, 120316]]) {
      const widths = await page.evaluate(async ([l, t]) => {
        const vm = window.statsVM;
        vm.firstPageAt(Date.now() - 5000);
        vm.lastPageAt(Date.now());
        vm.loadTotal(t);
        vm.loadLoaded(l);
        vm.loadPhase('incidents');
        await new Promise((r) => setTimeout(r, 50));
        return [...document.querySelectorAll('.loader-ring text')].map((el) => ({ text: el.textContent, w: el.getBBox().width }));
      }, [loaded, total]);
      // Inner edge of the ring: radius 52 less half its 10-unit stroke, a little margin.
      assert(widths.map((x) => x.text).join(' ') === `${loaded.toLocaleString('en-AU')} of ${total.toLocaleString('en-AU')} incidents`, `ring shows ${JSON.stringify(widths)}`);
      for (const { text, w } of widths) if (w > 88) overflow.push(`"${text}" is ${w.toFixed(0)} wide`);
    }
    assert(!overflow.length, overflow.join('; '));
  } finally {
    await browser.close();
  }
});

check('a slow first page says so and offers a shorter range', async () => {
  const { browser, page } = await launchStats({ now: NOW, verbose, firstPageDelayMs: 12000 });
  try {
    await page.waitForFunction(() => window.statsVM && window.statsVM.loader().slow, null, { timeout: 15000 });
    assert(await page.locator('.loader-title').textContent() === 'Still waiting for Beacon', 'title');
    await page.locator('button', { hasText: 'Load the last 24 h instead' }).click();
    await page.waitForFunction(() => window.statsVM.rangeChoice() === '24' && !window.statsVM.loader().slow);
    await waitForStats(page, { cloud: false });
    const total = await page.evaluate(() => window.statsVM.totalCount());
    assert(total > 0 && total < 300, `24 h total ${total}`);
  } finally {
    await browser.close();
  }
});

check('a Beacon error shows a message and Try again', async () => {
  const { browser, page } = await launchStats({ now: NOW, verbose, failSearch: 401 });
  try {
    await waitForStats(page, { cloud: false });
    const s = await vmState(page);
    assert(s.loading && /401/.test(s.error || ''), `error "${s.error}"`);
    assert(await page.locator('button', { hasText: 'Try again' }).first().isVisible(), 'no Try again button');
  } finally {
    await browser.close();
  }
});

check('header colour follows the Beacon it was opened from', async () => {
  const colours = {};
  for (const env of ['production', 'trainbeacon', 'devbeacon']) {
    const { browser, page } = await launchStats({ now: NOW, verbose, env });
    try {
      await waitForStats(page, { cloud: false });
      colours[env] = await page.evaluate(() => getComputedStyle(document.querySelector('.lh-page-header')).backgroundColor);
    } finally {
      await browser.close();
    }
  }
  assert(colours.production === 'rgb(247, 147, 29)', `production ${colours.production}`);
  assert(colours.trainbeacon === 'rgb(33, 159, 86)', `train ${colours.trainbeacon}`);
  assert(colours.devbeacon === 'rgb(45, 158, 224)', `dev ${colours.devbeacon}`);
});

check('breakdown cards drag, resize, stay put after reload, and reset', async () => {
  const { browser, page, pageErrors } = await launchStats({ now: NOW, verbose });
  const pos = (id) => page.locator(`.grid-stack-item[gs-id="${id}"]`).evaluate((el) => ({
    x: Number(el.getAttribute('gs-x')), y: Number(el.getAttribute('gs-y')), w: Number(el.getAttribute('gs-w')), h: Number(el.getAttribute('gs-h')),
  }));
  try {
    await waitForStats(page, { cloud: false });
    assert(await page.locator('.breakdown-group-title').allTextContents().then((t) => t.join('|')) === 'Incident|Location|Damage and tags', 'group titles');
    const start = await pos('status');
    assert(start.x === 0 && start.y === 0 && start.w === 4, `status starts at ${JSON.stringify(start)}`);

    // Drag Incident Status by its header to where Priority is (top right).
    const header = page.locator('.grid-stack-item[gs-id="status"] .card-header');
    const target = await page.locator('.grid-stack-item[gs-id="priority"] .card-header').boundingBox();
    const hb = await header.boundingBox();
    await page.mouse.move(hb.x + 60, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + 60, target.y + target.height / 2, { steps: 15 });
    await page.mouse.up();
    await settle(page, 600);
    const moved = await pos('status');
    assert(moved.x === 8, `status moved to ${JSON.stringify(moved)}`);

    // Resize Incident Type from its bottom-right corner to the full width.
    const type = page.locator('.grid-stack-item[gs-id="type"]');
    await type.hover();
    const handle = type.locator('.ui-resizable-se');
    const box = await handle.boundingBox();
    const grid = await page.locator('#grid-incident').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(grid.x + grid.width - 4, box.y + 60, { steps: 15 });
    await page.mouse.up();
    await settle(page, 600);
    const resized = await pos('type');
    assert(resized.w >= 11, `type width ${resized.w}`);
    // The donut grows with the card.
    const donut = await page.locator('#chart-type svg').boundingBox();
    assert(donut.height > 200, `donut ${Math.round(donut.height)}px`);

    // (Widening Incident Type pushes Incident Status down a row.)
    const before = { status: await pos('status'), type: await pos('type') };
    await page.reload();
    await waitForStats(page, { cloud: false });
    const after = { status: await pos('status'), type: await pos('type') };
    assert(JSON.stringify(after) === JSON.stringify(before), `after reload ${JSON.stringify(after)}, before ${JSON.stringify(before)}`);

    await page.locator('button', { hasText: 'Reset layout' }).click();
    await settle(page, 600);
    const reset = await pos('status');
    assert(reset.x === 0 && reset.y === 0 && reset.w === 4, `status after reset ${JSON.stringify(reset)}`);
    assert(await page.evaluate(() => localStorage.getItem('lh-statsLayout.v1')) === null, 'saved layout not cleared');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('a narrower window (6 columns) remembers its own layout, separately', async () => {
  const { browser, page, pageErrors } = await launchStats({ now: NOW, verbose, viewport: { width: 1000, height: 1000 } });
  const pos = (id) => page.locator(`.grid-stack-item[gs-id="${id}"]`).evaluate((el) => ['x', 'y', 'w', 'h'].map((k) => el.getAttribute('gs-' + k)).join(','));
  try {
    await waitForStats(page, { cloud: false });
    const columns = await page.evaluate(() => document.querySelector('#grid-incident').gridstack.getColumn());
    assert(columns === 6, `grid has ${columns} columns`);
    const hb = await page.locator('.grid-stack-item[gs-id="status"] .card-header').boundingBox();
    const tb = await page.locator('.grid-stack-item[gs-id="type"] .card-header').boundingBox();
    await page.mouse.move(hb.x + 40, hb.y + 10);
    await page.mouse.down();
    await page.mouse.move(tb.x + tb.width - 20, tb.y + 10, { steps: 15 });
    await page.mouse.up();
    await settle(page, 600);
    const before = await pos('status');
    assert(before !== '0,0,3,6', `status didn't move: ${before}`);
    await page.reload();
    await waitForStats(page, { cloud: false });
    assert(await pos('status') === before, `status after reload ${await pos('status')}, before ${before}`);

    // The wide layout is untouched, both after a live resize and a reload.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await settle(page, 600);
    assert(await pos('status') === '0,0,4,6', `wide layout after resize: ${await pos('status')}`);
    await page.reload();
    await waitForStats(page, { cloud: false });
    assert(await pos('status') === '0,0,4,6', `wide layout changed: ${await pos('status')}`);
    // And back: the narrow layout comes back on a live resize.
    await page.setViewportSize({ width: 1000, height: 1000 });
    await settle(page, 600);
    assert(await pos('status') === before, `narrow layout after resize back: ${await pos('status')}`);
    assert(!pageErrors.length, `page errors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});

check('pie colours never repeat within a chart', async () => {
  const { browser, page } = await launchStats({ now: NOW, verbose });
  try {
    await waitForStats(page, { cloud: false });
    const dupes = await page.$$eval('.pie-legend', (legends) => legends.map((l) => {
      const colours = [...l.querySelectorAll('.pie-legend-swatch')].map((s) => s.style.backgroundColor);
      return colours.length !== new Set(colours).size ? l.id : null;
    }).filter(Boolean));
    assert(!dupes.length, `repeated colours in ${dupes.join(', ')}`);
  } finally {
    await browser.close();
  }
});

check('a filtered pie shows its selected count in the middle', async () => {
  const { browser, page } = await launchStats({ now: NOW, verbose });
  try {
    await waitForStats(page, { cloud: false });
    await page.locator('#legend-type .pie-legend-row').first().click();
    await page.mouse.move(0, 0);
    await settle(page, 500);
    const [value, label] = await page.locator('#chart-type .pie-centre text').allTextContents();
    const filtered = await page.evaluate(() => window.statsVM.filteredCount());
    assert(label === 'selected' && Number(value.replace(/,/g, '')) === filtered, `centre "${value} ${label}", filtered ${filtered}`);
  } finally {
    await browser.close();
  }
});

check('the header links to the guide (preview copy in a Development build)', async () => {
  for (const [watermark, expected] of [[false, 'https://lighthouse.ses.nsw.gov.au/guides/stats/'], [true, 'https://lighthouse.ses.nsw.gov.au/preview/guides/stats/']]) {
    const { browser, page } = await launchStats({ now: NOW, verbose, watermark });
    try {
      await waitForStats(page, { cloud: false });
      const href = await page.locator('.lh-page-header a.guide-link').getAttribute('href');
      assert(href === expected, `guide link ${href}, expected ${expected}`);
    } finally {
      await browser.close();
    }
  }
});

check('dark mode follows the OS setting', async () => {
  const { browser, page } = await launchStats({ now: NOW, verbose, dark: true });
  try {
    await waitForStats(page, { cloud: false });
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-bs-theme'));
    assert(theme === 'dark', `data-bs-theme=${theme}`);
  } finally {
    await browser.close();
  }
});

await runChecks(checks);
