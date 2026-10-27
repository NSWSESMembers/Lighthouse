/*
  Incident Summary page (pages/summary.html).

  Opened from Beacon's Lighthouse menu ("Incident Summary") and the Jobs
  screen's "Summary (Filtered)" button. Shows Beacon's Jobs Summary report
  (incident counts by status and type) for an HQ, several HQs or all of NSW
  over a date range, in big numbers for a screen on the wall; refreshes
  every 30 seconds and can chime when new incidents come in.
*/

import BeaconClient from '../../shared/BeaconClient.js';
const BeaconToken = require('../lib/shared_token_code.js');
import { Modal } from 'bootstrap5';

import { parsePageParams } from '../shared/params.js';
import { colourScheme, markPage, guideUrl, withKnockout } from '../shared/pageSetup.js';
import { registerLoadRing } from '../shared/loadRing.js';
import { SummaryVM } from './viewmodels/SummaryVM.js';

// css order reasons... load this last
import '../../../styles/pages/summary.css';

const params = parsePageParams(window.location.search);
const setColourScheme = colourScheme();

document.addEventListener('DOMContentLoaded', function () {
    markPage(params.source);

    withKnockout(function (ko) {
        registerLoadRing(ko);

        const sound = new Audio();
        const settings = new Modal(document.getElementById('settings-modal'));
        const vm = new SummaryVM({
            params,
            guideUrl: guideUrl('summary'),
            client: BeaconClient,
            storage: window.localStorage,
            applyTheme: setColourScheme,
            openSettings: () => settings.show(),
            playSound: (file) => {
                sound.src = file;
                // Chrome blocks sound until the page has been clicked once.
                sound.play().catch((err) => console.warn('Incident Summary: could not play the alert sound', err));
            },
        });
        window.summaryVM = vm; // for the summary-docs harness and the console

        ko.applyBindings(vm);
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
