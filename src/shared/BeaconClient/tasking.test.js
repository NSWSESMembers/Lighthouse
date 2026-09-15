import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './core/request.js';
import { task, updateTeamStatus, callOffTeam, untaskTeam, sequence } from './tasking.js';

vi.mock('./core/request.js', () => ({ request: vi.fn() }));

const ctx = { host: 'https://beacon.test', token: 'tok', userId: 'u1' };

beforeEach(() => {
  vi.mocked(request).mockReset();
  vi.mocked(request).mockResolvedValue({ ok: true });
});

describe('task', () => {
  it('POSTs to /Api/v1/Tasking with team/job ids and nullOnError set', async () => {
    await task('team1', 'job1', ctx);
    expect(request).toHaveBeenCalledWith('https://beacon.test/Api/v1/Tasking', {
      method: 'POST',
      token: 'tok',
      signal: undefined,
      json: { TeamIds: ['team1'], JobIds: ['job1'], LighthouseFunction: 'client.TaskTeam', userId: 'u1' },
      nullOnError: true,
    });
  });

  it('defaults userId to notPassed when omitted', async () => {
    await task('team1', 'job1', { host: ctx.host, token: ctx.token });
    expect(request).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ json: expect.objectContaining({ userId: 'notPassed' }) }),
    );
  });
});

describe('updateTeamStatus', () => {
  it('POSTs to the status sub-path with the given payload', async () => {
    await updateTeamStatus('tasking1', 'OnRoute', { Note: 'x' }, ctx);
    expect(request).toHaveBeenCalledWith('https://beacon.test/Api/v1/Tasking/tasking1/OnRoute', {
      method: 'POST',
      token: 'tok',
      signal: undefined,
      json: { Note: 'x' },
      nullOnError: true,
    });
  });
});

describe('callOffTeam', () => {
  it('PUTs to the Calloff sub-path', async () => {
    await callOffTeam('tasking1', { Reason: 'x' }, ctx);
    expect(request).toHaveBeenCalledWith('https://beacon.test/Api/v1/Tasking/tasking1/Calloff', {
      method: 'PUT',
      token: 'tok',
      signal: undefined,
      json: { Reason: 'x' },
      nullOnError: true,
    });
  });
});

describe('untaskTeam', () => {
  it('DELETEs with a form payload', async () => {
    await untaskTeam('tasking1', { Reason: 'x' }, ctx);
    expect(request).toHaveBeenCalledWith('https://beacon.test/Api/v1/Tasking/tasking1', {
      method: 'DELETE',
      token: 'tok',
      signal: undefined,
      form: { Reason: 'x' },
      nullOnError: true,
    });
  });
});

describe('sequence', () => {
  it('PUTs to /Sequences without nullOnError (rejects on failure)', async () => {
    const body = { Sequences: [{ Id: 1, Order: 0 }] };
    await sequence(body, ctx);
    expect(request).toHaveBeenCalledWith('https://beacon.test/Api/v1/Tasking/Sequences', {
      method: 'PUT',
      token: 'tok',
      signal: undefined,
      json: body,
      responseType: 'none',
    });
  });
});
