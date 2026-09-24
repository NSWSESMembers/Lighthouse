import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { getIncidentImages, getImageData } from './images.js';

vi.mock('./core/request.js', () => ({ request: vi.fn() }));

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset();
});

describe('getIncidentImages', () => {
  it('requests thumbnails for the incident', async () => {
    vi.mocked(request).mockResolvedValue([{ Id: 1 }]);
    await getIncidentImages('incident1', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Image/IncidentThumbnails/incident1?LighthouseFunction=getIncidentThumbnails&userId=u1');
  });
});

describe('getImageData', () => {
  it('requests with responseType blob', async () => {
    vi.mocked(request).mockResolvedValue(new Blob());
    await getImageData('job1', 'image1', ctx);
    const [url, opts] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Image/IncidentImage/job1/image1/?LighthouseFunction=getImageData&userId=u1');
    expect(opts.responseType).toBe('blob');
  });
});
