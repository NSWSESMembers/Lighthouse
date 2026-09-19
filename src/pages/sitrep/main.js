require('../lib/shared_chrome_code.js'); // side-effect: chrome.manifest
var BeaconToken = require('../lib/shared_token_code.js');
import '../../../styles/pages/sitrep.css';

import { registerAutoGrow } from './lib/autoGrowBinding.js';
import { createSitrepViewModel } from './viewmodels/SitrepViewModel.js';

function getSearchParameters() {
  var prmstr = window.location.search.substr(1);
  var params = {};
  if (!prmstr) return params;
  prmstr.split('&').forEach(function (pair) {
    var kv = pair.split('=');
    params[kv[0]] = decodeURIComponent(kv[1] || '');
  });
  return params;
}

var params = getSearchParameters();
var token = null;
var tokenReady = new Promise(function (resolve) {
  window.__sitrepResolveToken = resolve;
});

function getToken() {
  if (token) return Promise.resolve(token);
  return tokenReady;
}

document.addEventListener('DOMContentLoaded', function () {
  // Same environment colour-coding as LAD/the radio console (orange=prod,
  // green=train, blue=dev), and light/dark following the system setting.
  if (params.source === 'https://trainbeacon.ses.nsw.gov.au') {
    document.body.classList.add('env-trainbeacon');
  } else if (params.source === 'https://devbeacon.ses.nsw.gov.au') {
    document.body.classList.add('env-devbeacon');
  }
  var darkQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (darkQuery) {
    document.body.classList.toggle('dark-mode', darkQuery.matches);
    if (darkQuery.addEventListener) {
      darkQuery.addEventListener('change', function (e) {
        document.body.classList.toggle('dark-mode', e.matches);
      });
    }
  }

  // The default Knockout binding provider parses data-bind strings with
  // `new Function`, which MV3's CSP (script-src 'self', no unsafe-eval)
  // blocks. knockout-secure-binding parses the same syntax without eval --
  // same setup as teamsummary.js/tasking's main.js.
  require(['knockout', 'knockout-secure-binding'], function (komod, ksb) {
    var ko = komod;

    var options = {
      attribute: 'data-bind',
      globals: window,
      bindings: ko.bindingHandlers,
      noVirtualElements: false,
    };
    ko.bindingProvider.instance = new ksb(options);
    registerAutoGrow(ko);
    window.ko = ko;

    var viewModel = createSitrepViewModel({
      host: params.host,
      source: params.source,
      userId: params.userId,
      personId: params.personId,
      getToken: getToken,
      ko: ko,
    });

    // Pre-fill from the HQ Lighthouse was launched with (current unit) and the
    // day's default start/end, matching how other Lighthouse report pages
    // (teamsummary.js, summary.js) treat their `hq`/`start`/`end` params --
    // the operator can still adjust the scope and window before generating.
    if (params.start) viewModel.startInput(toDateTimeLocal(params.start));
    if (params.end) viewModel.endInput(toDateTimeLocal(params.end));

    ko.applyBindings(viewModel);
    window.__sitrepViewModel = viewModel; // for manual/browser-driven verification

    if (params.hq) {
      viewModel.addUnitById(params.hq);
    }

    document.body.style.opacity = 1;
  });

  if (chrome.manifest.name.includes('Development')) {
    document.body.classList.add('watermark');
  }
});

// A UTC ISO instant (e.g. from an injectscript's default `start`/`end`) shown
// back to the operator as a Sydney-local <input type="datetime-local"> value
// ("YYYY-MM-DDTHH:mm"). Approximate only (uses the browser's own timezone
// conversion for the *initial* prefill) -- what actually gets sent to Beacon
// always goes back through sydneyTime.js's explicit conversion once the
// operator generates the report, so an inaccurate prefill here can only ever
// affect the default shown, never the report's correctness.
function toDateTimeLocal(isoString) {
  var date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  var sydneyParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .reduce(function (acc, part) {
      acc[part.type] = part.value;
      return acc;
    }, {});
  return sydneyParts.year + '-' + sydneyParts.month + '-' + sydneyParts.day + 'T' + sydneyParts.hour + ':' + sydneyParts.minute;
}

BeaconToken.fetchBeaconTokenAndKeepReturningValidTokens(params.host, params.source, function (result) {
  token = result.token;
  if (window.__sitrepResolveToken) {
    window.__sitrepResolveToken(token);
    window.__sitrepResolveToken = null;
  }
});
