import { describe, it, expect, vi } from 'vitest';
import { loadUnits, errorText } from './beacon.js';

const ctx = { host: 'https://api.test', userId: '17', token: 't' };

describe('loadUnits', () => {
  it('looks up every HQ id with the context', async () => {
    const getName = vi.fn(async (id) => ({ Id: Number(id), Name: `Unit ${id}` }));
    const units = await loadUnits({ unit: { getName } }, ['1', '2'], ctx);
    expect(units.map((u) => u.Name)).toEqual(['Unit 1', 'Unit 2']);
    expect(getName).toHaveBeenCalledWith('1', ctx);
  });

  it('is empty for all of NSW, and drops null answers', async () => {
    const getName = vi.fn(async () => null);
    expect(await loadUnits({ unit: { getName } }, [], ctx)).toEqual([]);
    expect(await loadUnits({ unit: { getName } }, ['9'], ctx)).toEqual([]);
  });
});

describe('errorText', () => {
  it('tells the user to reopen the page on a 401', () => {
    expect(errorText({ status: 401 }, 'Incident Summary')).toBe('Beacon refused the request (401). Reopen Incident Summary from Beacon to sign in again.');
  });

  it('gives the status for other Beacon errors', () => {
    expect(errorText({ status: 500, statusText: 'Internal Server Error' }, 'X')).toBe('Beacon returned 500 Internal Server Error.');
    expect(errorText({ status: 503 }, 'X')).toBe('Beacon returned 503.');
  });

  it('falls back to the message', () => {
    expect(errorText(new Error('offline'), 'X')).toBe('offline');
    expect(errorText(null, 'X')).toBe('Unknown error');
  });
});
