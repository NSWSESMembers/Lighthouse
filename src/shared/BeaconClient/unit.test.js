import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { getName } from './unit.js';

vi.mock('./core/request.js', () => ({ request: vi.fn() }));

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset().mockResolvedValue({ Id: 1, Code: 'ABC' });
});

describe('getName', () => {
  it('requests the entity by id for its unit name/code', async () => {
    await getName('unit1', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Entities/unit1?LighthouseFunction=GetUnitNamefromBeacon&userId=u1');
  });
});
