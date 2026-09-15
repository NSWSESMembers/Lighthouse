import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { getName } from './unit.js';
import { unitBoundary } from './geoservices.js';

vi.mock('./core/request.js', () => ({ request: vi.fn() }));
vi.mock('./unit.js', () => ({ getName: vi.fn() }));

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset();
  vi.mocked(getName).mockReset();
});

describe('unitBoundary', () => {
  it('looks up the unit code first, then requests the boundary', async () => {
    vi.mocked(getName).mockResolvedValue({ Code: 'ABC' });
    vi.mocked(request).mockResolvedValue({ type: 'Polygon' });

    const result = await unitBoundary('unit1', ctx);

    expect(getName).toHaveBeenCalledWith('unit1', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/GeoServices/Unit/ABC/Boundary/?LighthouseFunction=unitBoundary&userId=u1');
    expect(result).toEqual({ type: 'Polygon' });
  });

  it('returns null without calling request when the unit has no Code', async () => {
    vi.mocked(getName).mockResolvedValue(null);
    const result = await unitBoundary('unit1', ctx);
    expect(result).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
});
