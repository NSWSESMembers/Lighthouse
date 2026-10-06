/*
  Deterministic demo scenario for the LAD (tasking) page.

  Structure mirrors real Beacon payloads (captured with fetch-samples.mjs,
  October 2026); every *value* here is invented -- unit, people, callsigns,
  ids, phone numbers, plates and street names are all fake. Coordinates sit
  in western Sydney purely so the basemap looks plausible.

  Beacon timestamps carry no offset ("YYYY-MM-DDTHH:mm:ss", NSW local time),
  so the harness pins the browser to Australia/Sydney and this module emits
  local Sydney time. All times are relative to `now` so the page's
  date-window filters always admit them.
*/

const TZ = 'Australia/Sydney';

/** Beacon-style offset-free local timestamp, `hoursAgo` before `now`. */
function beaconTime(now, hoursAgo = 0) {
  const d = new Date(now.getTime() - hoursAgo * 3600 * 1000);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-AU', {
      timeZone: TZ, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

export const HQ = {
  Id: 9001,
  Code: 'DEM',
  Name: 'Demo City',
  Latitude: -33.8150,
  Longitude: 151.0010,
  EntityTypeId: 1,
  HeadquartersStatusTypeId: 1,
  ParentEntity: { Id: 9000, Code: 'DMZ', Name: 'Demo Zone' },
  AriaCodeType: { Id: 1, Name: 'Not Applicable', Description: null },
  AriaCode: null,
  CadCode: 'SES999',
};

const TEAM_STATUS = {
  Standby: { Id: 1, Name: 'Standby', Description: null },
  OnAlert: { Id: 2, Name: 'OnAlert', Description: null },
  Activated: { Id: 3, Name: 'Activated', Description: null },
};
const TEAM_TYPE_FIELD = { Id: 1, Name: 'Field', Description: null };

const JOB_STATUS = {
  New: { Id: 1, Name: 'New', Description: 'New' },
  Active: { Id: 2, Name: 'Active', Description: 'Active' },
  Tasked: { Id: 4, Name: 'Tasked', Description: 'Tasked' },
  Referred: { Id: 5, Name: 'Referred', Description: 'Referred' },
};
const PRIORITY = {
  Rescue: { Id: 1, Name: 'Rescue', Description: 'Rescue' },
  Immediate: { Id: 2, Name: 'Immediate', Description: 'Immediate Response' },
  Priority: { Id: 3, Name: 'Priority', Description: 'Priority Response' },
  General: { Id: 4, Name: 'General', Description: 'General Response' },
};
const JOB_TYPE = {
  Storm: { ParentId: 1, ROGSCategory: 'Storm & Cyclones', Id: 1, Name: 'Storm', Description: 'Storm' },
  Support: { ParentId: 2, ROGSCategory: 'Other', Id: 2, Name: 'Support', Description: 'Support' },
  FR: { ParentId: 5, ROGSCategory: 'Flood', Id: 4, Name: 'FR', Description: 'Flood Rescue' },
};
// JobTeamStatusType ids (utils/enum.js)
const TASKING_STEPS = [
  [1, 'Tasked'], [3, 'Enroute'], [4, 'Onsite'], [5, 'Offsite'],
];

// Storm-damage tags (tag group 5 shape: {Id, Name, TagGroupId, Description}).
const TAGS = {
  BranchDown: { Id: 9134, Name: 'Branch Down', TagGroupId: 5, Description: null },
  TreeOnHouse: { Id: 9135, Name: 'Tree on House', TagGroupId: 5, Description: null },
  RoofLeak: { Id: 9136, Name: 'Roof Leak', TagGroupId: 6, Description: null },
};

// Ops-log action items (tag group 27) flagged on a job, keyed by job index.
const ACTION_REQUIRED = {
  6: [{ Id: 9270, Name: 'Callback Requested', TagGroupId: 27, Description: null }],
};

const PEOPLE = [
  ['Alex', 'Nguyen'], ['Sam', 'Patel'], ['Jordan', 'Smith'], ['Casey', 'Brown'], ['Riley', 'Wilson'],
  ['Morgan', 'Taylor'], ['Jamie', 'Lee'], ['Taylor', 'Martin'], ['Drew', 'White'], ['Quinn', 'Harris'],
  ['Avery', 'Clark'], ['Parker', 'Lewis'], ['Harper', 'Walker'], ['Skyler', 'Hall'], ['Reese', 'Young'],
  ['Hayden', 'King'], ['Emerson', 'Wright'], ['Finley', 'Scott'],
];

// Fictional streets/localities at plausible western-Sydney coordinates.
// [streetNumber, street, locality, postcode, lat, lng]
const ADDRESSES = [
  ['12', 'Wattle Cres', 'DEMO CITY', '2999', -33.8136, 151.0034],
  ['48', 'Banksia Rd', 'DEMO RIVER', '2998', -33.8131, 151.0303],
  ['7', 'Lilly Pilly Pl', 'DEMO HEIGHTS', '2997', -33.7963, 151.0244],
  ['103', 'Ironbark Ave', 'NORTH DEMO CITY', '2996', -33.7953, 151.0105],
  ['22', 'Grevillea St', 'NORTH DEMO CITY', '2996', -33.8030, 151.0016],
  ['5', 'Waratah Lane', 'DEMO PARK', '2999', -33.8197, 151.0083],
  ['66', 'Kurrajong Rd', 'DEMOVILLE', '2995', -33.8318, 151.0089],
  ['14', 'Tea Tree Cl', 'DEMO RIVER', '2998', -33.8165, 151.0226],
  ['31', 'Bottlebrush Dr', 'DEMO HILLS', '2994', -33.8018, 151.0381],
  ['9', 'Blackbutt St', 'DEMO WEST', '2993', -33.8366, 150.9926],
  ['77', 'Coolabah Way', 'DEMO NORTH', '2992', -33.7845, 150.9933],
  ['2', 'Mallee Ct', 'DEMO FLATS', '2991', -33.8197, 151.0242],
  ['150', 'Paperbark Pde', 'DEMO CITY', '2999', -33.8099, 150.9989],
  ['40', 'Saltbush Rd', 'DEMO WEST', '2993', -33.8051, 150.9719],
];

// [statusKey, priorityKey, typeKey, situation, hoursAgo, tags]
const JOB_SPECS = [
  ['New', 'Immediate', 'Storm', 'Tree fallen across roof, residents inside', 0.3, ['TreeOnHouse']],
  ['New', 'Priority', 'Storm', 'Leaking roof, water entering bedroom', 0.6, ['RoofLeak']],
  ['New', 'General', 'Storm', 'Branch down in front yard, blocking driveway', 1.1, ['BranchDown']],
  ['Active', 'Priority', 'Storm', 'Ceiling sagging under water load', 1.5, ['RoofLeak']],
  ['Active', 'General', 'Storm', 'Fence down, dog contained', 2.2, []],
  ['Tasked', 'Immediate', 'Storm', 'Tree on car, no persons trapped', 0.9, ['BranchDown']],
  ['Tasked', 'Priority', 'Storm', 'Multiple tiles dislodged, rain forecast', 1.8, ['RoofLeak']],
  ['Tasked', 'Priority', 'Storm', 'Gutter collapsed, water into wall cavity', 2.6, []],
  ['Tasked', 'General', 'Storm', 'Tarp blown off previous repair', 3.4, ['RoofLeak']],
  ['Tasked', 'Rescue', 'FR', 'Vehicle in floodwater, occupant on roof', 0.4, []],
  ['Active', 'General', 'Support', 'Sandbag request for low-lying property', 4.1, []],
  ['Referred', 'General', 'Storm', 'Power line down across footpath', 2.9, []],
  ['New', 'General', 'Storm', 'Large tree limb overhanging neighbour', 0.2, ['BranchDown']],
  ['Active', 'Immediate', 'Storm', 'Window smashed by debris, elderly occupant', 0.7, []],
];

// [callsign, statusKey, memberCount, taskedJobIndexes, radioAssetName, assetOffset]
// Assets match teams by callsign (utils/assetTeamMatching.js). DEM03's radio
// is deliberately named differently so the "unmatched team" and "unmatched
// asset" states both appear. DEM06 is Standby, so it's hidden by the default
// team status filter (Activated only).
const TEAM_SPECS = [
  ['DEM01', 'Activated', 3, [5, 6], 'DEM01', [0.004, -0.003]],
  ['DEM02', 'Activated', 4, [7], 'DEM02', [-0.006, 0.004]],
  ['DEM03', 'Activated', 2, [8], 'DEM21', [0.002, 0.008]],
  ['DEM04', 'Activated', 3, [9], 'DEM04', [-0.003, -0.006]],
  ['DEM05', 'Activated', 3, [], null, null],
  ['DEM06', 'Standby', 2, [], null, null],
];

// Person shape as seen on CreatedBy/LastModifiedBy.
function person(i) {
  const [first, last] = PEOPLE[i % PEOPLE.length];
  return {
    Id: 50001 + i,
    FirstName: first,
    LastName: last,
    FullName: `${first} ${last}`,
    Gender: i % 2,
    RegistrationNumber: String(40000001 + i),
  };
}

const OPERATOR = person(17);
const fakePhone = (i) => `0491 570 ${String(100 + i).slice(-3)}`; // ACMA fictional-use range

export function buildScenario(now = new Date()) {
  const t = (hoursAgo) => beaconTime(now, hoursAgo);

  const jobs = JOB_SPECS.map(([status, prio, type, situation, hoursAgo, tagKeys], i) => {
    const [num, street, locality, postcode, lat, lng] = ADDRESSES[i % ADDRESSES.length];
    const caller = person(i + 5);
    const received = t(hoursAgo);
    const history = [{ Type: 1, Name: 'New', Description: 'New', Timelogged: received, CreatedOn: received, CreatedBy: OPERATOR }];
    if (status !== 'New') {
      const at = t(Math.max(0.05, hoursAgo - 0.1));
      history.push({ Type: JOB_STATUS[status].Id, Name: status, Description: status, Timelogged: at, CreatedOn: at, CreatedBy: OPERATOR });
    }
    return {
      Id: 70000 + i,
      Identifier: `2610-${String(1201 + i).padStart(4, '0')}`,
      Sequence: 1201 + i,
      FloodAssistanceJob: false,
      ReferringAgency: null,
      ReferringAgencyReference: null,
      EmergencyOrder: null,
      SituationOnScene: situation,
      EvacuationRequired: false,
      PeopleInundated: 0,
      PeopleExtricated: 0,
      PeopleEvacuated: 0,
      CreatedOn: received,
      CreatedBy: OPERATOR,
      CallerFirstName: caller.FirstName,
      CallerLastName: caller.LastName,
      ICEMSIncidentIdentifier: null,
      ContactCalled: false,
      CallerPhoneNumber: fakePhone(i),
      ContactFirstName: null,
      ContactLastName: null,
      ContactPhoneNumber: null,
      EntityAssignedTo: { ...HQ },
      LGA: 'Demo City Council',
      Sector: null,
      JobPriorityType: PRIORITY[prio],
      TaskingCategory: 0,
      JobType: JOB_TYPE[type],
      JobStatusType: JOB_STATUS[status],
      Tags: tagKeys.map((k) => ({ ...TAGS[k], CreatedOn: '2015-01-01T00:00:00', CreatedBy: 1 })),
      Address: {
        GnafId: `GADEMO${String(700000 + i)}`,
        Latitude: lat,
        Longitude: lng,
        Type: null,
        Flat: null,
        Level: null,
        StreetNumber: num,
        Street: street,
        Locality: locality,
        PostCode: postcode,
        PrettyAddress: `${num} ${street}, ${locality} NSW ${postcode}`,
        AdditionalAddressInfo: null,
      },
      LastModified: history[history.length - 1].Timelogged,
      LastModifiedBy: OPERATOR,
      JobStatusTypeHistory: history,
      PermissionToEnterPremises: true,
      HowToEnterPremises: null,
      Event: {
        Id: 3001, Name: 'Demo Storm Event', Identifier: 'EVT-DEMO-01', Description: 'Severe storm, Demo Zone',
        District: 'Demo Zone', StartTime: t(12), EndTime: null,
      },
      JobReceived: received,
      Reconnoitered: false,
      AgenciesPresent: [],
      FloodAssistance: null,
      Type: JOB_TYPE[type].Name,
      PrintCount: 0,
      Categories: [],
      Frao: null,
      Locked: false,
    };
  });

  // The slimmer job shape Beacon embeds inside a tasking.
  const taskingJob = (j) => ({
    Id: j.Id,
    Identifier: j.Identifier,
    ICEMSIncidentIdentifier: null,
    TypeId: j.JobType.Id,
    Type: j.Type,
    CallerName: `${j.CallerFirstName} ${j.CallerLastName}`,
    CallerNumber: j.CallerPhoneNumber,
    ContactName: null,
    ContactNumber: null,
    PermissionToEnterPremises: j.PermissionToEnterPremises,
    HowToEnterPremises: null,
    JobReceived: j.JobReceived,
    JobPriorityType: j.JobPriorityType,
    JobStatusType: j.JobStatusType,
    JobType: j.JobType,
    EntityAssignedTo: j.EntityAssignedTo,
    LGA: j.LGA,
    Address: j.Address,
    Tags: j.Tags,
    TaskingCategory: 0,
    SituationOnScene: j.SituationOnScene,
    EventId: j.Event.Id,
    PrintCount: 0,
    ActionRequiredTags: ACTION_REQUIRED[j.Id - 70000] || [],
    Categories: [],
    InFrao: false,
    ImageCount: 0,
  });

  let memberSeq = 0;
  const teams = TEAM_SPECS.map(([callsign, status, memberCount, jobIdx], i) => ({
    Id: 80000 + i,
    Callsign: callsign,
    VehicleType: null,
    VehicleRegistration: null,
    TeamStatusStartDate: t(3 + i * 0.5),
    ReadyToReTask: t(-1),
    CreatedAt: { ...HQ },
    AssignedTo: { ...HQ },
    Sector: null,
    TeamStatusType: TEAM_STATUS[status],
    TeamType: TEAM_TYPE_FIELD,
    // NOTE: the captured sample team had no members, so this element shape
    // (TeamLeader + Person) is taken from models/Team.js, not from Beacon.
    Members: Array.from({ length: memberCount }, (_, m) => ({ TeamLeader: m === 0, Person: person(memberSeq++) })),
    Resources: [],
    Tags: [],
    Capabilities: [],
    TaskedJobCount: jobIdx.length,
    IsDeleted: false,
  }));

  // The thin team shape Beacon embeds inside a tasking.
  const taskingTeam = (tm) => ({
    Id: tm.Id,
    Callsign: tm.Callsign,
    CreatedAtId: tm.CreatedAt.Id,
    TeamTypeId: tm.TeamType.Id,
    CurrentStatusId: tm.TeamStatusType.Id,
    Members: tm.Members,
    IsDeleted: false,
  });

  const taskings = [];
  TEAM_SPECS.forEach(([, , , jobIdx], ti) => {
    jobIdx.forEach((ji, seq) => {
      // First job in a team's queue is under way; the rest are just tasked.
      const reached = seq === 0 ? (ti % 2 === 0 ? 3 : 2) : 1; // how many TASKING_STEPS are done
      const startH = Math.max(0.15, JOB_SPECS[ji][4] - 0.1);
      const stepTimes = TASKING_STEPS.slice(0, reached).map((_, k) => t(startH - k * 0.05));
      const history = TASKING_STEPS.slice(0, reached).map(([id, name], k) => ({
        Type: id, Name: name, Description: name, TimeLogged: stepTimes[k], EstimatedCompletion: null,
        CreatedOn: stepTimes[k], CreatedBy: OPERATOR,
      }));
      const [curId, curName] = TASKING_STEPS[reached - 1];
      const stamp = (k) => (k < reached ? stepTimes[k] : null);
      taskings.push({
        Id: 90000 + taskings.length,
        CurrentStatus: curName,
        CurrentStatusTime: stepTimes[reached - 1],
        CurrentStatusId: curId,
        EstimatedStatusEndTime: null,
        Enroute: stamp(1),
        EnrouteEstimatedCompletion: stamp(1),
        Onsite: stamp(2),
        OnsiteEstimatedCompletion: stamp(2),
        Offsite: stamp(3),
        Complete: null,
        Team: taskingTeam(teams[ti]),
        Job: taskingJob(jobs[ji]),
        Sequence: seq + 1,
        Manifest: [],
        DistanceToScene: null,
        InjuriesSustained: false,
        AARCompleted: false,
        CISPRequired: false,
        RiskAssessmentCompleted: false,
        VesselUsed: false,
        PrimaryActivityType: null,
        PrimaryTaskType: null,
        ActionTaken: null,
        EquipmentUsed: [],
        EquipmentKeptByName: null,
        EquipmentKeptByNumber: null,
        Injuries: [],
        SafetyManagementSheet: null,
        JobTeamStatusTypeHistory: history,
      });
    });
  });

  // PSN radio positions: a bare array of GeoJSON features (Beacon's
  // ResourceLocations/Radio), see BeaconClient/asset.js.
  const radio = TEAM_SPECS.filter((s) => s[4]).map(([, , , jobIdx, assetName, [dLat, dLng]], i) => {
    const anchor = jobIdx.length ? jobs[jobIdx[0]].Address : HQ;
    const lat = +(anchor.Latitude + dLat).toFixed(5);
    const lng = +(anchor.Longitude + dLng).toFixed(5);
    const seen = t(0.05);
    const id = 6100 + i;
    return {
      type: 'Feature',
      id,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        type: 'Feature',
        id,
        name: assetName,
        capability: i % 2 ? null : 'Storm',
        entity: HQ.Name,
        resourceType: 'Vehicle',
        sourceType: 'SAP',
        licensePlate: `DM${String(10 + i * 7).padStart(2, '0')}XX`,
        serialNumber: `000DEMO${String(i).padStart(3, '0')}`,
        radioId: 9900000 + i,
        equipmentId: String(99000000 + i),
        lastSeen: seen,
        status: 'COMM',
        direction: null,
        talkgroup: i % 2 ? null : 'DEMO OPS 1',
        talkgroupLastUpdated: i % 2 ? null : seen,
        smartConnect: 'ACTIVE',
        radioLatitude: lat,
        radioLongitude: lng,
        radioLocationLastUpdated: seen,
        satelliteId: null,
        satelliteBattery: null,
        satelliteLatitude: null,
        satelliteLongitude: null,
        satelliteClass: null,
        satelliteEquipmentId: null,
        satelliteLocationLastUpdated: null,
        SatelliteClassType: null,
      },
    };
  });

  // Vehicle telematics: a FeatureCollection (Beacon's
  // ResourceLocations/Telematics). displayName is "<callsign> <model>",
  // timestamp is epoch seconds.
  const telematics = {
    type: 'FeatureCollection',
    features: [
      ['DEM40', 'Isuzu D-Max', [-33.8061, 151.0122]],
      ['DEM41', 'Toyota HiLux', [-33.8243, 150.9874]],
    ].map(([cs, model, [lat, lng]], i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        id: `f-00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        type: 'vehicle',
        source: 'telematics',
        displayName: `${cs} ${model}`,
        timestamp: Math.floor(now.getTime() / 1000) - 120 * (i + 1),
        ignitionOn: i === 0,
        direction: 90 * i,
        speed: 0,
        eventTypeDescription: 'Health Check',
        prettyAddress: `${ADDRESSES[i + 2][0]} ${ADDRESSES[i + 2][1]}, ${ADDRESSES[i + 2][2]} NSW ${ADDRESSES[i + 2][3]}, Australia`,
        orgUnit: HQ.Code,
      },
    })),
  };

  const tagGroups = {
    5: [TAGS.BranchDown, TAGS.TreeOnHouse].map((x) => ({ ...x, CreatedOn: '2015-01-01T00:00:00', CreatedBy: 1 })),
    6: [TAGS.RoofLeak].map((x) => ({ ...x, CreatedOn: '2015-01-01T00:00:00', CreatedBy: 1 })),
  };

  // Job history endpoint shape (Jobs/{id}/History).
  const jobHistory = (jobId) => {
    const j = jobs.find((x) => x.Id === jobId);
    if (!j) return [];
    return j.JobStatusTypeHistory.map((h) => ({
      Name: h.Name, Description: `Status changed to ${h.Name}`, TimeLogged: h.Timelogged, TimeStamp: h.CreatedOn, CreatedBy: h.CreatedBy,
    }));
  };

  return { hq: HQ, jobs, teams, taskings, radio, telematics, tagGroups, jobHistory, timezone: TZ };
}
