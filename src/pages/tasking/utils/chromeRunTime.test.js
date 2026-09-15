// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../components/windowAlert.js', () => ({ showAlert: vi.fn(() => 'alert-1'), closeAlert: vi.fn() }));

import { showAlert } from '../components/windowAlert.js';
import { openURLInBeacon } from './chromeRunTime.js';

function stubChrome(response) {
  global.chrome = { runtime: { sendMessage: vi.fn((_msg, cb) => cb(response)) } };
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('openURLInBeacon', () => {
  it('sends a tasking-openURL message with the url', () => {
    stubChrome({ success: true });
    openURLInBeacon('https://beacon.test/Jobs/1');
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'tasking-openURL', url: 'https://beacon.test/Jobs/1' },
      expect.any(Function),
    );
  });

  it('shows a success alert with the server message when available', () => {
    stubChrome({ success: true, message: 'Opened!' });
    openURLInBeacon('https://beacon.test/Jobs/1');
    expect(showAlert).toHaveBeenCalledWith('Opened!', 'success', 2000);
  });

  it('falls back to a default success message', () => {
    stubChrome({ success: true });
    openURLInBeacon('https://beacon.test/Jobs/1');
    expect(showAlert).toHaveBeenCalledWith('Request https://beacon.test/Jobs/1 opened successfully in Beacon.', 'success', 2000);
  });

  // showAlert's HTML gets escapeHtml()'d, so an apostrophe in the reason text
  // ("can't", "Couldn't") comes back as &#39; rather than a literal quote.
  it.each([
    ['same tab', 'same tab', 'This is the Beacon Remote tab, so it can&#39;t open the page in itself.'],
    ['no remote tab', 'no remote tab', 'Lighthouse has no Beacon Remote tab to open this in. Register Beacon in another tab, then try again.'],
    ['not registered', 'not registered', 'Lighthouse has no Beacon Remote tab to open this in. Register Beacon in another tab, then try again.'],
    ['failed', 'failed to send', 'Your Beacon Remote tab has closed. Register Beacon in another tab, then try again.'],
    ['no tab with id', 'no tab with id 5', 'Your Beacon Remote tab has closed. Register Beacon in another tab, then try again.'],
    ['unrecognised code', 'some other error', 'Couldn&#39;t reach your Beacon Remote tab. Register Beacon in another tab, then try again.'],
  ])('maps error code containing "%s" to the right reason text', (_label, errorCode, expectedReason) => {
    stubChrome({ success: false, error: errorCode });
    openURLInBeacon('https://beacon.test/Jobs/1');
    const [html] = showAlert.mock.calls[0];
    expect(html).toContain(expectedReason);
  });

  it('is case-insensitive when matching the error code', () => {
    stubChrome({ success: false, error: 'SAME TAB' });
    openURLInBeacon('https://beacon.test/Jobs/1');
    const [html] = showAlert.mock.calls[0];
    expect(html).toContain('can&#39;t open the page in itself');
  });

  it('falls back to response.message when response.error is absent', () => {
    stubChrome({ success: false, message: 'no remote tab found' });
    openURLInBeacon('https://beacon.test/Jobs/1');
    const [html] = showAlert.mock.calls[0];
    expect(html).toContain('no Beacon Remote tab');
  });

  it('treats a falsy/undefined response the same as a failure', () => {
    stubChrome(undefined);
    openURLInBeacon('https://beacon.test/Jobs/1');
    expect(showAlert).toHaveBeenCalled();
    const [, type] = showAlert.mock.calls[0];
    expect(type).toBe('warning');
  });

  it('escapes HTML in the target url and shows the alert with no timeout (persistent)', () => {
    stubChrome({ success: false, error: 'boom' });
    openURLInBeacon('https://beacon.test/Jobs/1?x=<script>');
    const [html, type, timeout] = showAlert.mock.calls[0];
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(type).toBe('warning');
    expect(timeout).toBe(0);
  });

  it('includes a link to open the page in a new window', () => {
    stubChrome({ success: false, error: 'boom' });
    openURLInBeacon('https://beacon.test/Jobs/1');
    const [html] = showAlert.mock.calls[0];
    expect(html).toContain('href="https://beacon.test/Jobs/1"');
    expect(html).toContain('target="_blank"');
  });
});
