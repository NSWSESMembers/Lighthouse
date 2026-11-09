import { describe, it, expect } from 'vitest';
import { fetchPowerOutages, outageRows, outageTitle, POWER_OUTAGES_URL } from './powerOutages.js';

describe('fetchPowerOutages', () => {
  it('sends the Beacon token without cookies', async () => {
    let seen;
    const body = { type: 'FeatureCollection', features: [], meta: {} };
    const fetchImpl = async (url, opts) => {
      seen = { url, opts };
      return { ok: true, json: async () => body };
    };
    expect(await fetchPowerOutages('tok', { fetchImpl })).toBe(body);
    expect(seen.url).toBe(POWER_OUTAGES_URL);
    expect(seen.opts.headers.Authorization).toBe('Bearer tok');
    expect(seen.opts.credentials).toBe('omit');
  });

  it('throws on an error status or an unexpected body', async () => {
    await expect(fetchPowerOutages('t', { fetchImpl: async () => ({ ok: false, status: 401 }) })).rejects.toThrow(/401/);
    await expect(
      fetchPowerOutages('t', { fetchImpl: async () => ({ ok: true, json: async () => ({ error: 'x' }) }) }),
    ).rejects.toThrow(/unexpected/);
  });
});

describe('outage popup', () => {
  const props = {
    provider: 'ausgrid',
    id: '900001',
    type: 'unplanned',
    status: 'In progress',
    customers: 0,
    cause: 'Fallen tree',
    suburbs: 'Demoville',
    streets: '',
    start: '2026-11-09T07:30:00.000Z',
    estRestore: null,
    updated: null,
  };

  it('titles by company and type', () => {
    expect(outageTitle(props)).toBe('Ausgrid unplanned outage');
    expect(outageTitle({ provider: 'essential', type: 'planned' })).toBe('Essential Energy planned outage');
  });

  it('lists the non-empty details and the contact number', () => {
    const rows = outageRows(props);
    expect(rows.map(([l]) => l)).toEqual(['Customers affected', 'Status', 'Cause', 'Suburbs', 'Started', 'Reference', 'Contact']);
    expect(rows[0]).toEqual(['Customers affected', '0']);
    expect(rows.at(-1)).toEqual(['Contact', 'Ausgrid 13 13 88']);
  });

  it('marks a restore estimate that has passed as overdue', () => {
    const now = Date.parse('2026-11-09T09:00:00.000Z');
    const row = (estRestore) => outageRows({ ...props, estRestore }, undefined, now).find(([l]) => l === 'Est. restore')[1];
    expect(row('2026-11-09T08:00:00.000Z')).toMatch(/ \(overdue\)$/);
    expect(row('2026-11-09T10:00:00.000Z')).not.toMatch(/overdue/);
  });

  it('flags a company whose feed has stopped updating', () => {
    const meta = { providers: { ausgrid: { ok: false, lastGoodAt: null } } };
    expect(outageRows(props, meta)).toContainEqual(['Feed', 'Not updating']);
    expect(outageRows({ ...props, type: 'planned' }).map(([l]) => l)).toContain('Starts');
  });
});
