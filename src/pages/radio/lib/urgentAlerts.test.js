import { describe, it, expect } from 'vitest';
import { classifyUrgency, urgencyLabel, pickUrgentEntries } from './urgentAlerts.js';

const now = Date.parse('2026-09-19T10:00:00Z');
const at = (minutesAgo) => new Date(now - minutesAgo * 60000).toISOString();
const e = (o) => ({ Id: 1, Subject: 'TAB56', Text: 'help', CreatedOn: at(1), ...o });
const run = (entries, extra = {}) => pickUrgentEntries(entries, { seen: new Set(), now, ...extra });

describe('classifyUrgency', () => {
  it('names Important, Action Required, both, or nothing', () => {
    expect(classifyUrgency({ Important: true })).toBe('important');
    expect(classifyUrgency({ ActionRequired: true })).toBe('action');
    expect(classifyUrgency({ Important: true, ActionRequired: true })).toBe('both');
    expect(classifyUrgency({})).toBeNull();
    expect(classifyUrgency(null)).toBeNull();
    expect(urgencyLabel('both')).toBe('Important + Action required');
  });
});

describe('pickUrgentEntries', () => {
  it('alerts for a new Important or Action Required entry and describes it', () => {
    const { urgent, seenIds } = run([e({ Id: 5, Important: true })]);
    expect(urgent).toEqual([{ id: 5, kind: 'important', callsign: 'TAB56', text: 'help', createdOn: at(1) }]);
    expect(seenIds).toEqual([5]);
  });
  it('ignores ordinary entries but still remembers their ids', () => {
    const r = run([e({ Id: 6 })]);
    expect(r.urgent).toEqual([]);
    expect(r.seenIds).toEqual([6]);
  });
  it('does not alert twice for an id already seen (a poll re-delivers the same rows)', () => {
    expect(pickUrgentEntries([e({ Id: 5, Important: true })], { seen: new Set([5]), now }).urgent).toEqual([]);
  });
  it('never alerts for the operator\'s own entries, or while their submit is in flight', () => {
    expect(run([e({ Important: true, CreatedBy: { Id: 42 } })], { personId: '42' }).urgent).toEqual([]);
    expect(run([e({ Important: true, CreatedBy: { Id: 7 } })], { personId: '42' }).urgent).toHaveLength(1);
    expect(run([e({ Important: true })], { suppress: true }).urgent).toEqual([]);
  });
  it('ignores an old row that only just showed up, but alerts when its age is unknown', () => {
    expect(run([e({ Important: true, CreatedOn: at(60) })]).urgent).toEqual([]);
    expect(run([e({ Important: true, CreatedOn: null })]).urgent).toHaveLength(1);
  });
  it('can be limited to Important entries only, or Action Required only', () => {
    const rows = [e({ Id: 1, Important: true }), e({ Id: 2, ActionRequired: true }), e({ Id: 3, Important: true, ActionRequired: true })];
    expect(run(rows, { kinds: { important: true, action: false } }).urgent.map((u) => u.id)).toEqual([1, 3]);
    expect(run(rows, { kinds: { important: false, action: true } }).urgent.map((u) => u.id)).toEqual([2, 3]);
    expect(run(rows, { kinds: { important: false, action: false } }).urgent).toEqual([]);
  });
  it('still remembers ids it did not alert for, so switching a flag on later does not replay them', () => {
    const r = run([e({ Id: 2, ActionRequired: true })], { kinds: { important: true, action: false } });
    expect(r.urgent).toEqual([]);
    expect(r.seenIds).toEqual([2]);
  });
  it('skips malformed rows and de-defaults missing text', () => {
    const { urgent } = run([null, { Important: true }, e({ Id: 9, Important: true, Subject: '', Text: undefined })]);
    expect(urgent).toEqual([{ id: 9, kind: 'important', callsign: '(no callsign)', text: '', createdOn: at(1) }]);
  });
});
