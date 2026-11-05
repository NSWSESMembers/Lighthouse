/*
  Deterministic demo data for the Incident Export page.

  The incidents are the Incident Statistics harness's (scripts/stats-docs/
  scenario.mjs: Beacon's Jobs/Search ViewModelType 6 structure, invented
  values), with the columns only the export shows filled in: caller and
  incident contact names and phone numbers, premises access, flat/level,
  and an Ops Log for each ICEMS incident with some Incident Update
  Messages in it.

  Every value is invented. Phone numbers are from the ranges ACMA sets
  aside for fiction (0491 570 xxx style mobiles, 02 5550 xxxx landlines).
*/

import { buildScenario as buildIncidents, beaconTime } from '../stats-docs/scenario.mjs';
import { prng } from '../page-docs/units.mjs';

const FIRST = ['Alex', 'Sam', 'Jordan', 'Casey', 'Morgan', 'Riley', 'Taylor', 'Jamie', 'Robin', 'Quinn', 'Avery', 'Harper'];
const LAST = ['Sample', 'Example', 'Placeholder', 'Testman', 'Mockford', 'Demoson', 'Fictional', 'Pretendo'];
const MOBILES = ['0491 570 006', '0491 570 156', '0491 570 157', '0491 570 158', '0491 570 159', '0491 570 110', '0491 570 313', '0491 570 737', '0491 571 266', '0491 571 491'];
const LANDLINES = ['02 5550 1234', '02 5550 4321', '02 5550 2468', '02 5550 1357'];
const ACCESS = ['Side gate is unlocked', 'Key in lockbox, code with caller', 'Dog in back yard: call first', 'Access via rear lane'];

export function buildScenario(now = new Date()) {
  const scenario = buildIncidents(now);
  const rand = prng(20261027);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const opsLogs = new Map();

  for (const job of scenario.jobs) {
    job.CallerFirstName = pick(FIRST);
    job.CallerLastName = rand() < 0.9 ? pick(LAST) : null;
    job.CallerPhoneNumber = rand() < 0.7 ? pick(MOBILES) : pick(LANDLINES);
    if (rand() < 0.4) {
      job.ContactFirstName = pick(FIRST);
      job.ContactLastName = pick(LAST);
      job.ContactPhoneNumber = pick(MOBILES);
    } else {
      job.ContactFirstName = null;
      job.ContactLastName = null;
      job.ContactPhoneNumber = null;
    }
    job.PermissionToEnterPremises = rand() < 0.8;
    job.HowToEnterPremises = rand() < 0.3 ? pick(ACCESS) : null;
    if (rand() < 0.1) {
      job.Address.Level = String(1 + Math.floor(rand() * 4));
      job.Address.Flat = String(1 + Math.floor(rand() * 20));
    }
    // A line break and a quote, to check the CSV keeps one incident per row.
    if (job.Id === scenario.jobs[0].Id) job.SituationOnScene = 'Tree on "granny flat"\nroof leaking';

    if (job.ICEMSIncidentIdentifier) {
      const updates = Math.floor(rand() * 5);
      const at = beaconTime(now, 1);
      const entries = [{ Id: job.Id * 10, Subject: 'Incident created from ICEMS', TimeLogged: at }];
      for (let i = 0; i < updates; i++) {
        entries.push({ Id: job.Id * 10 + 1 + i * 2, Subject: 'ICEMS Incident Update Message received', TimeLogged: at });
        entries.push({ Id: job.Id * 10 + 2 + i * 2, Subject: 'ICEMS Incident Update Message Acceptance sent', TimeLogged: at });
      }
      opsLogs.set(job.Id, { entries, updates });
    }
  }
  return { ...scenario, opsLogs };
}
