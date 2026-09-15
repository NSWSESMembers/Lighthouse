import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { getGroup } from './tags.js';

vi.mock('./core/request.js', () => ({ request: vi.fn() }));

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset();
});

describe('getGroup', () => {
  it('returns Results from a 1000-row page request', async () => {
    vi.mocked(request).mockResolvedValue({ Results: [{ Id: 1 }] });
    const result = await getGroup('group1', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toContain('pageIndex=1&pageSize=1000');
    expect(result).toEqual([{ Id: 1 }]);
  });

  it('falls back to an empty array on a null body', async () => {
    vi.mocked(request).mockResolvedValue(null);
    const result = await getGroup('group1', ctx);
    expect(result).toEqual([]);
  });
});
