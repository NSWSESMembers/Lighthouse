import { describe, it, expect } from 'vitest';
import { summarize, reportRows, percentText, TYPE_GROUPS } from './summaryCounts.js';

const rows = (obj) => Object.entries(obj).map(([Name, Count]) => ({ Name, Count }));

const REPORT = {
  result: rows({
    New: 3, Active: 5, Tasked: 7, Referred: 1,
    Complete: 20, Cancelled: 2, Rejected: 1, Finalised: 11,
    Storm: 30, 'Flood Misc': 4, Resupply: 2, 'Medical Resupply': 1, 'Fodder Drop': 0, 'Vet Assistance': 1,
    RCR: 2, FR: 1, WR: 0, VR: 1, CFR: 0, LAR: 1, GLR: 0, PAD: 0, Support: 3,
  }),
};

describe('summarize', () => {
  it('adds up outstanding, closed and total', () => {
    const s = summarize(REPORT);
    expect(s.outstanding).toBe(16);
    expect(s.closed).toBe(34);
    expect(s.total).toBe(50);
  });

  it('lists the statuses in order, "Complete" as "Completed"', () => {
    const s = summarize(REPORT);
    expect(s.open.map((x) => [x.label, x.count])).toEqual([['New', 3], ['Active', 5], ['Tasked', 7], ['Referred', 1]]);
    expect(s.finished.map((x) => [x.key, x.label, x.count])).toEqual([
      ['complete', 'Completed', 20], ['cancelled', 'Cancelled', 2], ['rejected', 'Rejected', 1], ['finalised', 'Finalised', 11],
    ]);
  });

  it('groups flood and rescue types, and says what they include', () => {
    const types = Object.fromEntries(summarize(REPORT).types.map((t) => [t.key, t]));
    expect(types.storm.count).toBe(30);
    expect(types.flood.count).toBe(8);
    expect(types.rescue.count).toBe(5);
    expect(types.support.count).toBe(3);
    expect(types.storm.includes).toEqual([]);
    expect(types.flood.includes).toEqual(TYPE_GROUPS.find((g) => g.key === 'flood').names);
    // PAD counts towards Rescue but isn't listed under it.
    expect(types.rescue.includes).toEqual(['RCR', 'FR', 'WR', 'VR', 'CFR', 'LAR', 'GLR']);
    expect(summarize({ result: rows({ PAD: 2 }) }).types.find((t) => t.key === 'rescue').count).toBe(2);
  });

  it('counts a row Beacon leaves out as zero', () => {
    const s = summarize({ result: rows({ New: 2, Storm: 2 }) });
    expect(s.total).toBe(2);
    expect(s.types.find((t) => t.key === 'rescue').count).toBe(0);
  });

  it('copes with an empty or odd report', () => {
    expect(summarize(null).total).toBe(0);
    expect(summarize({ result: [null, { Name: 'New', Count: 'x' }, { Count: 4 }] }).total).toBe(0);
  });
});

describe('reportRows', () => {
  it('accepts result, Result or a bare array', () => {
    const r = [{ Name: 'New', Count: 1 }];
    expect(reportRows({ result: r })).toBe(r);
    expect(reportRows({ Result: r })).toBe(r);
    expect(reportRows(r)).toBe(r);
    expect(reportRows(undefined)).toEqual([]);
  });
});

describe('percentText', () => {
  it('rounds to a whole percent', () => {
    expect(percentText(1, 3)).toBe('33%');
    expect(percentText(50, 50)).toBe('100%');
  });

  it('is a dash for nothing', () => {
    expect(percentText(0, 10)).toBe('—');
    expect(percentText(0, 0)).toBe('—');
  });
});
