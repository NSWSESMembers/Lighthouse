import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { send, getMessageById } from './messages.js';

vi.mock('./core/request.js', async () => {
  const actual = await vi.importActual('./core/request.js');
  return { ...actual, request: vi.fn() };
});

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset().mockResolvedValue(null);
});

describe('send', () => {
  it('serialises an individual contact into Recipients[i] fields', async () => {
    const recipients = [{ Detail: '0400000000', FirstName: 'Jane', LastName: 'Doe', Id: 1, ContactTypeId: 1 }];
    await send(recipients, 'job1', 'hello', true, ctx);
    const [, opts] = vi.mocked(request).mock.calls[0];
    expect(opts.form).toContain('Recipients%5B0%5D%5BRecipient%5D=0400000000');
    expect(opts.form).toContain('Recipients%5B0%5D%5BDescription%5D=Jane%20Doe');
    expect(opts.form).toContain('Recipients%5B0%5D%5BContactId%5D=1');
    expect(opts.form).not.toContain('ContactGroups');
  });

  it('falls back to Description when no FirstName is present', async () => {
    const recipients = [{ Detail: 'x@y.com', Description: 'Some Group Member', Id: 2, ContactTypeId: 1 }];
    await send(recipients, 'job1', 'hello', false, ctx);
    const [, opts] = vi.mocked(request).mock.calls[0];
    expect(opts.form).toContain('Recipients%5B0%5D%5BDescription%5D=Some%20Group%20Member');
  });

  it('routes ContactTypeId 0 recipients to ContactGroups instead of Recipients', async () => {
    const recipients = [
      { Detail: '0400000000', FirstName: 'Jane', LastName: 'Doe', Id: 1, ContactTypeId: 1 },
      { Id: 99, ContactTypeId: 0 },
    ];
    await send(recipients, 'job1', 'hello', true, ctx);
    const [, opts] = vi.mocked(request).mock.calls[0];
    expect(opts.form).toContain('ContactGroups%5B0%5D=99');
    // the group must not also appear as Recipients[0] (index 0 is the individual contact)
    expect(opts.form).not.toContain('Recipients%5B0%5D%5BContactId%5D=99');
  });

  it('sets nullOnError and posts to /Api/v1/Messages', async () => {
    await send([], 'job1', 'hello', true, ctx);
    const [url, opts] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Messages?LighthouseFunction=SendJobMessage&userId=u1');
    expect(opts).toMatchObject({ method: 'POST', nullOnError: true });
  });
});

describe('getMessageById', () => {
  it('requests the message by id', async () => {
    await getMessageById('msg1', ctx);
    const [url] = vi.mocked(request).mock.calls[0];
    expect(url).toBe('https://beacon.test/Api/v1/Messages/msg1?LighthouseFunction=GetMessageById&userId=u1');
  });
});
