/*
  NITC Export page (pages/nitcexport.html).

  Opened from the "Export (Filtered)" button on Beacon's NITC (Non-Incident
  Task Card) screen, with that screen's HQ, type, tag, completed and date
  filters. Pick the report (Activity List or Member List, remembered for
  next time), preview it from the newest tasks (one small request on open),
  and Download CSV fetches every task and saves the report.
*/

import BeaconClient from '../../shared/BeaconClient.js';
const BeaconToken = require('../lib/shared_token_code.js');

import { parsePageParams } from '../shared/params.js';
import { colourScheme, markPage, guideUrl, withKnockout } from '../shared/pageSetup.js';
import { registerLoadRing } from '../shared/loadRing.js';
import { saveCsv } from '../shared/csv.js';
import { nitcFilters } from './data/filters.js';
import { NitcExportVM } from './viewmodels/NitcExportVM.js';

// css order reasons... load this last
import '../../../styles/pages/nitcexport.css';

const params = parsePageParams(window.location.search);
colourScheme();

document.addEventListener('DOMContentLoaded', function () {
  markPage(params.source);

  withKnockout(function (ko) {
    registerLoadRing(ko);

    const vm = new NitcExportVM({
      params,
      filters: nitcFilters(window.location.search, params.hqIds),
      guideUrl: guideUrl('nitc'),
      client: BeaconClient,
      storage: window.localStorage,
      saveFile: saveCsv,
    });
    window.nitcExportVM = vm; // for the nitcexport-docs harness and the console

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
