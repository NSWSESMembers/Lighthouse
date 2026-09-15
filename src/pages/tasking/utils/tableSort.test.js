import { describe, it, expect } from 'vitest';
import ko from 'knockout';
import { compareByKey, compareJobsByKey, JOB_STATUS_ORDER, JOB_STATUS_RANK } from './tableSort.js';

describe('JOB_STATUS_RANK', () => {
  it('assigns each status its index in JOB_STATUS_ORDER', () => {
    JOB_STATUS_ORDER.forEach((s, i) => expect(JOB_STATUS_RANK[s]).toBe(i));
  });
});

describe('compareByKey', () => {
  it('sorts numerically for numeric values', () => {
    expect(compareByKey({ n: 2 }, { n: 10 }, 'n', true)).toBeLessThan(0);
  });

  it('sorts numeric-looking strings numerically, not lexically', () => {
    expect(compareByKey({ n: '2' }, { n: '10' }, 'n', true)).toBeLessThan(0);
  });

  it('sorts non-numeric strings via localeCompare', () => {
    expect(compareByKey({ n: 'banana' }, { n: 'apple' }, 'n', true)).toBeGreaterThan(0);
  });

  it('reverses the comparison when asc is false', () => {
    const ascResult = compareByKey({ n: 1 }, { n: 2 }, 'n', true);
    const descResult = compareByKey({ n: 1 }, { n: 2 }, 'n', false);
    expect(Math.sign(descResult)).toBe(-Math.sign(ascResult));
  });

  it('follows a dotted key path', () => {
    const a = { entityAssignedTo: { code: 'AAA' } };
    const b = { entityAssignedTo: { code: 'BBB' } };
    expect(compareByKey(a, b, 'entityAssignedTo.code', true)).toBeLessThan(0);
  });

  it('unwraps ko observables at each level', () => {
    const a = { entityAssignedTo: ko.observable({ code: ko.observable('AAA') }) };
    const b = { entityAssignedTo: ko.observable({ code: ko.observable('BBB') }) };
    expect(compareByKey(a, b, 'entityAssignedTo.code', true)).toBeLessThan(0);
  });

  it('treats a missing value as an empty string, sorting it first ascending', () => {
    expect(compareByKey({ n: null }, { n: 'x' }, 'n', true)).toBeLessThan(0);
  });
});

describe('compareJobsByKey', () => {
  it('sorts the "type" column by typeShort + categoriesNameNumberDash', () => {
    const a = { typeShort: () => 'FR', categoriesNameNumberDash: () => '-1' };
    const b = { typeShort: () => 'FR', categoriesNameNumberDash: () => '-2' };
    expect(compareJobsByKey(a, b, 'type', true)).toBeLessThan(0);
  });

  it('orders "statusName" by JOB_STATUS_RANK, not alphabetically', () => {
    // Alphabetically "Active" < "New", but JOB_STATUS_ORDER puts New before Active.
    const a = { statusName: 'New' };
    const b = { statusName: 'Active' };
    expect(compareJobsByKey(a, b, 'statusName', true)).toBeLessThan(0);
  });

  it('puts an unrecognised status last when ascending', () => {
    const known = { statusName: 'New' };
    const unknown = { statusName: 'SomeFutureStatus' };
    expect(compareJobsByKey(known, unknown, 'statusName', true)).toBeLessThan(0);
  });

  it('reverses statusName order when descending', () => {
    const ascResult = compareJobsByKey({ statusName: 'New' }, { statusName: 'Active' }, 'statusName', true);
    const descResult = compareJobsByKey({ statusName: 'New' }, { statusName: 'Active' }, 'statusName', false);
    expect(Math.sign(descResult)).toBe(-Math.sign(ascResult));
  });

  it('falls back to default numeric/locale comparison for other keys', () => {
    expect(compareJobsByKey({ identifier: 5 }, { identifier: 10 }, 'identifier', true)).toBeLessThan(0);
  });
});
