/*
  Playwright route handler that stands in for the Beacon API and the
  Lighthouse lambdas, answering from the fake scenario (scenario.mjs).

  Only Beacon and the Lighthouse lambdas are mocked. Everything else
  (basemap tiles, BOM/transport/geoservice overlays -- all public data)
  passes through to the real internet so the map and layers render.
  An unrecognised Beacon endpoint gets an empty-but-valid answer and is
  logged, so a new call the page starts making shows up as a
  "[mock] unhandled" line instead of a silent blank.
*/

export const BEACON_HOST = 'https://beacon.demo.test';
export const LAMBDA_HOST = 'lambda.lighthouse-extension.com';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Beacon's paged-collection envelope, honouring PageIndex/PageSize. */
function paged(url, rows) {
  const size = Number(url.searchParams.get('PageSize')) || rows.length || 1;
  const index = Number(url.searchParams.get('PageIndex')) || 1;
  return {
    CurrentPage: index,
    PageSize: size,
    TotalItems: rows.length,
    Results: rows.slice((index - 1) * size, index * size),
  };
}

/** `JobIds[]=1&JobIds[]=2` / `TeamIds=3` -> numbers. */
function idsParam(url, name) {
  return [...url.searchParams.getAll(`${name}[]`), ...url.searchParams.getAll(name)].map(Number);
}

export function createMockRouter(scenario, { log = () => {} } = {}) {
  const { hq, jobs, teams, taskings, radio, telematics, tagGroups, jobHistory, opsLog } = scenario;
  const byId = (rows, id) => rows.find((r) => r.Id === Number(id));

  function beacon(route, url) {
    const p = url.pathname.replace(/\/+$/, '');
    const method = route.request().method();
    let m;

    if (method !== 'GET') {
      // Writes (task/untask, status changes, ops log, SMS...) succeed with
      // nothing changed -- enough for click-throughs not to error.
      log(`[mock] ${method} ${p} (accepted, no-op)`);
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    }

    if ((m = p.match(/^\/Api\/v1\/Entities\/(\d+)\/Children$/))) return json(route, []);
    if ((m = p.match(/^\/Api\/v1\/Entities\/(\d+)$/))) return json(route, Number(m[1]) === hq.Id ? hq : { ...hq, Id: Number(m[1]) });
    if (p === '/Api/v1/Entities/Search') return json(route, paged(url, [hq]));
    if ((m = p.match(/^\/Api\/v1\/Tags\/Group\/(\d+)$/))) return json(route, paged(url, tagGroups[m[1]] || []));

    if (p === '/Api/v1/Jobs/Search') return json(route, paged(url, jobs));
    // No unacknowledged ICEMS notifications in the demo (Job.js expects an array).
    if (/^\/Api\/v1\/Jobs\/\d+\/unacceptednotifications$/.test(p)) return json(route, []);
    // ICEMS incident detail: no agencies yet (needs a real sample for structure).
    if (/^\/Api\/v1\/Icems\/incidents\//.test(p)) return json(route, {});
    if ((m = p.match(/^\/Api\/v1\/Jobs\/(\d+)\/History$/))) return json(route, jobHistory(Number(m[1])));
    if ((m = p.match(/^\/Api\/v1\/Jobs\/(\d+)$/))) {
      const j = byId(jobs, m[1]);
      return j ? json(route, j) : json(route, { Message: 'Not found' }, 404);
    }

    if (p === '/Api/v1/Tasking/Search') {
      const jobIds = idsParam(url, 'JobIds');
      const teamIds = idsParam(url, 'TeamIds');
      const rows = taskings.filter((t) =>
        (jobIds.length && jobIds.includes(t.Job.Id)) || (teamIds.length && teamIds.includes(t.Team.Id)));
      return json(route, paged(url, rows));
    }

    if (p === '/Api/v1/OperationsLog/search') {
      // Bulk form sends JobIds=1&JobIds=2; single-job forms send JobIds[0]=1.
      const jobIds = [...url.searchParams.entries()].filter(([k]) => /^JobIds(\[\d*\])?$/.test(k)).map(([, v]) => Number(v));
      const unresolvedOnly = url.searchParams.get('UnresolvedActionsOnly') === 'true';
      const rows = opsLog
        .filter((e) => !jobIds.length || jobIds.includes(e.JobId))
        .filter((e) => !unresolvedOnly || e.ActionRequired)
        .sort((a, b) => b.TimeLogged.localeCompare(a.TimeLogged));
      return json(route, paged(url, rows));
    }

    // Job suppliers: none in the demo (a bare array, which is what Job.js iterates).
    if (/^\/Api\/v1\/Suppliers\/Job\/\d+$/.test(p)) return json(route, []);

    if (p === '/Api/v1/Teams/Search') return json(route, paged(url, teams));
    if ((m = p.match(/^\/Api\/v1\/Teams\/(\d+)$/))) {
      const t = byId(teams, m[1]);
      return t ? json(route, t) : json(route, { Message: 'Not found' }, 404);
    }

    if (p === '/Api/v1/ResourceLocations/Radio') return json(route, radio);
    if (p === '/Api/v1/ResourceLocations/Telematics') return json(route, telematics);

    log(`[mock] unhandled Beacon GET ${p}${url.search.slice(0, 120)}`);
    return json(route, paged(url, []));
  }

  function lambda(route, url) {
    const method = route.request().method();
    // Shared default assets, collab map layers, share/load config, geocode,
    // routing: nothing shared in the demo.
    log(`[mock] lambda ${method} ${url.pathname} (empty)`);
    if (/geocode/.test(url.pathname)) return json(route, { results: [] });
    return json(route, method === 'GET' ? [] : {});
  }

  return async function handle(route) {
    const url = new URL(route.request().url());
    if (url.origin === BEACON_HOST) return beacon(route, url);
    if (url.host === LAMBDA_HOST) return lambda(route, url);
    return route.continue();
  };
}
