/*
  Incident Export page (pages/advexport.html).

  Opened from Beacon's Lighthouse menu ("Incident Export") and the Jobs
  screen's "Advanced Export (Filtered)" button. For an HQ, several HQs or
  all of NSW over the range it was opened with: pick the columns
  (remembered for next time), preview the newest incidents (one small
  request on open), and Download CSV fetches every incident and saves them.
*/

import BeaconClient from '../../shared/BeaconClient.js';
const BeaconToken = require('../lib/shared_token_code.js');

import { parsePageParams } from '../shared/params.js';
import { colourScheme, markPage, guideUrl, withKnockout } from '../shared/pageSetup.js';
import { registerLoadRing } from '../shared/loadRing.js';
import { ExportVM } from './viewmodels/ExportVM.js';

// css order reasons... load this last
import '../../../styles/pages/advexport.css';

const params = parsePageParams(window.location.search);
colourScheme();

/** Hands the CSV to the browser as a download. */
function saveFile(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking straight away can cancel the download in Chrome; give it a minute.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

document.addEventListener('DOMContentLoaded', function () {
  markPage(params.source);

  withKnockout(function (ko) {
    registerLoadRing(ko);

    const vm = new ExportVM({
      params,
      guideUrl: guideUrl('export'),
      client: BeaconClient,
      storage: window.localStorage,
      saveFile,
    });
    window.exportVM = vm; // for the advexport-docs harness and the console

    ko.applyBindings(vm);
    document.title = vm.pageTitle();
    vm.pageTitle.subscribe((t) => { document.title = t; });

    setInterval(() => vm.tick(), 1000);
    document.body.style.opacity = '1';

    BeaconToken.fetchBeaconTokenAndKeepReturningValidTokens(
      params.host,
      params.source,
      ({ token }) => vm.setToken(token),
    );
  });
});
