import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { search } from './events.js';

vi.mock('./core/request.js', async () => {
  const actual = await vi.importActual('./core/request.js');
  return { ...actual, request: vi.fn() };
});

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset().mockResolvedValue({ Results: [], TotalItems: 0 });
});

describe('search', () => {
  it('sends the same query against EventName and Identifier', async () => {
    await search('6/1718', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toContain('EventName=6%2F1718');
    expect(url).toContain('Identifier=6%2F1718');
    expect(url).toContain('ViewModelType=2&PageSize=10');
  });
});
