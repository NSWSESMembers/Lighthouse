import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { search } from './talkgroups.js';

vi.mock('./core/request.js', async () => {
  const actual = await vi.importActual('./core/request.js');
  return { ...actual, request: vi.fn() };
});

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset();
});

describe('search', () => {
  it('builds a name-search query and normalises the response', async () => {
    vi.mocked(request).mockResolvedValue({ Results: [{ Id: 1, Name: 'SES OPS 1' }], TotalItems: 1 });
    const result = await search('SES OPS', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toContain('TalkgroupName=SES%20OPS');
    expect(result).toEqual({ results: [{ Id: 1, Name: 'SES OPS 1' }], totalItems: 1 });
  });

  it('tolerates a null body', async () => {
    vi.mocked(request).mockResolvedValue(null);
    const result = await search('x', ctx);
    expect(result).toEqual({ results: [], totalItems: 0 });
  });
});
