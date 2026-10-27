/*
  The fake HQs every page harness uses: four units in one fake zone. Same
  rules as scripts/lad-docs/scenario.mjs: the *structure* follows Beacon's
  Entities/{id} payload, every *value* is invented.
*/

export const ZONE = { Id: 9000, Code: 'DMZ', Name: 'Demo Zone', ParentEntity: { Id: 1, Code: 'STA', Name: 'Demo State' } };

const entity = (Id, Code, Name, Latitude, Longitude) => ({
  Id, Code, Name, Latitude, Longitude,
  EntityTypeId: 1,
  HeadquartersStatusTypeId: 1,
  ParentEntity: { Id: ZONE.Id, Code: ZONE.Code, Name: ZONE.Name },
  AriaCodeType: { Id: 1, Name: 'Not Applicable', Description: null },
  AriaCode: null,
  CadCode: `SES${Id}`,
});

export const UNITS = [
  entity(9001, 'DEM', 'Demo City', -33.815, 151.001),
  entity(9002, 'DMH', 'Demo Heights', -33.79, 150.96),
  entity(9003, 'DMV', 'Demo Vale', -33.86, 150.98),
  entity(9004, 'DMP', 'Demo Point', -33.84, 151.05),
];

/** A seeded PRNG, so a scenario is the same on every run. */
export function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
