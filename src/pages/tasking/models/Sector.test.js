import { describe, it, expect } from 'vitest';
import { Sector } from './Sector.js';

describe('Sector construction', () => {
  it('defaults every field for an empty payload', () => {
    const s = new Sector({});
    expect(s.id()).toBeNull();
    expect(s.name()).toBeNull();
    expect(s.CurrentStatus.Id()).toBeNull();
    expect(s.SectorType.Id()).toBeNull();
    expect(s.Latitude()).toBeNull();
    expect(s.Boundary()).toEqual([]);
  });

  it('maps CurrentStatus (including nested CreatedBy) and SectorType', () => {
    const s = new Sector({
      Id: 's1', Name: 'Sector 1',
      CurrentStatus: { Id: 1, Name: 'Active', CreatedBy: { Id: 9, FirstName: 'A', LastName: 'B' } },
      SectorType: { Id: 2, Name: 'Search' },
      Latitude: -33.8, Longitude: 151.2, Boundary: [[0, 0], [1, 1]],
    });
    expect(s.CurrentStatus.Name()).toBe('Active');
    expect(s.CurrentStatus.CreatedBy.FirstName()).toBe('A');
    expect(s.SectorType.Name()).toBe('Search');
    expect(s.Boundary()).toEqual([[0, 0], [1, 1]]);
  });

  it('wraps Entity as a real Entity instance', () => {
    const s = new Sector({ Entity: { Id: 'e1', Name: 'HQ' } });
    expect(s.Entity.id()).toBe('e1');
  });
});

describe('Sector.updateFromJson', () => {
  it('updates id, name, Entity and CurrentStatus', () => {
    const s = new Sector({ Id: 's1', Name: 'Old' });
    s.updateFromJson({ Id: 's2', Name: 'New', Entity: { Id: 'e2' }, CurrentStatus: { Id: 5, Name: 'Closed' } });
    expect(s.id()).toBe('s2');
    expect(s.name()).toBe('New');
    expect(s.Entity.id()).toBe('e2');
    expect(s.CurrentStatus.Name()).toBe('Closed');
  });

  it('resets id/name/Entity/SectorType/Latitude/Longitude/Boundary to defaults when the patch omits them', () => {
    // updateFromJson always sets every field from its argument -- there's no
    // "only if present" guard like Job/Team's updateFromJson, so calling it
    // with {} blanks the sector out entirely.
    const s = new Sector({
      Id: 's1', Name: 'Old', Entity: { Id: 'e1' },
      SectorType: { Id: 1, Name: 'Search' }, Latitude: -33.8, Longitude: 151.2, Boundary: [[0, 0]],
    });
    s.updateFromJson({});
    expect(s.id()).toBeNull();
    expect(s.name()).toBeNull();
    expect(s.Entity.id()).toBeNull();
    expect(s.SectorType.Name()).toBeNull();
    expect(s.Latitude()).toBeNull();
    expect(s.Boundary()).toEqual([]);
  });

  it('updates SectorType, Latitude, Longitude and Boundary from the patch', () => {
    const s = new Sector({ SectorType: { Id: 1, Name: 'Search' }, Latitude: -33.8, Longitude: 151.2, Boundary: [[0, 0]] });
    s.updateFromJson({ SectorType: { Id: 2, Name: 'Rescue' }, Latitude: -34, Longitude: 152, Boundary: [[1, 1]] });
    expect(s.SectorType.Name()).toBe('Rescue');
    expect(s.Latitude()).toBe(-34);
    expect(s.Longitude()).toBe(152);
    expect(s.Boundary()).toEqual([[1, 1]]);
  });
});
