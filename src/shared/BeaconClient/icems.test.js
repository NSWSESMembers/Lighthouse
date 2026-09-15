import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { getMessageById, getIncident, acknowledgeIum } from './icems.js';

vi.mock('./core/request.js', async () => {
  const actual = await vi.importActual('./core/request.js');
  return { ...actual, request: vi.fn() };
});

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset().mockResolvedValue({ ok: true });
});

describe('getMessageById', () => {
  it('requests the Icems message by id', async () => {
    await getMessageById('msg1', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Icems/messages/msg1?LighthouseFunction=GetMessageById&userId=u1');
  });
});

describe('getIncident', () => {
  it('encodes the incident identifier', async () => {
    await getIncident('6/1718', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Icems/incidents/6%2F1718?LighthouseFunction=GetIcemsIncident&userId=u1');
  });
});

describe('acknowledgeIum', () => {
  it('POSTs the payload as a form-encoded body', async () => {
    await acknowledgeIum('msg1', { Ack: true }, ctx);
    const [url, opts] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Icems/messages/msg1/acknowledgeIum?LighthouseFunction=AcknowledgeIum&userId=u1');
    expect(opts).toMatchObject({ method: 'POST', form: 'Ack=true' });
  });
});
