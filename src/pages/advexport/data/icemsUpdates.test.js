import { describe, it, expect, vi } from 'vitest';
import { countUpdateMessages, icemsIncidents, countIcemsUpdates } from './icemsUpdates.js';

describe('countUpdateMessages', () => {
  it('counts Incident Update Messages but not their acceptances', () => {
    expect(countUpdateMessages([
      { Subject: 'ICEMS Incident Update Message received' },
      { Subject: 'ICEMS Incident Update Message Acceptance sent' },
      { Subject: 'Incident Update Message' },
      { Subject: 'Team tasked' },
      { Subject: null },
      {},
    ])).toBe(2);
    expect(countUpdateMessages(null)).toBe(0);
  });
});

describe('icemsIncidents', () => {
  it('keeps the incidents with an ICEMS id', () => {
    expect(icemsIncidents([{ Id: 1, ICEMSIncidentIdentifier: 'A' }, { Id: 2, ICEMSIncidentIdentifier: null }, { Id: 3, ICEMSIncidentIdentifier: '' }, { Id: 4 }]).map((j) => j.Id)).toEqual([1]);
  });
});

describe('countIcemsUpdates', () => {
  const ium = { Subject: 'Incident Update Message' };

  it('counts every incident, including the last and a lone one (the old page skipped the last)', async () => {
    const client = { operationslog: { search: vi.fn(async (id) => ({ results: Array(id).fill(ium) })) } };
    expect([...(await countIcemsUpdates(client, [{ Id: 2 }], {})).counts]).toEqual([[2, 2]]);
    const { counts, failed } = await countIcemsUpdates(client, [{ Id: 1 }, { Id: 2 }, { Id: 3 }, { Id: 4 }, { Id: 5 }], {});
    expect(Object.fromEntries(counts)).toEqual({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 });
    expect(failed).toBe(0);
  });

  it('runs at most four requests at once', async () => {
    let running = 0;
    let most = 0;
    const client = { operationslog: { search: vi.fn(async () => {
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return { results: [] };
    }) } };
    await countIcemsUpdates(client, Array.from({ length: 11 }, (_, i) => ({ Id: i })), {});
    expect(client.operationslog.search).toHaveBeenCalledTimes(11);
    expect(most).toBe(4);
  });

  it('reports progress and carries on past a failure', async () => {
    const client = { operationslog: { search: vi.fn(async (id) => {
      if (id === 2) throw new Error('503');
      return { results: [ium] };
    }) } };
    const progress = [];
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { counts, failed } = await countIcemsUpdates(client, [{ Id: 1 }, { Id: 2 }, { Id: 3 }], {}, { onProgress: (d, t) => progress.push(`${d}/${t}`) });
    expect(failed).toBe(1);
    expect(counts.has(2)).toBe(false);
    expect(counts.get(3)).toBe(1);
    expect(progress[0]).toBe('0/3');
    expect(progress.at(-1)).toBe('3/3');
  });

  it('is done straight away with nothing to count', async () => {
    const client = { operationslog: { search: vi.fn() } };
    expect((await countIcemsUpdates(client, [], {})).counts.size).toBe(0);
    expect(client.operationslog.search).not.toHaveBeenCalled();
  });
});
