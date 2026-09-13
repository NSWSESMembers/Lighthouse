import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { get } from './suppliers.js';

vi.mock('./core/request.js', () => ({ request: vi.fn() }));

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset().mockResolvedValue({ Id: 1 });
});

describe('get', () => {
  it('requests suppliers for the job', async () => {
    await get('job1', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Suppliers/Job/job1?LighthouseFunction=suppliersGet&userId=u1');
  });
});
