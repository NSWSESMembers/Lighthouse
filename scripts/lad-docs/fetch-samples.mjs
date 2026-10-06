/*
  Fetch real Beacon payloads for the endpoints the LAD page reads, so the
  demo scenario (scenario.mjs) can be checked against source-of-truth shapes
  instead of shapes inferred from our own models.

  Usage:
    node scripts/lad-docs/fetch-samples.mjs --hq <entityId> [--host https://apitrainbeacon.ses.nsw.gov.au] [--days 2]

  The bearer token is read from $BEACON_TOKEN, or prompted for on stdin if
  unset, so it never lands in shell history or argv.

  Raw responses are written to build/lad-samples/ (gitignored). They contain
  real names/phone numbers/addresses -- never commit them; scenario.mjs only
  borrows their *shape*.
*/

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { request, requestPaginated } from '../../src/shared/BeaconClient/core/request.js';
import * as job from '../../src/shared/BeaconClient/job.js';
import * as team from '../../src/shared/BeaconClient/team.js';
import * as entities from '../../src/shared/BeaconClient/entities.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'build/lad-samples');
const SAMPLE_ROWS = 5;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

async function readToken() {
  if (process.env.BEACON_TOKEN) return process.env.BEACON_TOKEN.trim();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (s) => { if (!s.includes('\n')) rl.output.write(''); else rl.output.write(s); };
  const tok = await new Promise((res) => rl.question('Beacon bearer token (input hidden): ', res));
  rl.close();
  process.stdout.write('\n');
  return tok.trim().replace(/^Bearer\s+/i, '');
}

function save(name, data) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`  wrote ${path.relative(ROOT, file)}`);
}

async function step(name, fn) {
  try {
    const data = await fn();
    save(name, data);
    return data;
  } catch (err) {
    console.error(`  ${name} failed: ${err.message}`);
    return null;
  }
}

const hqId = arg('hq');
if (!hqId) {
  console.error('--hq <entityId> is required (the HQ you would open LAD for)');
  process.exit(1);
}
const host = arg('host', 'https://apitrainbeacon.ses.nsw.gov.au');
const days = Number(arg('days', 2));
const token = await readToken();
const ctx = { host, userId: 'lad-docs-samples', token };

const end = new Date();
const start = new Date(end.getTime() - days * 86400 * 1000);
// Only the first page is needed for shape -- stop paging after it.
const firstPage = (url, pageSize) => request(`${url}&PageIndex=1&PageSize=${pageSize}`, { token });

console.log(`Fetching from ${host} for HQ ${hqId}, last ${days} day(s)`);

await step('entity', () => entities.get(hqId, ctx));

// Train/quiet HQs often have nothing in a short window, so widen the
// window, then drop the HQ filter, until something comes back.
const SEARCH_WINDOWS = [days, 30, 180];
async function widening(name, buildUrl) {
  for (const scopeHq of [hqId, null]) {
    for (const d of SEARCH_WINDOWS) {
      const from = new Date(end.getTime() - d * 86400 * 1000);
      const page = await firstPage(buildUrl(from, scopeHq), 20).catch((err) => {
        console.error(`  ${name} failed: ${err.message}`);
        return null;
      });
      if (page?.Results?.length) {
        console.log(`  ${name}: ${page.TotalItems} found (${d} days, ${scopeHq ? `HQ ${scopeHq}` : 'any HQ'})`);
        save(name, page);
        return page;
      }
    }
  }
  console.error(`  ${name}: nothing found even with ${SEARCH_WINDOWS.at(-1)} days and no HQ filter`);
  return null;
}

const jobsPage = await widening('jobs-search', (from, hq) =>
  `${host}/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&userId=${ctx.userId}` +
  `&StartDate=${from.toISOString()}&EndDate=${end.toISOString()}${hq ? `&Hq=${hq}` : ''}&ViewModelType=6`);

const jobIds = (jobsPage?.Results || []).map((j) => j.Id);
if (jobIds.length) {
  await step('tasking-search', () => job.getTasking(jobIds, ctx));
  await step('job-get', () => job.get(jobIds[0], ctx));
  await step('job-history', () => job.getHistory(jobIds[0], ctx));
}

// Same query team.search() builds ($.param(..., true) form); hand-rolled
// because team.js needs jQuery, which needs a DOM.
const teamsPage = await widening('teams-search', (from, hq) =>
  `${host}/Api/v1/Teams/Search?LighthouseFunction=GetJSONTeamsfromBeacon&userId=${ctx.userId}` +
  `&StatusStartDate=${from.toISOString()}&StatusEndDate=${end.toISOString()}&SortField=callsign&SortOrder=asc` +
  `&IncludeDeleted=false${hq ? `&AssignedToId=${hq}&CreatedAtId=${hq}` : ''}`);
const teamId = teamsPage?.Results?.[0]?.Id;
if (teamId) {
  await step('team-get', () => team.get(teamId, ctx));
  await step('team-tasking', () => team.getTasking(teamId, ctx));
}

await step('radio', () => request(`${host}/Api/v1/ResourceLocations/Radio?resourceTypes=&LighthouseFunction=fetchRadioAssets&userId=${ctx.userId}`, { token }));
await step('telematics', () => request(`${host}/Api/v1/ResourceLocations/Telematics?LighthouseFunction=fetchTeleAssets&userId=${ctx.userId}`, { token }));
await step('tags-group-5', () => request(`${host}/Api/v1/Tags/Group/5?LighthouseFunction=TagsGroup&userId=${ctx.userId}`, { token }));

// Trim big collections down to a few rows so the samples stay readable.
for (const f of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) {
  const p = path.join(OUT, f);
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  const trim = (a) => (Array.isArray(a) ? a.slice(0, SAMPLE_ROWS) : a);
  if (Array.isArray(d)) fs.writeFileSync(p, JSON.stringify(trim(d), null, 2));
  else if (d && (d.Results || d.results || d.features)) {
    for (const k of ['Results', 'results', 'features']) if (d[k]) d[k] = trim(d[k]);
    fs.writeFileSync(p, JSON.stringify(d, null, 2));
  }
}
console.log('Done. Samples are in build/lad-samples/ -- do not commit them.');
