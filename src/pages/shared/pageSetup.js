/*
  Start-up shared by the Bootstrap 5 / knockout-secure-binding pages Beacon
  opens in a new tab (Incident Statistics, Incident Summary, Incident Export, NITC Export): colour mode,
  Beacon colour, Development watermark, guide link and KO set-up.

  Extension pages only (uses chrome.runtime and the DOM).
*/

import { beaconEnvironment } from './params.js';

/** True in the Lighthouse Development Preview build. */
export function isDevBuild() {
  return (chrome.runtime.getManifest().name || '').includes('Development');
}

/**
 * The page's guide on the website. Development Preview builds open the
 * preview copy (synced from master-dev), as LAD's "User guide" link does.
 *
 * @param {string} slug  the guide's folder under /guides/ ("stats", "summary")
 */
export function guideUrl(slug) {
  return `https://lighthouse.ses.nsw.gov.au/${isDevBuild() ? 'preview/' : ''}guides/${slug}/`;
}

/**
 * Bootstrap 5.3 colour mode on <html>. `mode` 'auto' follows the OS
 * setting (and keeps following it); 'light' / 'dark' pin it.
 *
 * @param {'auto'|'light'|'dark'} [mode='auto']
 * @returns {(mode: 'auto'|'light'|'dark') => void}  call again to change the mode
 */
export function colourScheme(mode = 'auto') {
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let current = mode;
  const apply = () => {
    const dark = current === 'dark' || (current === 'auto' && darkQuery.matches);
    document.documentElement.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
  };
  apply();
  darkQuery.addEventListener('change', apply);
  return (next) => {
    current = next;
    apply();
  };
}

/**
 * Body classes the shared page CSS keys off: `env-trainbeacon` /
 * `env-devbeacon` for the header colour (as in LAD), `watermark` in a
 * Development build. Call once the body exists.
 *
 * @param {string} source  the Beacon origin (the `source` param)
 */
export function markPage(source) {
  if (isDevBuild()) document.body.classList.add('watermark');
  const env = beaconEnvironment(source);
  if (env !== 'production') document.body.classList.add('env-' + env);
}

/**
 * Loads knockout with the secure binding provider (no eval: extension CSP),
 * deferred updates on, as on the tasking page.
 *
 * @param {(ko: object) => void} cb
 */
export function withKnockout(cb) {
  require(['knockout', 'knockout-secure-binding'], function (ko, ksb) {
    ko.bindingProvider.instance = new ksb({
      attribute: 'data-bind',
      globals: window,
      bindings: ko.bindingHandlers,
      noVirtualElements: false,
    });
    window.ko = ko;
    ko.options.deferUpdates = true;
    cb(ko);
  });
}
