/*
  CADence Simulated Exercise page (pages/simulatedexercise.html).

  Opened from Beacon's Lighthouse menu, under Community Projects, on Train
  Beacon and Test Beacon. Lists the CADence training exercises running there
  and chooses the one that LAD, the Nearest Asset Locations map on a job and
  the situational awareness map show in place of real radio positions. See
  viewmodels/SimulatedExercisePageVM.js and shared/cadenceSimulationShare.js.
*/

const BeaconToken = require('../lib/shared_token_code.js');

import { parsePageParams } from '../shared/params.js';
import { colourScheme, markPage, isDevBuild, withKnockout } from '../shared/pageSetup.js';
import { SimulatedExercisePageVM } from './viewmodels/SimulatedExercisePageVM.js';

// css order reasons... load this last
import '../../../styles/pages/simulatedexercise.css';

const params = parsePageParams(window.location.search);
colourScheme();

// The guide is a page of the LAD guide, as that's where the exercise shows.
const GUIDE_URL = `https://lighthouse.ses.nsw.gov.au/${isDevBuild() ? 'preview/' : ''}guides/lad/simulated-exercises.html`;

document.addEventListener('DOMContentLoaded', function () {
  markPage(params.source);

  withKnockout(function (ko) {
    const vm = new SimulatedExercisePageVM({
      host: params.host,
      hqId: params.hqIds[0],
      guideUrl: GUIDE_URL,
      // After a refusal: the stored Beacon token, renewed if it's about to
      // expire (a newer one also reaches setToken below).
      refreshToken: () => BeaconToken.freshBeaconToken(params.host, params.source),
    });
    window.simulatedExercisePageVM = vm; // for browser tests and the console

    ko.applyBindings(vm);
    document.title = vm.pageTitle;
    document.body.style.opacity = '1';

    // Off Train and Test Beacon the page only explains itself: no token is
    // read and the CADence backend is never contacted.
    if (!vm.available) return;

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) vm.pageShown();
    });
    BeaconToken.fetchBeaconTokenAndKeepReturningValidTokens(params.host, params.source, ({ token }) =>
      vm.setToken(token),
    );
  });
});
