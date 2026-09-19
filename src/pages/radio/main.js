require('../lib/shared_chrome_code.js'); // side-effect: chrome.manifest
var BeaconToken = require('../lib/shared_token_code.js');
import '../../../styles/pages/radio.css';
import * as bootstrap from 'bootstrap5'; // side-effect: wires up data-bs-toggle/data-bs-target/data-bs-dismiss (the settings modal)

import { createRadioConsoleViewModel } from './viewmodels/RadioConsoleViewModel.js';
import { startBeaconSignalRConnection, stopBeaconSignalRConnection } from '../tasking/signalr/connection.js';
import { registerAcronymTextBinding } from '../tasking/components/acronymText.js';
import { installModalHotkeys } from '../tasking/components/modalHotKeys.js';

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

// Same environment colour-coding as tasking.html (orange=prod, green=train,
// blue=dev) -- see styles/pages/tasking.css's `body .modal-header` rules.
if (params.source === 'https://trainbeacon.ses.nsw.gov.au') {
  document.body.classList.add('env-trainbeacon');
} else if (params.source === 'https://devbeacon.ses.nsw.gov.au') {
  document.body.classList.add('env-devbeacon');
}
var token = null;
var tokenReady = new Promise(function (resolve) {
  window.__radioResolveToken = resolve;
});

function getToken() {
  if (token) return Promise.resolve(token);
  return tokenReady;
}

// Applied synchronously, before the Knockout bundle/view model exist, so
// there's no flash of the wrong theme while they load. RadioConsoleViewModel.js
// re-reads the same localStorage key once it boots (see readStoredThemeMode())
// so Settings' light/dark/system radio group shows the truth from then on.
function applyDarkModePreference() {
  var stored = null;
  try {
    stored = window.localStorage.getItem('lighthouseRadioConsoleTheme');
  } catch (err) {
    // localStorage unavailable (private browsing etc.) -- fall back to system preference only
  }
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var dark = stored === 'dark' || (stored !== 'light' && prefersDark);
  document.body.classList.toggle('dark-mode', dark);
}

document.addEventListener('DOMContentLoaded', function () {
  applyDarkModePreference();

  // The default Knockout binding provider parses data-bind strings with
  // `new Function`, which MV3's CSP (script-src 'self', no unsafe-eval)
  // blocks. knockout-secure-binding parses the same syntax without eval --
  // same setup as teamsummary.js/tasking's main.js.
  require(['knockout', 'knockout-secure-binding'], function (komod, ksb) {
    var ko = komod;

    registerAcronymTextBinding(); // same acronym dictionary/tooltips as the job screen -- see acronymText.js

    var options = {
      attribute: 'data-bind',
      globals: window,
      bindings: ko.bindingHandlers,
      noVirtualElements: false,
    };
    ko.bindingProvider.instance = new ksb(options);
    window.ko = ko;

    var viewModel = createRadioConsoleViewModel({
      host: params.host,
      source: params.source,
      userId: params.userId,
      personId: params.personId,
      signalrExpected: !!params.signalr,
      hq: params.hq,
      getToken: getToken,
      ko: ko,
    });

    ko.applyBindings(viewModel);
    window.__radioConsoleViewModel = viewModel; // for manual/browser-driven verification

    viewModel.init();

    window.addEventListener('beforeunload', viewModel.beforeUnloadGuard);

    var settingsModalEl = document.getElementById('radioSettingsModal');
    var settingsModal = settingsModalEl ? new bootstrap.Modal(settingsModalEl) : null;
    document.getElementById('radioSettingsButton')?.addEventListener('click', function () {
      settingsModal?.show();
    });
    // Same Ctrl/Cmd+Enter-to-save, Esc-to-close convention as every other
    // modal in the app (tasking/main.js) -- Settings' "save" is its Apply
    // button (applyFilters), same as clicking it.
    installModalHotkeys({
      modalEl: settingsModalEl,
      onSave: () => viewModel.applyFilters?.(),
      onClose: () => settingsModal?.hide(),
      allowInInputs: true,
    });

    // The Resolve button itself opens the modal declaratively (data-bs-toggle/
    // data-bs-target -- see the "wires up" comment above), so there's no
    // matching addEventListener here. What the view model needs is a
    // reference to *close* it once confirmResolve() actually succeeds --
    // same modalInstance convention as RadioLogModalVM.js's own.
    var resolveModalEl = document.getElementById('radioResolveModal');
    viewModel.resolveModalInstance = resolveModalEl ? new bootstrap.Modal(resolveModalEl) : null;
    // Same Ctrl/Cmd+Enter-to-save, Esc-to-close convention as every other
    // modal in the app (tasking/main.js) -- allowInInputs since this is a
    // text-heavy modal (the Resolution textarea).
    installModalHotkeys({
      modalEl: resolveModalEl,
      onSave: () => viewModel.confirmResolve?.(),
      onClose: () => viewModel.resolveModalInstance?.hide(),
      allowInInputs: true,
    });
    // Opened declaratively from several Resolve buttons (data-bs-toggle),
    // not a single JS .show() call to hang a one-off focus() off of -- so
    // this listens for every open instead, same as tasking/main.js's own
    // RadioLogModalVM focus-on-shown (just not { once: true }, since this
    // modal reopens many times across a session).
    resolveModalEl?.addEventListener('shown.bs.modal', function () {
      document.getElementById('radioResolveTextInput')?.focus();
    });

    window.addEventListener('unload', function () {
      viewModel.stopLiveUpdates();
      stopBeaconSignalRConnection();
    });

    document.body.style.opacity = 1;
    document.getElementById('radioCallsignInput')?.focus();
  });

  if (chrome.manifest.name.includes('Development')) {
    document.body.classList.add('watermark');
  }
});

BeaconToken.fetchBeaconTokenAndKeepReturningValidTokens(params.host, params.source, function (result) {
  token = result.token;
  if (window.__radioResolveToken) {
    window.__radioResolveToken(token);
    window.__radioResolveToken = null;
  }
  if (params.signalr) {
    window.__radioSignalRConnection = startBeaconSignalRConnection(params.signalr, function () {
      return token;
    });
  }
});
