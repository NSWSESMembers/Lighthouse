import { describe, it, expect } from 'vitest';
import { upsertAlert, retainAlerts, chimeNotes } from './alertStack.js';

const a = (key, n = 1) => ({ key, n });

describe('upsertAlert', () => {
  it('puts a new alert on top', () => {
    expect(upsertAlert([a('x')], a('y')).map((v) => v.key)).toEqual(['y', 'x']);
  });
  it('replaces an alert with the same key and moves it to the top (a repeat, or due-soon -> overdue)', () => {
    const r = upsertAlert([a('x'), a('y')], a('y', 2));
    expect(r.map((v) => v.key)).toEqual(['y', 'x']);
    expect(r[0].n).toBe(2);
  });
});

describe('retainAlerts', () => {
  it('drops alerts of the given kind that are no longer active, keeping other kinds', () => {
    const list = [a('action-1'), a('action-2'), a('check-TAB56'), a('test')];
    expect(retainAlerts(list, 'action-', new Set(['action-2'])).map((v) => v.key)).toEqual(['action-2', 'check-TAB56', 'test']);
  });
  it('clears every alert of the kind when none are active', () => {
    expect(retainAlerts([a('action-1'), a('check-1')], 'action-', new Set()).map((v) => v.key)).toEqual(['check-1']);
  });
});

describe('chimeNotes', () => {
  it('yellow (due soon) is the three-note chime', () => {
    const notes = chimeNotes('due-soon');
    expect(notes.map((n) => n.frequency)).toEqual([880, 660, 880]);
    expect(notes.every((n) => n.type === 'sine')).toBe(true);
  });
  it('red (overdue) is a different, faster and higher alarm', () => {
    const red = chimeNotes('overdue');
    const yellow = chimeNotes('due-soon');
    expect(red).not.toEqual(yellow);
    expect(red.length).toBeGreaterThan(yellow.length);
    expect(Math.max(...red.map((n) => n.frequency))).toBeGreaterThan(Math.max(...yellow.map((n) => n.frequency)));
    expect(red[1].start - red[0].start).toBeLessThan(yellow[1].start - yellow[0].start); // faster
  });
  it('every note has positive timing and a sensible volume', () => {
    ['overdue', 'due-soon'].forEach((sev) =>
      chimeNotes(sev).forEach((n) => {
        expect(n.duration).toBeGreaterThan(0);
        expect(n.gain).toBeGreaterThan(0);
        expect(n.gain).toBeLessThanOrEqual(0.4);
      }),
    );
  });
});
