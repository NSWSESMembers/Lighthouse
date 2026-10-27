/*
  Incident Statistics page (pages/stats.html).

  Opened from Beacon's Lighthouse menu ("Incident Statistics") and the Jobs
  screen's "Statistics (Filtered)" button. Loads the incidents (Beacon's
  "jobs") for an HQ, several HQs or all of NSW over a date range and
  cross-filters them in dc.js charts; refreshes every few minutes.
*/

import BeaconClient from '../../shared/BeaconClient.js';
const BeaconToken = require('../lib/shared_token_code.js');

import { parsePageParams } from '../shared/params.js';
import { colourScheme, markPage, guideUrl, withKnockout } from '../shared/pageSetup.js';
import { registerLoadRing } from '../shared/loadRing.js';
import { loadClusters } from './data/loadStats.js';
import { StatsCharts } from './charts/StatsCharts.js';
import { renderWordCloud } from './charts/wordCloud.js';
import { initBreakdownLayout } from './charts/breakdownLayout.js';
import { StatsVM } from './viewmodels/StatsVM.js';

// css order reasons... load this last
import '../../../styles/pages/stats.css';

const params = parsePageParams(window.location.search);
// Follow the OS light/dark setting (Bootstrap 5.3 colour modes).
colourScheme();

document.addEventListener('DOMContentLoaded', function () {
    // Watermark in Development builds, header colour per Beacon (as in LAD).
    markPage(params.source);

    withKnockout(function (ko) {
        registerLoadRing(ko);

        let vm = null;
        const charts = new StatsCharts({ onFiltered: () => vm && vm.syncFromCharts() });
        vm = new StatsVM({
            params,
            guideUrl: guideUrl('stats'),
            client: BeaconClient,
            charts,
            clusters: () => loadClusters('../resources/unitClusters.json'),
            renderWordCloud,
        });
        window.statsVM = vm; // for the stats-docs harness and the console
        window.statsCharts = charts;

        ko.applyBindings(vm);
        ko.tasks.runEarly(); // the breakdown cards must be in the DOM for the grids
        vm.layout = initBreakdownLayout(vm.breakdownGroups.map((g) => ({
            key: g.key,
            elementId: g.gridId,
            ids: g.items.map((b) => b.key),
        })));
        vm.cloudElement = document.getElementById('word-cloud');
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
