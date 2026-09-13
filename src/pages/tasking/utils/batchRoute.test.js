import { describe, it, expect, vi, beforeEach } from 'vitest';
import { batchRoute } from './batchRoute.js';

function jsonResponse(body, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

function alsRoute({ distance = 1000, duration = 120, legs } = {}) {
  return {
    Routes: [
      {
        Summary: { Overview: { Distance: distance, Duration: duration } },
        Legs: legs,
      },
    ],
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('batchRoute', () => {
  const pairs = [{ fromLat: -33.8, fromLng: 151.2, toLat: -33.9, toLng: 151.3 }];

  it('sends coordinates as [lng, lat] pairs and returns a parsed summary', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(alsRoute({ distance: 1234.6, duration: 89.4 })));
    const [summary] = await batchRoute(pairs);

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://lambda.lighthouse-extension.com/lad_v2/route');
    const body = JSON.parse(opts.body);
    expect(body.coordinates).toEqual([[151.2, -33.8], [151.3, -33.9]]);
    expect(body.travelMode).toBe('Car');

    expect(summary.distanceMeters).toBe(1235); // rounded
    expect(summary.travelTimeSeconds).toBe(89);
  });

  it('resolves that entry to null (not a rejection) on a non-2xx response', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, false));
    const [summary] = await batchRoute(pairs);
    expect(summary).toBeNull();
  });

  it('resolves that entry to null when fetch itself rejects', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(batchRoute(pairs)).resolves.toEqual([null]);
  });

  it('runs every pair in parallel and keeps results aligned by index', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(alsRoute({ distance: 100, duration: 10 })))
      .mockResolvedValueOnce(jsonResponse({}, false))
      .mockResolvedValueOnce(jsonResponse(alsRoute({ distance: 300, duration: 30 })));

    const threePairs = [pairs[0], pairs[0], pairs[0]];
    const results = await batchRoute(threePairs);
    expect(results[0].distanceMeters).toBe(100);
    expect(results[1]).toBeNull();
    expect(results[2].distanceMeters).toBe(300);
  });

  it('includes an Authorization header when getToken is given', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(alsRoute()));
    await batchRoute(pairs, { getToken: async () => 'tok123' });
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer tok123');
  });

  it('omits the Authorization header when there is no getToken', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(alsRoute()));
    await batchRoute(pairs);
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBeUndefined();
  });

  it('passes a custom travelMode through', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(alsRoute()));
    await batchRoute(pairs, { travelMode: 'Walking' });
    const [, opts] = global.fetch.mock.calls[0];
    expect(JSON.parse(opts.body).travelMode).toBe('Walking');
  });

  it('extracts and flips leg geometry from [lng,lat] to [lat,lng], deduping the shared join point', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(alsRoute({
      legs: [
        { Geometry: { LineString: [[151.2, -33.8], [151.25, -33.85]] } },
        { Geometry: { LineString: [[151.25, -33.85], [151.3, -33.9]] } }, // shares the join point with leg 1
      ],
    })));
    const [summary] = await batchRoute(pairs);
    expect(summary.geometry).toEqual([
      [-33.8, 151.2],
      [-33.85, 151.25],
      [-33.9, 151.3],
    ]);
  });

  it('returns null geometry when there are fewer than 2 coordinates', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(alsRoute({ legs: [] })));
    const [summary] = await batchRoute(pairs);
    expect(summary.geometry).toBeNull();
  });

  it('resolves to null when neither Distance nor Duration is present', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ Routes: [{ Summary: { Overview: {} } }] }));
    const [summary] = await batchRoute(pairs);
    expect(summary).toBeNull();
  });

  it('resolves to null for an empty Routes array', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ Routes: [] }));
    const [summary] = await batchRoute(pairs);
    expect(summary).toBeNull();
  });
});
