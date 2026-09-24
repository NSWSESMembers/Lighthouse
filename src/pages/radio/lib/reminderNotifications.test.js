import { describe, it, expect } from 'vitest';
import { emptyNotifiedState, acknowledgeAction, planReminderNotifications } from './reminderNotifications.js';

const MIN = 60000;
const t0 = Date.parse('2026-09-19T10:00:00Z');
const prefs = { dueSoon: true, overdue: true, repeatMinutes: 0 };
const a = (id, severity) => ({ id, severity });
const run = (actions, state, p = prefs, now = t0) => planReminderNotifications(actions, state, p, now);

describe('planReminderNotifications', () => {
  it('announces an action once when it comes due soon, and once more when it goes overdue', () => {
    let r = run([a(1, 'due-soon')], emptyNotifiedState());
    expect(r.toNotify).toEqual([{ id: 1, kind: 'due-soon', repeat: false }]);
    r = run([a(1, 'due-soon')], r.state);
    expect(r.toNotify).toEqual([]);
    r = run([a(1, 'overdue')], r.state);
    expect(r.toNotify).toEqual([{ id: 1, kind: 'overdue', repeat: false }]);
    r = run([a(1, 'overdue')], r.state);
    expect(r.toNotify).toEqual([]);
  });

  it('re-arms an action that was resolved or rescheduled out of the state', () => {
    let r = run([a(1, 'overdue')], emptyNotifiedState());
    r = run([], r.state);
    r = run([a(1, 'overdue')], r.state);
    expect(r.toNotify).toEqual([{ id: 1, kind: 'overdue', repeat: false }]);
  });

  it('ignores actions that are neither due soon nor overdue', () => {
    expect(run([a(1, 'not-due'), a(2, 'later')], emptyNotifiedState()).toNotify).toEqual([]);
  });

  it('notifies for several actions at once, due-soon ones first', () => {
    expect(run([a(1, 'overdue'), a(2, 'due-soon')], emptyNotifiedState()).toNotify.map((n) => n.id)).toEqual([2, 1]);
  });

  it('respects the preferences, but still records what it saw so turning one on later does not replay old actions', () => {
    let r = run([a(1, 'due-soon'), a(2, 'overdue')], emptyNotifiedState(), { ...prefs, dueSoon: false });
    expect(r.toNotify).toEqual([{ id: 2, kind: 'overdue', repeat: false }]);
    r = run([a(1, 'due-soon'), a(2, 'overdue')], r.state);
    expect(r.toNotify).toEqual([]);
  });
});

describe('repeating overdue notifications', () => {
  const repeat5 = { ...prefs, repeatMinutes: 5 };

  it('repeats an overdue, unacknowledged action every N minutes, not before', () => {
    let r = run([a(1, 'overdue')], emptyNotifiedState(), repeat5, t0);
    expect(r.toNotify).toHaveLength(1);
    r = run([a(1, 'overdue')], r.state, repeat5, t0 + 4 * MIN);
    expect(r.toNotify).toEqual([]);
    r = run([a(1, 'overdue')], r.state, repeat5, t0 + 5 * MIN);
    expect(r.toNotify).toEqual([{ id: 1, kind: 'overdue', repeat: true }]);
    r = run([a(1, 'overdue')], r.state, repeat5, t0 + 9 * MIN);
    expect(r.toNotify).toEqual([]); // the clock restarts from the repeat
    r = run([a(1, 'overdue')], r.state, repeat5, t0 + 10 * MIN);
    expect(r.toNotify).toHaveLength(1);
  });

  it('stops once the action is acknowledged, and once it is resolved', () => {
    let r = run([a(1, 'overdue')], emptyNotifiedState(), repeat5, t0);
    r = { ...r, state: acknowledgeAction(r.state, 1) };
    expect(run([a(1, 'overdue')], r.state, repeat5, t0 + 30 * MIN).toNotify).toEqual([]);
    const resolved = run([], r.state, repeat5, t0 + 30 * MIN);
    expect(resolved.state.acknowledged.size).toBe(0); // acknowledgement doesn't outlive the overdue state
  });

  it('acknowledging a due-soon action silences the overdue alert and the repeats too', () => {
    let r = run([a(1, 'due-soon')], emptyNotifiedState(), repeat5, t0);
    r = { ...r, state: acknowledgeAction(r.state, 1) };
    r = run([a(1, 'due-soon')], r.state, repeat5, t0 + 2 * MIN);
    expect(r.state.acknowledged.has(1)).toBe(true); // still remembered while due soon
    r = run([a(1, 'overdue')], r.state, repeat5, t0 + 20 * MIN);
    expect(r.toNotify).toEqual([]); // no "reminder due" alert
    r = run([a(1, 'overdue')], r.state, repeat5, t0 + 60 * MIN);
    expect(r.toNotify).toEqual([]); // and no repeats
  });

  it('acknowledging before the first alert prevents it', () => {
    const acked = acknowledgeAction(emptyNotifiedState(), 1);
    expect(run([a(1, 'overdue')], acked, repeat5, t0).toNotify).toEqual([]);
    expect(run([a(1, 'due-soon')], acked, repeat5, t0).toNotify).toEqual([]);
  });

  it('an acknowledged action alerts again after it stops being outstanding and comes back', () => {
    let r = run([a(1, 'overdue')], acknowledgeAction(emptyNotifiedState(), 1), repeat5, t0);
    r = run([], r.state, repeat5, t0 + MIN); // resolved
    r = run([a(1, 'overdue')], r.state, repeat5, t0 + 2 * MIN);
    expect(r.toNotify).toHaveLength(1);
  });

  it('does not repeat when repeat is off, when overdue notifications are off, or for due-soon actions', () => {
    let r = run([a(1, 'overdue')], emptyNotifiedState(), prefs, t0);
    expect(run([a(1, 'overdue')], r.state, prefs, t0 + 60 * MIN).toNotify).toEqual([]);
    r = run([a(1, 'overdue')], emptyNotifiedState(), { ...repeat5, overdue: false }, t0);
    expect(run([a(1, 'overdue')], r.state, { ...repeat5, overdue: false }, t0 + 60 * MIN).toNotify).toEqual([]);
    r = run([a(2, 'due-soon')], emptyNotifiedState(), repeat5, t0);
    expect(run([a(2, 'due-soon')], r.state, repeat5, t0 + 60 * MIN).toNotify).toEqual([]);
  });
});
