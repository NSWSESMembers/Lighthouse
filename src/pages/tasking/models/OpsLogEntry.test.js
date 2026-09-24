import { describe, it, expect, vi } from 'vitest';
import { OpsLogEntry } from './OpsLogEntry.js';

// Always pass relativeUpdateTick so we don't fall back to a real setInterval
// (per-instance, 60s) that would otherwise leak for the life of the test run.
const deps = () => ({ relativeUpdateTick: vi.fn(() => 0) });

describe('isIcemsEntry', () => {
  it('is true when icemsIncidentIdentifier is set', () => {
    const e = new OpsLogEntry({ ICEMSIncidentIdentifier: '6/1718' }, deps());
    expect(e.isIcemsEntry()).toBe(true);
  });

  it('is true when an "icems" tag is present (case/whitespace-insensitive)', () => {
    const e = new OpsLogEntry({ Tags: [{ Name: ' ICEMS ' }] }, deps());
    expect(e.isIcemsEntry()).toBe(true);
  });

  it('is false otherwise', () => {
    const e = new OpsLogEntry({ Tags: [{ Name: 'Other' }] }, deps());
    expect(e.isIcemsEntry()).toBe(false);
  });
});

describe('tagsCsv / hasPoliceTag / hasIncomingTag', () => {
  it('joins tag names for tagsCsv', () => {
    const e = new OpsLogEntry({ Tags: [{ Name: 'Police' }, { Name: 'Damage' }] }, deps());
    expect(e.tagsCsv()).toBe('Police, Damage');
  });

  it('detects a police tag case-insensitively', () => {
    const e = new OpsLogEntry({ Tags: [{ Name: 'POLICE' }] }, deps());
    expect(e.hasPoliceTag()).toBe(true);
  });

  it('detects an incoming tag case-insensitively', () => {
    const e = new OpsLogEntry({ Tags: [{ Name: 'Incoming' }] }, deps());
    expect(e.hasIncomingTag()).toBe(true);
  });

  it('is false with no matching tags', () => {
    const e = new OpsLogEntry({ Tags: [] }, deps());
    expect(e.hasPoliceTag()).toBe(false);
    expect(e.hasIncomingTag()).toBe(false);
  });
});

describe('addTag / removeTagId', () => {
  it('addTag appends a new Tag instance', () => {
    const e = new OpsLogEntry({}, deps());
    e.addTag({ Id: 1, Name: 'New' });
    expect(e.tags()).toHaveLength(1);
    expect(e.tags()[0].name()).toBe('New');
  });

  it('removeTagId removes by id', () => {
    const e = new OpsLogEntry({ Tags: [{ Id: 1, Name: 'A' }, { Id: 2, Name: 'B' }] }, deps());
    e.removeTagId(1);
    expect(e.tags().map((t) => t.id())).toEqual([2]);
  });
});

describe('updateFromJson', () => {
  it('patches only the fields present in the update', () => {
    const e = new OpsLogEntry({ Subject: 'Original', Text: 'Body' }, deps());
    e.updateFromJson({ Subject: 'Updated' });
    expect(e.subject()).toBe('Updated');
    expect(e.text()).toBe('Body');
  });

  it('replaces Tags wholesale when given, leaves them alone otherwise', () => {
    const e = new OpsLogEntry({ Tags: [{ Id: 1, Name: 'A' }] }, deps());
    e.updateFromJson({ Subject: 'x' });
    expect(e.tags().map((t) => t.id())).toEqual([1]); // untouched

    e.updateFromJson({ Tags: [{ Id: 2, Name: 'B' }] });
    expect(e.tags().map((t) => t.id())).toEqual([2]); // replaced
  });

  it('updates the nested Entity fields', () => {
    const e = new OpsLogEntry({ Entity: { Id: 'e1', Code: 'HQ1' } }, deps());
    e.updateFromJson({ Entity: { Id: 'e2', Code: 'HQ2', Name: 'New HQ' } });
    expect(e.entity.id()).toBe('e2');
    expect(e.entity.name()).toBe('New HQ');
  });

  it('updates the nested CreatedBy fields', () => {
    const e = new OpsLogEntry({}, deps());
    e.updateFromJson({ CreatedBy: { Id: 9, FirstName: 'Jane', FullName: 'Jane Doe' } });
    expect(e.createdBy.firstName()).toBe('Jane');
    expect(e.createdBy.fullName()).toBe('Jane Doe');
  });

  it('coerces boolean-ish flags with !!', () => {
    const e = new OpsLogEntry({}, deps());
    e.updateFromJson({ Important: 1, Restricted: 0 });
    expect(e.important()).toBe(true);
    expect(e.restricted()).toBe(false);
  });
});
