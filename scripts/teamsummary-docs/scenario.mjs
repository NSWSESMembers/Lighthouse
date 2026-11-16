/*
  Deterministic demo data for the Team Summary page.

  Teams follow the structure of Beacon's Teams/Search results (the same
  shape as scripts/lad-docs/scenario.mjs). Team history rows
  ({ Name, Description, TimeStamp }) follow what the old Team Summary page
  read from Teams/{id}/History: there's no captured sample of that
  endpoint, so the wording of the rows is modelled on the patterns the old
  page matched ("X added to team", "Team set as Activated",
  "<callsign> Onsite on job 2610-0012"). Every value is invented; see
  scripts/page-docs/units.mjs for the fake units.

  Timestamps are offset-free Sydney local time, as Beacon sends them.
*/

import { UNITS, prng } from '../page-docs/units.mjs';

export { UNITS };

export const TEAM_STATUS = {
  Standby: { Id: 1, Name: 'Standby', Description: null },
  OnAlert: { Id: 2, Name: 'OnAlert', Description: null },
  Activated: { Id: 3, Name: 'Activated', Description: null },
  Rest: { Id: 4, Name: 'Rest', Description: null },
};
const TEAM_TYPE = {
  Field: { Id: 1, Name: 'Field', Description: null },
  Operations: { Id: 2, Name: 'Operations', Description: null },
};
const PRIORITY = {
  Rescue: { Id: 1, Name: 'Rescue', Description: 'Rescue' },
  Immediate: { Id: 2, Name: 'Immediate', Description: 'Immediate Response' },
  Priority: { Id: 3, Name: 'Priority', Description: 'Priority Response' },
  General: { Id: 4, Name: 'General', Description: 'General Response' },
};

const FIRST = ['Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Jamie', 'Avery', 'Quinn', 'Harper', 'Rowan', 'Skyler', 'Emerson', 'Finley', 'Reese', 'Dakota', 'Parker', 'Sage', 'Hayden'];
const LAST = ['Nguyen', 'Okafor', 'Lindqvist', 'Marchetti', 'Haddad', 'Kowalski', 'Brennan', 'Tanaka', 'Moreau', 'Delacroix', 'Petrov', 'Achterberg', 'Fairweather', 'Castellano', 'Whitlock', 'Ingram'];
const STREETS = ['Example Street', 'Sample Road', 'Mock Avenue', 'Placeholder Lane', 'Fictional Parade', 'Imaginary Close', 'Pretend Way'];
const RESOURCES = ['Demo Storm Trailer', 'Demo Chainsaw Kit', 'Demo Light Tower', 'Demo Pump', 'Demo Ute'];

/*
  [callsign, unit index, type, status, status started (hours ago), members, resources, incidents]
  `incidents`: each [status the team last reached, hours ago] for a tasking,
  newest last; the last one is where the team is now.
*/
const TEAM_SPECS = [
  ['DEM01', 0, 'Field', 'Activated', 13.2, 4, [0], [['Complete', 5], ['Onsite', 0.4]]],
  ['DEM02', 0, 'Field', 'Activated', 6.5, 3, [1], [['Enroute', 0.2]]],
  ['DEM03', 0, 'Field', 'Activated', 10.8, 5, [], [['Complete', 2.5], ['Offsite', 0.8]]],
  ['DEM04', 0, 'Field', 'Standby', 2.0, 2, [], []],
  ['DEM10', 0, 'Operations', 'Activated', 14.0, 3, [], []],
  ['DMH01', 1, 'Field', 'Activated', 4.1, 3, [2, 3], [['Onsite', 1.1]]],
  ['DMH02', 1, 'Field', 'Activated', 1.6, 2, [], []],
  ['DMH03', 1, 'Field', 'OnAlert', 3.0, 0, [], []],
  ['DMV01', 2, 'Field', 'Activated', 8.0, 4, [4], [['Complete', 6], ['Complete', 3], ['Onsite', 0.6]]],
  ['DMV02', 2, 'Field', 'Rest', 1.0, 3, [], [['Complete', 4]]],
  ['DMP01', 3, 'Field', 'Activated', 11.5, 3, [], [['Enroute', 0.1]]],
  ['DMP02', 3, 'Field', 'Standby', 5.0, 2, [], []],
];

