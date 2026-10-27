/*
  Incident Statistics page (pages/stats.html).

  Opened from Beacon's Lighthouse menu ("Incident Statistics") and the Jobs
  screen's "Statistics (Filtered)" button. Loads the incidents (Beacon's
  "jobs") for an HQ, several HQs or all of NSW over a date range and
  cross-filters them in dc.js charts; refreshes every few minutes.
*/

import BeaconClient from '../../shared/BeaconClient.js';
const BeaconToken = require('../lib/shared_token_code.js');

import { parseStatsParams, beaconEnvironment } from './data/params.js';
import { loadClusters } from './data/loadStats.js';
import { StatsCharts } from './charts/StatsCharts.js';
import { renderWordCloud } from './charts/wordCloud.js';
import { initBreakdownLayout } from './charts/breakdownLayout.js';
import { StatsVM } from './viewmodels/StatsVM.js';

// css order reasons... load this last
import '../../../styles/pages/stats.css';

const params = parseStatsParams(window.location.search);

// Follow the OS light/dark setting (Bootstrap 5.3 colour modes).
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => document.documentElement.setAttribute('data-bs-theme', darkQuery.matches ? 'dark' : 'light');
applyTheme();
darkQuery.addEventListener('change', applyTheme);

document.addEventListener('DOMContentLoaded', function () {
    if (chrome.runtime.getManifest().name.includes('Development')) {
        document.body.classList.add('watermark');
    }
    // Header colour per Beacon, as in LAD (env-trainbeacon / env-devbeacon).
    const env = beaconEnvironment(params.source);
    if (env !== 'production') document.body.classList.add('env-' + env);

    require(["knockout", "knockout-secure-binding"], function (ko, ksb) {
        ko.bindingProvider.instance = new ksb({
            attribute: "data-bind",
            globals: window,
            bindings: ko.bindingHandlers,
            noVirtualElements: false,
        });
        window.ko = ko;
        ko.options.deferUpdates = true;

        let vm = null;
        const charts = new StatsCharts({ onFiltered: () => vm && vm.syncFromCharts() });
        // Development Preview builds open the preview copy of the guide
        // (synced from master-dev), as LAD's "User guide" link does.
        const isDevBuild = (chrome.runtime.getManifest().name || '').includes('Development');
        vm = new StatsVM({
            params,
            guideUrl: `https://lighthouse.ses.nsw.gov.au/${isDevBuild ? 'preview/' : ''}guides/stats/`,
            client: BeaconClient,
            charts,
            clusters: () => loadClusters('../resources/unitClusters.json'),
            renderWordCloud,
        });
        window.statsVM = vm; // for the stats-docs harness and the console

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
