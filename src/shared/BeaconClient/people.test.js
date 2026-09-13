import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { getSimplePerson } from './people.js';

vi.mock('./core/request.js', () => ({ request: vi.fn() }));

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset().mockResolvedValue({ Id: 1 });
});

describe('getSimplePerson', () => {
  it('encodes the person id in the URL', async () => {
    await getSimplePerson('person/1', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/People/GetSimplePerson/person%2F1?LighthouseFunction=GetSimplePerson&userId=u1');
  });
});