/** Offset-free local time `hoursAgo` before `now`, as Beacon sends it. */
function beaconTime(now, hoursAgo) {
  const d = new Date(now.getTime() - hoursAgo * 3600e3);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function entity(u) {
  return { ...u };
}

/**
 * @param {Date} now
 */
export function buildScenario(now) {
  const rand = prng(20261115);
  let personSeq = 0;
  let jobSeq = 12;
  const jobs = new Map(); // Identifier (no dash) -> job
  const history = new Map(); // team Id -> rows, newest first

  const person = () => {
    const i = personSeq++;
    const FirstName = FIRST[i % FIRST.length];
    const LastName = LAST[(i * 7) % LAST.length];
    return {
      Id: 50000 + i,
      FullName: `${FirstName} ${LastName}`,
      FirstName,
      LastName,
      RegistrationNumber: String(90000 + i),
    };
  };
  const coordinator = person();

  function addJob(unit) {
    const seq = jobSeq++;
    const identifier = `2611-${String(seq).padStart(4, '0')}`;
    const prio = ['General', 'General', 'Priority', 'Immediate', 'Rescue'][Math.floor(rand() * 5)];
    const job = {
      Id: 70000 + seq,
      Identifier: identifier,
      JobType: { Id: 1, Name: prio === 'Rescue' ? 'RCR' : 'Storm' },
      JobStatusType: { Id: 3, Name: 'Tasked' },
      JobPriorityType: PRIORITY[prio],
      JobReceived: beaconTime(now, 1 + rand() * 6),
      Address: { PrettyAddress: `${1 + Math.floor(rand() * 180)} ${STREETS[seq % STREETS.length]}, ${unit.Name} NSW 2999` },
      SituationOnScene: rand() < 0.75 ? 'Demo situation: tree branch over the fence, no one hurt.' : null,
      Tags: rand() < 0.5 ? [{ Id: 1, Name: 'Demo Tag' }, { Id: 2, Name: 'Tree Down' }] : [],
      EntityAssignedTo: { Id: unit.Id, Code: unit.Code, Name: unit.Name, ParentEntity: { Code: unit.ParentEntity.Code } },
    };
    jobs.set(identifier.replace('-', ''), job);
    return job;
  }

  const teams = TEAM_SPECS.map(([Callsign, unitIdx, type, status, statusHours, memberCount, resources, incidents], i) => {
    const unit = UNITS[unitIdx];
    const members = Array.from({ length: memberCount }, (_, m) => ({
      Id: 60000 + i * 10 + m,
      // The first members came on with the team; one came on later.
      TimeOn: beaconTime(now, m === memberCount - 1 && memberCount > 2 ? statusHours / 2 : statusHours + 0.2),
      TimeOff: null,
      Person: person(),
      TeamLeader: m === 0,
    }));
    const team = {
      Id: 80000 + i,
      Callsign,
      VehicleType: null,
      VehicleRegistration: null,
      TeamStatusStartDate: beaconTime(now, statusHours),
      CreatedAt: entity(unit),
      AssignedTo: entity(unit),
      Sector: i === 0 || i === 5 ? { Id: 300 + i, Name: i === 0 ? 'North Demo' : 'Demo Hill' } : null,
      TeamStatusType: TEAM_STATUS[status],
      TeamType: TEAM_TYPE[type],
      Members: members,
      Resources: resources.map((r) => ({ Id: 400 + r, Name: RESOURCES[r] })),
      Tags: [],
      Capabilities: [],
      TaskedJobCount: incidents.filter(([s]) => s !== 'Complete').length,
      IsDeleted: false,
    };

    // History, oldest first, then reversed (Beacon sends newest first).
    const rows = [];
    const by = ` by ${coordinator.FullName}`;
    const at = (h) => beaconTime(now, h);
    rows.push({ Name: `Team set as ${status === 'OnAlert' ? 'On Alert' : status}`, Description: `Status changed${by}`, TimeStamp: at(statusHours) });
    members.forEach((m) => {
      rows.push({ Name: `${m.Person.FullName} added to team`, Description: `Member added${by}`, TimeStamp: m.TimeOn });
    });
    incidents.forEach(([reached, hoursAgo]) => {
      const job = addJob(unit);
      const steps = ['Tasked', 'Enroute', 'Onsite', 'Offsite', 'Complete'];
      const last = steps.indexOf(reached);
      steps.slice(0, last + 1).forEach((step, k) => {
        const h = hoursAgo + (last - k) * 0.25;
        const name = step === 'Tasked' ? `${Callsign} Tasked to job ${job.Identifier}` : `${Callsign} ${step} on job ${job.Identifier}`;
        rows.push({ Name: name, Description: `Tasking updated${by}`, TimeStamp: at(h) });
      });
    });
    rows.sort((a, b) => (a.TimeStamp < b.TimeStamp ? 1 : a.TimeStamp > b.TimeStamp ? -1 : 0));
    history.set(team.Id, rows);
    return team;
  });

  return {
    units: UNITS,
    teams,
    jobs,
    history,
    /** A team changes status now (e.g. a Standby team is Activated). */
    setStatus(callsign, status) {
      const team = teams.find((t) => t.Callsign === callsign);
      team.TeamStatusType = TEAM_STATUS[status];
      team.TeamStatusStartDate = beaconTime(now, 0);
      history.get(team.Id).unshift({ Name: `Team set as ${status}`, Description: `Status changed by ${coordinator.FullName}`, TimeStamp: beaconTime(now, 0) });
    },
    /** Several members join a team at once (a grouped history entry). */
    addMembers(callsign, count) {
      const team = teams.find((t) => t.Callsign === callsign);
      const stamp = beaconTime(now, 0);
      for (let k = 0; k < count; k++) {
        const p = person();
        team.Members.push({ Id: 69000 + personSeq, TimeOn: stamp, TimeOff: null, Person: p, TeamLeader: false });
        history.get(team.Id).unshift({ Name: `${p.FullName} added to team`, Description: `Member added by ${coordinator.FullName}`, TimeStamp: stamp });
      }
    },
  };
}

/** Teams/Search: teams of these HQs ([] = all) in these status types. */
export function searchTeams(scenario, { hqs, statusIds }) {
  return scenario.teams.filter((t) => (!hqs.length || hqs.includes(t.AssignedTo.Id) || hqs.includes(t.CreatedAt.Id))
    && (!statusIds.length || statusIds.includes(t.TeamStatusType.Id)));
}
