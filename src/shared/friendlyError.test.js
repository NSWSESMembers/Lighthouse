import { describe, it, expect } from 'vitest';
import { friendlyReason } from './friendlyError.js';

describe('friendlyReason', () => {
  it('explains sign-in and permission problems', () => {
    expect(friendlyReason({ status: 401 })).toMatch(/sign in/i);
    expect(friendlyReason({ status: 403 })).toMatch(/permissions/i);
  });

  it('separates a busy Beacon, a broken Beacon and a rejected request', () => {
    expect(friendlyReason({ status: 429 })).toMatch(/busy/i);
    expect(friendlyReason({ status: 503 })).toMatch(/problems/i);
    expect(friendlyReason({ status: 400 })).toMatch(/check what you entered/i);
    expect(friendlyReason({ status: 404 })).toMatch(/couldn't find/i);
  });

  it('describes network failures and timeouts without the browser wording', () => {
    expect(friendlyReason(new TypeError('Failed to fetch'))).toMatch(/network connection/i);
    const abort = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    expect(friendlyReason(abort)).toMatch(/too long/i);
  });

  it('never shows status codes, urls or raw messages', () => {
    const text = friendlyReason({ status: 500, message: 'Beacon API 500 (https://x/y)' });
    expect(text).not.toMatch(/500|https/);
    expect(friendlyReason(new Error('boom'))).not.toMatch(/boom/);
  });
});
