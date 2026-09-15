import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { search } from './users.js';

vi.mock('./core/request.js', async () => {
  const actual = await vi.importActual('./core/request.js');
  return { ...actual, request: vi.fn() };
});

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset().mockResolvedValue({ Results: [], TotalItems: 0 });
});

describe('search', () => {
  it('splits a multi-word query into FirstName/LastName', async () => {
    await search('Jane Mary Doe', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toContain('FirstName=Jane%20Mary');
    expect(url).toContain('LastName=Doe');
    expect(url).not.toContain('Username=');
  });

  it('sends a single-word query against all four fields', async () => {
    await search('jdoe', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toContain('FirstName=jdoe');
    expect(url).toContain('LastName=jdoe');
    expect(url).toContain('Username=jdoe');
    expect(url).toContain('Email=jdoe');
  });

  it('trims and collapses whitespace before deciding word count', async () => {
    await search('  jdoe  ', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toContain('FirstName=jdoe');
    expect(url).toContain('Username=jdoe');
  });

  it('treats an empty query as a single (empty) word search', async () => {
    await search('', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toContain('FirstName=&LastName=&Username=&Email=');
  });
});
