/*
  Deterministic demo data for the Incident Statistics page.

  Same rules as scripts/lad-docs/scenario.mjs: the *structure* of each job
  follows Beacon's Jobs/Search (ViewModelType 6) payload, every *value* is
  invented -- units, zone, events, streets, localities, identifiers.

  A few hundred jobs across four fake units in one fake zone, weighted
  towards a storm in the last two days so the charts have a shape. A seeded
  PRNG keeps the data identical between runs for a given `now`.
*/

import { UNITS, prng } from '../page-docs/units.mjs';

const TZ = 'Australia/Sydney';

/** Beacon-style offset-free local timestamp, `hoursAgo` before `now`. */
export function beaconTime(now, hoursAgo = 0) {
  const d = new Date(now.getTime() - hoursAgo * 3600 * 1000);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-AU', {
      timeZone: TZ, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

// The four fake units in one fake zone, shared with the other page harnesses.
export { UNITS };

/** Stand-in for static/resources/unitClusters.json, keyed by the fake unit names. */
export const CLUSTERS = {
  'Demo City': { clusterCode: 'DNC', clusterName: 'Demo North' },
  'Demo Heights': { clusterCode: 'DNC', clusterName: 'Demo North' },
  'Demo Vale': { clusterCode: 'DSC', clusterName: 'Demo South' },
  'Demo Point': { clusterCode: 'DSC', clusterName: 'Demo South' },
};

// 28 localities: more than the 18 pie colours, so the Locality chart has to
// keep the slices it shows distinct (pieColors fit) -- check.mjs relies on it.
const LOCALITIES = {
  9001: ['Demo City', 'Northvale', 'Eastbrook', 'Maple Flat', 'Copper Hill', 'Stonebridge', 'Larkspur'],
  9002: ['Demo Heights', 'Hillcrest', 'Ridgeway', 'Fernlea', 'Oakmere', 'Windy Gap', 'Bramble Park'],
  9003: ['Demo Vale', 'Riverside Park', 'Westmere', 'Reedy Creek', 'Millbrook', 'Heron Point', 'Kestrel Downs'],
  9004: ['Demo Point', 'Harbourview', 'Sandy Cove', 'Gull Rock', 'Pebble Bay', 'Saltmarsh', 'Lantern Head'],
};
// Each unit's first locality is in one fake LGA, the rest in another.
const LGAS = {
  9001: ['Demo City Council', 'Northvale Shire'],
  9002: ['Demo Heights Council', 'Northvale Shire'],
  9003: ['Demo Vale Council', 'Riverside Regional'],
  9004: ['Demo Point Council', 'Riverside Regional'],
};
const STREETS = ['Example St', 'Sample Rd', 'Placeholder Ave', 'Fictional Pde', 'Mock Ln', 'Testing Cres', 'Imaginary Way', 'Pretend Cl'];

const JOB_TYPES = [
  [{ ParentId: 1, ROGSCategory: 'Storm & Cyclones', Id: 1, Name: 'Storm', Description: 'Storm' }, 80],
  [{ ParentId: 2, ROGSCategory: 'Other', Id: 2, Name: 'Support', Description: 'Support' }, 10],
  [{ ParentId: 5, ROGSCategory: 'Flood', Id: 4, Name: 'FR', Description: 'Flood Rescue' }, 6],
  [{ ParentId: 6, ROGSCategory: 'Road Crash Rescue', Id: 5, Name: 'RCR', Description: 'Road Crash Rescue' }, 4],
];
const PRIORITIES = [
  [{ Id: 4, Name: 'General', Description: 'General Response' }, 60],
  [{ Id: 3, Name: 'Priority', Description: 'Priority Response' }, 28],
  [{ Id: 2, Name: 'Immediate', Description: 'Immediate Response' }, 9],
  [{ Id: 1, Name: 'Rescue', Description: 'Rescue' }, 3],
];
const STATUS = {
  New: { Id: 1, Name: 'New', Description: 'New' },
  Active: { Id: 2, Name: 'Active', Description: 'Active' },
  Tasked: { Id: 4, Name: 'Tasked', Description: 'Tasked' },
  Complete: { Id: 6, Name: 'Complete', Description: 'Complete' },
  Cancelled: { Id: 7, Name: 'Cancelled', Description: 'Cancelled' },
  Finalised: { Id: 8, Name: 'Finalised', Description: 'Finalised' },
};

// Tag vocabulary with the group ids the stats page sorts on: storm damage
// kinds by name, hazards in 7-9, property types in 10/11/13.
let tagId = 9500;
const tag = (Name, TagGroupId) => ({ Id: tagId++, Name, TagGroupId, Description: null });
const STORM_TAGS = [
  [tag('Tree Down', 5), 30], [tag('Branch Down', 5), 18], [tag('Tree Threatening', 5), 8],
  [tag('Roof Damage', 5), 16], [tag('Leaking Roof', 5), 20], [tag('Ceiling Damage', 5), 6],
  [tag('Window Damage', 5), 5],
];
const HAZARD_TAGS = [
  [tag('Powerlines Down', 7), 10], [tag('Asbestos Suspected', 8), 5], [tag('Unstable Structure', 9), 4],
  [tag('Animals On Site', 9), 3],
];
const PROPERTY_TAGS = [
  [tag('House', 10), 55], [tag('Unit / Apartment', 11), 15], [tag('Commercial', 13), 8], [tag('Shed / Garage', 10), 10],
];

const EVENTS = [
  { Id: 3001, Name: 'Demo Storm Event', Identifier: 'EVT-DEMO-01', Description: 'Severe storm, Demo Zone', District: 'Demo Zone' },
  { Id: 3002, Name: 'Demo Flood Watch', Identifier: 'EVT-DEMO-02', Description: 'Riverine flooding, Demo Vale', District: 'Demo Zone' },
];

const SITUATIONS = {
  'Tree Down': ['Large tree down across driveway, blocking access', 'Tree fallen across front yard onto fence', 'Gum tree down on shed, roof crushed'],
  'Branch Down': ['Branch on roof, gutter damaged', 'Large branch hanging over power lines', 'Branch through carport roof'],
  'Tree Threatening': ['Tree leaning towards house after heavy wind', 'Cracked tree threatening bedroom'],
  'Roof Damage': ['Roof sheeting lifted, water entering bedroom', 'Tiles blown off, rain coming into lounge room', 'Ridge capping missing, roof leaking'],
  'Leaking Roof': ['Leaking roof over kitchen, tarp required', 'Water through ceiling in hallway, buckets out', 'Roof leaking into bathroom light fitting'],
  'Ceiling Damage': ['Ceiling collapsed in lounge room after heavy rain', 'Ceiling sagging with water in bedroom'],
  'Window Damage': ['Window smashed by flying debris', 'Sliding door glass broken by branch'],
  Support: ['Sandbags requested, water rising in yard', 'Assist police with traffic control at fallen tree', 'Welfare check on elderly resident'],
  FR: ['Vehicle stranded in floodwater on causeway', 'Person trapped on roof of car in rising water'],
  RCR: ['Two vehicle collision, one person trapped', 'Single vehicle into pole, driver trapped'],
};

export function buildScenario(now = new Date(), { count = 360 } = {}) {
  const rand = prng(20261015);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const weighted = (list) => {
    const total = list.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [v, w] of list) {
      if ((r -= w) < 0) return v;
    }
    return list[list.length - 1][0];
  };
  // Mostly within the last two days (the storm), a tail back to a week.
  const hoursAgo = () => (rand() < 0.8 ? Math.pow(rand(), 1.4) * 48 : 48 + rand() * 120);
  // Time from Active to Complete: mostly a few hours, some much longer.
  const workHours = () => Math.min(72, 0.4 + -Math.log(1 - rand()) * (rand() < 0.75 ? 3 : 14));

  const jobs = [];
  for (let i = 0; i < count; i++) {
    const unit = weighted([[UNITS[0], 40], [UNITS[1], 25], [UNITS[2], 20], [UNITS[3], 15]]);
    const jobType = weighted(JOB_TYPES);
    const received = hoursAgo();
    const tags = [];
    let situationKey = jobType.Name;
    if (jobType.Name === 'Storm') {
      const first = weighted(STORM_TAGS);
      tags.push(first);
      situationKey = first.Name;
      if (rand() < 0.35) {
        const second = weighted(STORM_TAGS);
        if (second !== first) tags.push(second);
      }
      if (rand() < 0.25) tags.push(weighted(HAZARD_TAGS));
      if (rand() < 0.85) tags.push(weighted(PROPERTY_TAGS));
    }

    // Status history, all in the past.
    const t = (h) => beaconTime(now, Math.max(0, h));
    const history = [{ Type: 1, Name: 'New', Description: 'New', Timelogged: t(received), CreatedOn: t(received), CreatedBy: null }];
    let status = 'New';
    const activeAt = received - (0.05 + rand() * 0.5);
    if (activeAt > 0.02) {
      history.push({ Type: 2, Name: 'Active', Description: 'Active', Timelogged: t(activeAt), CreatedOn: t(activeAt), CreatedBy: null });
      status = 'Active';
      if (rand() < 0.05) {
        const at = activeAt - rand() * Math.min(activeAt, 2);
        history.push({ Type: 7, Name: 'Cancelled', Description: 'Cancelled', Timelogged: t(at), CreatedOn: t(at), CreatedBy: null });
        status = 'Cancelled';
      } else {
        const taskedAt = activeAt - Math.min(activeAt, 0.1 + rand() * 1.5);
        if (taskedAt > 0) {
          history.push({ Type: 4, Name: 'Tasked', Description: 'Tasked', Timelogged: t(taskedAt), CreatedOn: t(taskedAt), CreatedBy: null });
          status = 'Tasked';
        }
        const completeAt = activeAt - workHours();
        if (completeAt > 0) {
          history.push({ Type: 6, Name: 'Complete', Description: 'Complete', Timelogged: t(completeAt), CreatedOn: t(completeAt), CreatedBy: null });
          status = 'Complete';
          const finalAt = completeAt - (2 + rand() * 20);
          if (finalAt > 0 && rand() < 0.6) {
            history.push({ Type: 8, Name: 'Finalised', Description: 'Finalised', Timelogged: t(finalAt), CreatedOn: t(finalAt), CreatedBy: null });
            status = 'Finalised';
          }
        }
      }
    }

    const locality = pick(LOCALITIES[unit.Id]);
    const number = 1 + Math.floor(rand() * 199);
    const street = pick(STREETS);
    const event = received < 48 ? EVENTS[0] : unit.Id === 9003 && rand() < 0.5 ? EVENTS[1] : null;
    const seq = 1001 + i;

    jobs.push({
      Id: 80000 + i,
      Identifier: `2610-${String(seq).padStart(4, '0')}`,
      Sequence: seq,
      FloodAssistanceJob: false,
      ReferringAgency: rand() < 0.08 ? pick(['Police', 'FRNSW', 'Ambulance', 'Council']) : null,
      ReferringAgencyReference: null,
      EmergencyOrder: null,
      SituationOnScene: pick(SITUATIONS[situationKey] || SITUATIONS.Support),
      EvacuationRequired: false,
      PeopleInundated: 0,
      PeopleExtricated: 0,
      PeopleEvacuated: 0,
      CreatedOn: history[0].Timelogged,
      CreatedBy: null,
      // Some incidents arrive from other agencies through ICEMS (placeholder ids).
      ICEMSIncidentIdentifier: rand() < 0.15 ? `DEMO-ICEMS-${String(5000 + i)}` : null,
      EntityAssignedTo: { ...unit },
      LGA: LGAS[unit.Id][LOCALITIES[unit.Id].indexOf(locality) === 0 ? 0 : 1],
      Sector: rand() < 0.3 ? { Id: 600 + (i % 3), Name: `Sector ${'ABC'[i % 3]}` } : null,
      JobPriorityType: weighted(PRIORITIES),
      TaskingCategory: 0,
      JobType: jobType,
      JobStatusType: STATUS[status],
      Tags: tags.map((tg) => ({ ...tg, CreatedOn: '2015-01-01T00:00:00', CreatedBy: 1 })),
      Address: {
        GnafId: `GADEMO${800000 + i}`,
        Latitude: unit.Latitude + (rand() - 0.5) * 0.04,
        Longitude: unit.Longitude + (rand() - 0.5) * 0.04,
        Type: null, Flat: null, Level: null,
        StreetNumber: String(number),
        Street: street,
        Locality: locality,
        PostCode: '2999',
        PrettyAddress: `${number} ${street}, ${locality} NSW 2999`,
        AdditionalAddressInfo: null,
      },
      LastModified: history[history.length - 1].Timelogged,
      LastModifiedBy: null,
      JobStatusTypeHistory: history,
      PermissionToEnterPremises: true,
      HowToEnterPremises: null,
      Event: event ? { ...event, StartTime: t(72), EndTime: null } : null,
      JobReceived: history[0].Timelogged,
      Reconnoitered: false,
      AgenciesPresent: [],
      FloodAssistance: null,
      Type: jobType.Name,
      PrintCount: 0,
      Categories: rand() < 0.2 ? [{ Id: 700 + (i % 2), Name: `Category ${1 + (i % 2)}` }] : [],
      Frao: null,
      Locked: false,
    });
  }
  // Beacon's search sorts newest first (SortField=Id desc).
  jobs.sort((a, b) => b.Id - a.Id);
  return { timezone: TZ, now, units: UNITS, clusters: CLUSTERS, jobs };
}
