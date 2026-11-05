/*
  The first-load ring shared by Incident Statistics and Incident Summary:
  an SVG ring with a number in the middle, a title, an optional row of page
  dots (or a bar for many pages), a line of detail, and a "Beacon is slow"
  note with a way out.

  Each page works out what the ring shows (a "view", the object
  waitingRing() returns) and passes it to the `load-ring` component:

    <div data-bind="component: { name: 'load-ring', params: { view: loader, label: 'Loading incidents', shorter: loadShorterRange } }"></div>

  Styles: styles/pages/include/lighthouse-page.css.
*/

export const SLOW_AFTER_MS = 10000;
export const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // r=52 in the 120x120 viewBox

/**
 * Font size for the ring's centre number, so it fits inside the ring
 * (inner width ~90 of the 120 viewBox) at any count: "311" to "120,316".
 */
export function centreValueSize(text) {
  const n = String(text).length;
  if (n <= 3) return '30px';
  if (n <= 5) return '24px';
  if (n <= 6) return '20px';
  return '17px';
}

/**
 * The ring before Beacon has answered: spinning, with how long it has
 * waited, and the slow note after SLOW_AFTER_MS.
 *
 * @param {object} s
 * @param {number} s.startedAt  ms timestamps
 * @param {number} s.now
 * @param {string} s.title      e.g. "Asking Beacon for incidents…"
 * @param {string} [s.slowTitle='Still waiting for Beacon']
 */
export function waitingRing({ startedAt, now, title, slowTitle = 'Still waiting for Beacon' }) {
  const waited = Math.max(0, now - startedAt);
  const slow = waited >= SLOW_AFTER_MS;
  return {
    indeterminate: true,
    ringOffset: RING_CIRCUMFERENCE * 0.75,
    centreValue: '',
    centreValueSize: '30px',
    centreLabel: '',
    centreLabel2: '',
    title: slow ? slowTitle : title,
    meta: `waiting ${Math.floor(waited / 1000)} s`,
    slow,
    pageDots: [],
    showPageBar: false,
    pageBarPct: 0,
    pageBarStyle: { width: '0%' },
    ariaNow: 0,
    ariaMax: 100,
  };
}

const TEMPLATE = `
<!-- ko with: view -->
<div class="loader" role="progressbar" aria-valuemin="0"
    data-bind="attr: { 'aria-label': $parent.label, 'aria-valuenow': ariaNow, 'aria-valuemax': ariaMax, 'aria-valuetext': title }">
    <svg class="loader-ring" viewBox="0 0 120 120" aria-hidden="true" data-bind="css: { spinning: indeterminate }">
        <circle class="loader-track" cx="60" cy="60" r="52"></circle>
        <circle class="loader-fill" cx="60" cy="60" r="52" transform="rotate(-90 60 60)"
            data-bind="attr: { 'stroke-dasharray': $parent.circumference, 'stroke-dashoffset': ringOffset }"></circle>
        <text class="loader-value" x="60" y="58" text-anchor="middle" data-bind="text: centreValue, style: { fontSize: centreValueSize }"></text>
        <text class="loader-label" x="60" y="74" text-anchor="middle" data-bind="text: centreLabel"></text>
        <text class="loader-label" x="60" y="86" text-anchor="middle" data-bind="text: centreLabel2"></text>
    </svg>
    <div class="loader-text" aria-live="polite">
        <div class="loader-title" data-bind="text: title"></div>
        <!-- ko if: pageDots.length -->
        <div class="loader-pages" data-bind="foreach: pageDots">
            <span class="loader-page" data-bind="css: { done: done }"></span>
        </div>
        <!-- /ko -->
        <!-- ko if: showPageBar -->
        <div class="loader-pagebar"><div data-bind="style: pageBarStyle"></div></div>
        <!-- /ko -->
        <div class="loader-meta" data-bind="text: meta"></div>
        <!-- ko if: slow -->
        <p class="loader-slow">Beacon is slower than usual. You can keep waiting, or load a shorter time range.</p>
        <!-- ko if: $parent.shorter -->
        <button type="button" class="btn btn-sm btn-outline-secondary" data-bind="click: $parent.shorter">Load the last 24 h instead</button>
        <!-- /ko -->
        <!-- /ko -->
    </div>
</div>
<!-- /ko -->`;

/**
 * Registers the `load-ring` component.
 *
 * Params: `view` (observable or computed of a waitingRing()-shaped object,
pageBarStyle included),
 * `label` (the progressbar's aria-label), `shorter` (optional: click
 * handler for "Load the last 24 h instead").
 */
export function registerLoadRing(ko) {
  if (ko.components.isRegistered('load-ring')) return;
  ko.components.register('load-ring', {
    viewModel: function (params) {
      this.view = params.view;
      this.label = params.label || 'Loading';
      this.shorter = params.shorter || null;
      this.circumference = RING_CIRCUMFERENCE.toFixed(2);
    },
    template: TEMPLATE,
  });
}
