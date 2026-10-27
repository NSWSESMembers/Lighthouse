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
import { saveCsv } from '../shared/csv.js';
import { ExportVM } from './viewmodels/ExportVM.js';

// css order reasons... load this last
import '../../../styles/pages/advexport.css';

const params = parsePageParams(window.location.search);
colourScheme();

document.addEventListener('DOMContentLoaded', function () {
  markPage(params.source);

  withKnockout(function (ko) {
    registerLoadRing(ko);

    const vm = new ExportVM({
      params,
      guideUrl: guideUrl('export'),
      client: BeaconClient,
      storage: window.localStorage,
      saveFile: saveCsv,
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
