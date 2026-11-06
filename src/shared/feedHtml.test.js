// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { escapeHtml, sanitizeFeedHtml } from './feedHtml.js';

describe('sanitizeFeedHtml', () => {
  it('keeps simple formatting from council reports', () => {
    expect(
      sanitizeFeedHtml('<p><strong>The road is closed. </strong></p><p>Storms &amp; floods caused slips.</p><p></p>'),
    ).toBe('<p><strong>The road is closed. </strong></p><p>Storms &amp; floods caused slips.</p>');
  });

  it('passes plain text through escaped', () => {
    expect(sanitizeFeedHtml('One lane closed eastbound.')).toBe('One lane closed eastbound.');
    expect(sanitizeFeedHtml('a < b & c')).toBe('a &lt; b &amp; c');
    expect(sanitizeFeedHtml(null)).toBe('');
  });

  it('drops scripts, attributes and unknown tags', () => {
    expect(sanitizeFeedHtml('<p onclick="x()" style="color:red">Hi<script>alert(1)</script></p>')).toBe('<p>Hi</p>');
    expect(sanitizeFeedHtml('<img src=x onerror=alert(1)><div><span>Text</span></div>')).toBe('Text');
  });

  it('keeps only http(s) links, opening in a new tab', () => {
    expect(sanitizeFeedHtml('<a href="https://example.org/x?a=1&b=2">Detour</a>')).toBe(
      '<a href="https://example.org/x?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">Detour</a>',
    );
    expect(sanitizeFeedHtml('<a href="javascript:alert(1)">Bad</a>')).toBe('Bad');
  });
});

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<b class="x">'&'</b>`)).toBe('&lt;b class=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;');
  });
});
