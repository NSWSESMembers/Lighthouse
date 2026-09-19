import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as team from '../../../shared/BeaconClient/team.js';
import * as job from '../../../shared/BeaconClient/job.js';
import { fetchSitrepData, SitrepFetchError } from './fetchSitrepData.js';

vi.mock('../../../shared/BeaconClient/team.js', () => ({ search: vi.fn(), getHistory: vi.fn() }));
vi.mock('../../../shared/BeaconClient/job.js', () => ({ search: vi.fn() }));

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };
const windowStart = new Date('2026-01-01T00:00:00.000Z');
const windowEnd = new Date('2026-01-02T00:00:00.000Z');

beforeEach(() => {
  vi.mocked(job.search).mockReset();
  vi.mocked(team.search).mockReset();
  vi.mocked(team.getHistory).mockReset();
});

describe('fetchSitrepData', () => {
  it('fetches jobs, teams and per-team history, and reports complete data', async () => {
    vi.mocked(job.search).mockResolvedValue({ results: [{ Id: 'j1' }], totalItems: 1 });
    vi.mocked(team.search).mockResolvedValue({ results: [{ Id: 't1', Callsign: 'RESCUE1', Members: [] }], totalItems: 1 });
    vi.mocked(team.getHistory).mockResolvedValue({ results: [], totalItems: 0 });

    const result = await fetchSitrepData({ unit: { Id: 5 }, windowStart, windowEnd, ctx });

    expect(result.jobs).toHaveLength(1);
    expect(result.jobsFetchComplete).toBe(true);
    expect(result.teamsFetchComplete).toBe(true);
    expect(result.teamContexts).toHaveLength(1);
    expect(result.teamContexts[0]).toMatchObject({ teamId: 't1', callsign: 'RESCUE1', historyFetchFailed: false });
  });

  it('widens the team search window by activationLookbackDays before windowStart', async () => {
    vi.mocked(job.search).mockResolvedValue({ results: [], totalItems: 0 });
    vi.mocked(team.search).mockResolvedValue({ results: [], totalItems: 0 });

    await fetchSitrepData({ unit: null, windowStart, windowEnd, ctx, activationLookbackDays: 10 });

    const [, startArg] = vi.mocked(team.search).mock.calls[0];
    expect(startArg.toISOString()).toBe('2025-12-22T00:00:00.000Z');
  });

  it('flags jobsFetchComplete=false when Beacon returns fewer rows than totalItems (pagination cut short)', async () => {
    vi.mocked(job.search).mockResolvedValue({ results: [{ Id: 'j1' }], totalItems: 50 });
    vi.mocked(team.search).mockResolvedValue({ results: [], totalItems: 0 });

    const result = await fetchSitrepData({ unit: null, windowStart, windowEnd, ctx });
    expect(result.jobsFetchComplete).toBe(false);
  });

  it('marks an individual team historyFetchFailed=true rather than failing the whole fetch', async () => {
    vi.mocked(job.search).mockResolvedValue({ results: [], totalItems: 0 });
    vi.mocked(team.search).mockResolvedValue({
      results: [
        { Id: 't1', Callsign: 'RESCUE1', Members: [] },
        { Id: 't2', Callsign: 'RESCUE2', Members: [] },
      ],
      totalItems: 2,
    });
    vi.mocked(team.getHistory).mockImplementation((teamId) =>
      teamId === 't2' ? Promise.reject(new Error('network error')) : Promise.resolve({ results: [], totalItems: 0 }),
    );

    const result = await fetchSitrepData({ unit: null, windowStart, windowEnd, ctx });
    const failed = result.teamContexts.find((t) => t.teamId === 't2');
    const ok = result.teamContexts.find((t) => t.teamId === 't1');
    expect(failed.historyFetchFailed).toBe(true);
    expect(ok.historyFetchFailed).toBe(false);
  });

  it('never silently reports a failed incident fetch as zero -- it throws', async () => {
    vi.mocked(job.search).mockRejectedValue(new Error('502'));
    vi.mocked(team.search).mockResolvedValue({ results: [], totalItems: 0 });

    await expect(fetchSitrepData({ unit: null, windowStart, windowEnd, ctx })).rejects.toThrow(SitrepFetchError);
  });

  it('never silently reports a failed team fetch as zero -- it throws', async () => {
    vi.mocked(job.search).mockResolvedValue({ results: [], totalItems: 0 });
    vi.mocked(team.search).mockRejectedValue(new Error('502'));

    await expect(fetchSitrepData({ unit: null, windowStart, windowEnd, ctx })).rejects.toThrow(SitrepFetchError);
  });
});
