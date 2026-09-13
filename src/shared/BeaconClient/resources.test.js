import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { get } from './resources.js';

vi.mock('./core/request.js', () => ({ request: vi.fn() }));

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset().mockResolvedValue({ Id: 1 });
});

describe('get', () => {
  it('requests the entity by id', async () => {
    await get('entity1', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Entities/entity1?LighthouseFunction=GetResourcesfromBeacon&userId=u1');
  });
});
