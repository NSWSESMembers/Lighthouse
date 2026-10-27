/*
  The check and screenshot loops shared by scripts/<page>-docs/check.mjs
  and capture.mjs.
*/

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, arg } from './launchPage.mjs';

export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/**
 * Run named async checks one after another, print ✓/✗ for each, and exit
 * non-zero if any failed.
 *
 * @param {Array<{name: string, fn: () => Promise<void>}>} checks
 */
export async function runChecks(checks) {
  let failed = 0;
  for (const { name, fn } of checks) {
    try {
      await fn();
      console.log(`✓ ${name}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${name}: ${err.message.split('\n')[0]}`);
    }
  }
  console.log(failed ? `\n${failed} of ${checks.length} checks failed` : `\nAll ${checks.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

/**
 * Capture a shot list. Each shot starts from a fresh page:
 *   { launch?: extra launch options, run(page, launched), target?(page) -> something with .screenshot() }
 * (`launched` is what opts.launch returned, e.g. with the scenario.)
 * Reads --out and --only from the command line.
 *
 * @param {object} opts
 * @param {Record<string, object>} opts.shots
 * @param {(launchOpts: object) => Promise<{browser, page, pageErrors}>} opts.launch
 * @param {string} opts.defaultOut  output folder relative to the repo root
 * @param {(page) => Promise<void>} [opts.beforeShot]  e.g. unstick a sticky toolbar
 */
export async function runShots({ shots, launch, defaultOut, beforeShot }) {
  const outDir = path.resolve(ROOT, arg('out', defaultOut));
  const only = (arg('only', '') || '').split(',').filter(Boolean);
  const names = only.length ? only : Object.keys(shots);
  const unknown = names.filter((n) => !shots[n]);
  if (unknown.length) {
    console.error(`Unknown shot(s): ${unknown.join(', ')}\nAvailable: ${Object.keys(shots).join(', ')}`);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  let failed = 0;
  for (const name of names) {
    const shot = shots[name];
    const launched = await launch(shot.launch || {});
    const { browser, page, pageErrors } = launched;
    try {
      await shot.run(page, launched);
      if (beforeShot) await beforeShot(page);
      if (pageErrors.length) throw new Error(`page error: ${pageErrors[0]}`);
      const file = path.join(outDir, `${name}.png`);
      const target = shot.target ? shot.target(page) : page;
      await target.screenshot({ path: file, animations: 'disabled' });
      console.log(`✓ ${path.relative(ROOT, file)}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${name}: ${err.message.split('\n')[0]}`);
    } finally {
      await browser.close();
    }
  }
  process.exit(failed ? 1 : 0);
}
