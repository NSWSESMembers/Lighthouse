import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { search, searchAll } from './contacts.js';

vi.mock('./core/request.js', async () => {
  const actual = await vi.importActual('./core/request.js');
  return { ...actual, request: vi.fn() };
});

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset().mockResolvedValue({ Results: [], TotalItems: 0 });
});

describe('search', () => {
  it('requests contacts for the given person id', async () => {
    await search('person1', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toContain('PersonIds%5B0%5D=person1');
  });
});

describe('searchAll', () => {
  it('encodes the free-text query and requests contact groups + internal/external recipients', async () => {
    await searchAll('jane doe', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toContain('SearchTerm=jane%20doe');
    expect(url).toContain('RecipientTypes%5B0%5D=Contact%20Group');
    expect(url).toContain('RecipientTypes%5B1%5D=Internal');
    expect(url).toContain('RecipientTypes%5B2%5D=External');
  });
});
