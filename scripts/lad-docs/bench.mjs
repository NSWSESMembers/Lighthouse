// LAD performance benchmark: loads a scaled-up fake scenario in headless
// Chrome and measures a few hot paths, reporting the median of several runs.
//
//   npm run dev && node scripts/lad-docs/bench.mjs [--jobs 1000] [--runs 5] [--root <repo>] [--cpu 4]
//
// To compare against a base, build the base in a worktree (with this
// scripts/lad-docs folder copied in) and pass it as --root. Times are in ms,
// from Chrome's Performance metrics (task = all main-thread work).
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const jobCount = Number(args.jobs || 1000);
const runs = Number(args.runs || 5);
const cpu = Number(args.cpu || 1);
const root = path.resolve(args.root || path.join(import.meta.dirname, '../..'));
const { launchLad, settle } = await import(pathToFileURL(path.join(root, 'scripts/lad-docs/launch.mjs')).href);

const METRICS = ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'JSHeapUsedSize'];
const delta = (a, b) => ({
  task: (b.TaskDuration - a.TaskDuration) * 1000,
  script: (b.ScriptDuration - a.ScriptDuration) * 1000,
  layout: (b.LayoutDuration - a.LayoutDuration) * 1000,
  style: (b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000,
});

async function run() {
  const { browser, page } = await launchLad({ now: '2026-10-15T10:00:00', jobCount });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics
    .filter((x) => METRICS.includes(x.name)).map((x) => [x.name, x.value]));
  const zoomBy = (dz) => page.evaluate((dz) => { const map = ko.dataFor(document.body).mapVM.map; map.setZoom(map.getZoom() + dz); }, dz);
  await settle(page, 800);

  // Load: close the config modal, wait until the marker count holds for 1.5 s.
  const l0 = await metrics();
  const t0 = Date.now();
  await page.locator('#configModal .modal-footer button.btn-primary').click();
  let size = -1, changedAt = Date.now();
  while (size <= 0 || Date.now() - changedAt < 1500) {
    const now = await page.evaluate(() => ko.dataFor(document.body)?.mapVM?.jobMarkerIndex?.size || 0);
    if (now !== size) { size = now; changedAt = Date.now(); }
    if (Date.now() - t0 > 120000) throw new Error('load timed out');
    await page.waitForTimeout(50);
  }
  const load = { ms: changedAt - t0, ...delta(l0, await metrics()), markers: size };
  await settle(page, 2500);

  // Zoom: 3 × (in 2 levels, clusters split; out 2 levels, markers collapse),
  // with a rAF recorder for long (≥ 50 ms) frames.
  const z0 = await metrics();
  await page.evaluate(() => {
    window.__frames = []; window.__recording = true;
    let last = performance.now();
    const tick = (t) => { window.__frames.push(t - last); last = t; if (window.__recording) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  for (let i = 0; i < 3; i++) {
    await zoomBy(2); await page.waitForTimeout(900);
    await zoomBy(-2); await page.waitForTimeout(900);
  }
  const frames = await page.evaluate(() => { window.__recording = false; return window.__frames.slice(1); });
  const zoom = { ...delta(z0, await metrics()), longFrames: frames.filter((f) => f >= 50).length, worstFrame: Math.max(0, ...frames) };

  // Status churn: flip up to 100 New/Active incidents to the other and back.
  const s0 = await metrics();
  const statusMs = await page.evaluate(async () => {
    const root = ko.dataFor(document.body);
    const jobs = [...root.jobsById.values()].filter((j) => j.marker && ['New', 'Active'].includes(j.statusName())).slice(0, 100);
    const flip = () => jobs.forEach((j) => j.jobStatusType(j.statusName() === 'New' ? { Id: 2, Name: 'Active' } : { Id: 1, Name: 'New' }));
    const t = performance.now();
    flip(); ko.tasks.runEarly();
    flip(); ko.tasks.runEarly();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - t;
  });
  const status = { ms: statusMs, ...delta(s0, await metrics()) };

  // Footprint with clustering off, so every marker is in the DOM.
  await page.evaluate(() => ko.dataFor(document.body).mapVM.applyClusterEnabled(false));
  await settle(page, 1000);
  const footprint = {
    markerEls: await page.evaluate(() => document.querySelectorAll('.leaflet-marker-icon').length),
    domNodes: await page.evaluate(() => document.getElementsByTagName('*').length),
    heapMB: (await metrics()).JSHeapUsedSize / 1048576,
  };

  await browser.close();
  return { load, zoom, status, footprint };
}

const results = [];
for (let i = 0; i < runs; i++) {
  results.push(await run());
  process.stderr.write(`run ${i + 1}/${runs} done\n`);
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log(`LAD bench: ${jobCount} incidents, ${runs} runs (median), CPU ×${cpu}, ${root}`);
for (const phase of Object.keys(results[0])) {
  const cols = Object.keys(results[0][phase]).map((k) => `${k} ${median(results.map((r) => r[phase][k])).toFixed(1)}`);
  console.log(`  ${phase.padEnd(9)} ${cols.join('  ')}`);
}
