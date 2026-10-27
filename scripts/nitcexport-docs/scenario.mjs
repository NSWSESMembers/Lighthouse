/*
  Deterministic demo data for the NITC Export page: Non-Incident Task
  Cards for the four fake HQs (scripts/page-docs/units.mjs), in the
  structure the page reads from Beacon's NonIncident/Search
  (ViewModelType 6): Name, Description, NonIncidentType, StartDate /
  EndDate (offset-free Sydney time), CreatedAt (the HQ), Tags, and
  Participants with their Person and own start / end.

  Every value is invented. A few tasks are awkward on purpose: a name with
  "#" and brackets in it, a task with no tags, a participant with no end
  time, and two different members with the same name.
*/

import { UNITS, prng } from '../page-docs/units.mjs';
import { beaconTime } from '../stats-docs/scenario.mjs';

const FIRST = ['Alex', 'Sam', 'Jordan', 'Casey', 'Morgan', 'Riley', 'Taylor', 'Jamie', 'Robin', 'Quinn', 'Avery', 'Harper', 'Drew', 'Skyler'];
const LAST = ['Sample', 'Example', 'Placeholder', 'Testman', 'Mockford', 'Demoson', 'Fictional', 'Pretendo'];

export const TYPES = [
  { Id: 1, Name: 'Training' },
  { Id: 2, Name: 'Community Engagement' },
  { Id: 3, Name: 'Maintenance' },
  { Id: 4, Name: 'Meeting' },
];

export const TAGS = [
  { Id: 701, Name: 'Storm and water damage', TagGroupId: 70 },
  { Id: 702, Name: 'Flood rescue', TagGroupId: 70 },
  { Id: 703, Name: 'Chainsaw', TagGroupId: 70 },
  { Id: 704, Name: 'Community education', TagGroupId: 71 },
  { Id: 705, Name: 'Vehicle checks', TagGroupId: 72 },
  { Id: 706, Name: 'Unit meeting', TagGroupId: 73 },
];

const NAMES = {
  1: ['Rescue skills night', 'Flood boat refresher', 'Chainsaw crosscut practice', 'Navigation exercise'],
  2: ['School visit', 'Market stall', 'Get Ready day'],
  3: ['Vehicle checks', 'Shed clean-up', 'Generator service'],
  4: ['Unit meeting', 'Leadership catch-up'],
};
const TAGS_FOR = { 1: [701, 702, 703], 2: [704], 3: [705], 4: [706] };

export function buildScenario(now = new Date()) {
  const rand = prng(20261028);
  const pick = (list) => list[Math.floor(rand() * list.length)];

  // 40 members spread over the HQs; two different people share a name.
  const people = Array.from({ length: 40 }, (_, i) => {
    const FirstName = FIRST[i % FIRST.length];
    const LastName = LAST[Math.floor(i / FIRST.length + i) % LAST.length];
    return { Id: 80000 + i, FirstName, LastName, FullName: `${FirstName} ${LastName}`, unit: UNITS[i % UNITS.length].Id };
  });
  people[39].FirstName = people[0].FirstName;
  people[39].LastName = people[0].LastName;
  people[39].FullName = people[0].FullName;
  people[39].unit = people[0].unit;

  const tasks = [];
  // 160 tasks over the last 30 days, newest first (Beacon sorts Start desc).
  for (let i = 0; i < 160; i++) {
    const unit = UNITS[i % UNITS.length];
    const type = pick(TYPES);
    // Whole minutes, as people type them into Beacon.
    const hoursAgo = Math.round((2 + (i / 160) * 30 * 24 + rand() * 3) * 60) / 60;
    const length = [1, 1.5, 2, 2.5, 3, 4][Math.floor(rand() * 6)];
    const start = beaconTime(now, hoursAgo);
    const end = beaconTime(now, hoursAgo - length);
    const tagIds = TAGS_FOR[type.Id].filter(() => rand() < 0.6);
    if (!tagIds.length) tagIds.push(TAGS_FOR[type.Id][0]);
    const crew = people.filter((p) => p.unit === unit.Id && rand() < 0.45);
    tasks.push({
      Id: 30000 + i,
      Name: pick(NAMES[type.Id]),
      Description: `${type.Name} at ${unit.Name}`,
      NonIncidentType: type,
      StartDate: start,
      EndDate: end,
      CreatedAt: { Id: unit.Id, Code: unit.Code, Name: unit.Name },
      Tags: TAGS.filter((t) => tagIds.includes(t.Id)),
      Participants: crew.map((p, n) => {
        // Most stay the whole task; some leave early or arrive late.
        const late = rand() < 0.2 ? 0.5 : 0;
        const early = rand() < 0.2 ? 0.5 : 0;
        return {
          Id: 3000000 + i * 100 + n,
          Person: { Id: p.Id, FirstName: p.FirstName, LastName: p.LastName, FullName: p.FullName },
          StartDate: beaconTime(now, hoursAgo - late),
          EndDate: beaconTime(now, hoursAgo - length + early),
        };
      }),
    });
  }

  // The awkward ones.
  tasks[0].Name = 'Hall #2 clean-up (east wing)';
  tasks[1].Tags = [];
  if (tasks[2].Participants.length) tasks[2].Participants[0].EndDate = null;

  return { units: UNITS, people, tasks, types: TYPES, tags: TAGS };
}
