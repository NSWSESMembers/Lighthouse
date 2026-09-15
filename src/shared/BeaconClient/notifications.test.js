import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { unaccepted, acknowledge } from './notifications.js';

vi.mock('./core/request.js', () => ({ request: vi.fn() }));

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset();
});

describe('unaccepted', () => {
  it('returns the bare array from Beacon', async () => {
    vi.mocked(request).mockResolvedValue([{ Id: 1 }]);
    const result = await unaccepted('job1', ctx);
    expect(result).toEqual([{ Id: 1 }]);
  });

  it('falls back to an empty array on a null body', async () => {
    vi.mocked(request).mockResolvedValue(null);
    const result = await unaccepted('job1', ctx);
    expect(result).toEqual([]);
  });
});

describe('acknowledge', () => {
  it('POSTs to the acknowledge endpoint', async () => {
    vi.mocked(request).mockResolvedValue({ ok: true });
    await acknowledge('notif1', ctx);
    const [url, opts] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Notifications/notif1/acknowledge?LighthouseFunction=AcknowledgeNotification&userId=u1');
    expect(opts.method).toBe('POST');
  });
});
