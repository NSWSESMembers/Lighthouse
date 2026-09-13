import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { search, children, get } from './entities.js';

vi.mock('./core/request.js', async () => {
  const actual = await vi.importActual('./core/request.js');
  return { ...actual, request: vi.fn() };
});

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset();
});

describe('search', () => {
  it('sends the query unencoded and normalises the response', async () => {
    vi.mocked(request).mockResolvedValue({ Results: [{ Id: 1 }], TotalItems: 1 });
    const result = await search('SES HQ', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toContain('EntityName=SES HQ');
    expect(result).toEqual({ results: [{ Id: 1 }], totalItems: 1 });
  });
});

describe('children', () => {
  it('returns the bare array from Beacon', async () => {
    vi.mocked(request).mockResolvedValue([{ Id: 1 }]);
    const result = await children('parent1', ctx);
    expect(result).toEqual([{ Id: 1 }]);
  });

  it('falls back to an empty array on a null body', async () => {
    vi.mocked(request).mockResolvedValue(null);
    const result = await children('parent1', ctx);
    expect(result).toEqual([]);
  });
});

describe('get', () => {
  it('requests the entity by id', async () => {
    vi.mocked(request).mockResolvedValue({ Id: 5 });
    await get('5', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Entities/5?LighthouseFunction=EntitiesFetch&userId=u1');
  });
});
