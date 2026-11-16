/*
  Team Summary page (pages/teamsummary.html).

  Opened from Beacon's Lighthouse menu ("Team Summary") and the Teams
  screen's Team Summary button. A card per team for an HQ, several HQs or
  all of NSW: status, members, resources, where the team was last seen and
  its latest history, for a screen on the wall. Refreshes every 3 minutes.
*/

import BeaconClient from '../../shared/BeaconClient.js';
const BeaconToken = require('../lib/shared_token_code.js');
import { Modal, Popover } from 'bootstrap5';

import { parsePageParams } from '../shared/params.js';
import { blockUnlessOpenedFromBeacon } from '../../shared/beaconEnvironments.js';
import { colourScheme, markPage, guideUrl, withKnockout } from '../shared/pageSetup.js';
import { registerLoadRing } from '../shared/loadRing.js';
import { TeamSummaryVM } from './viewmodels/TeamSummaryVM.js';

// css order reasons... load this last
import '../../../styles/pages/teamsummary.css';

const params = parsePageParams(window.location.search);
blockUnlessOpenedFromBeacon(params);
const setColourScheme = colourScheme();

/**
 * The incident popup: one knockout-bound element (#incident-popup), moved
 * into a Bootstrap popover by whichever history entry was clicked.
 */
function incidentPopup(content) {
    let current = null; // { anchor, popover }

    function hide() {
        if (!current) return;
        current.popover.dispose();
        current = null;
    }

    document.addEventListener('click', (e) => {
        if (!current) return;
        if (current.anchor.contains(e.target) || content.contains(e.target)) return;
        hide();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hide();
    });

    return {
        show(anchor) {
            if (current && current.anchor === anchor) return;
            hide();
            content.hidden = false;
            const popover = new Popover(anchor, {
                content,
                html: true,
                sanitize: false, // our own bound element, not markup
                trigger: 'manual',
                placement: 'auto',
                container: 'body',
                customClass: 'incident-popover',
            });
            current = { anchor, popover };
            popover.show();
        },
        update() {
            if (current) current.popover.update();
        },
        /** A refresh re-drew the history the popup points at. */
        hideIfDetached() {
            if (current && !current.anchor.isConnected) hide();
        },
    };
}

document.addEventListener('DOMContentLoaded', function () {
    markPage(params.source);

    withKnockout(function (ko) {
        registerLoadRing(ko);

        const settings = new Modal(document.getElementById('settings-modal'));
        const teams = new Modal(document.getElementById('teams-modal'));
        const popupEl = document.getElementById('incident-popup');
        const popup = incidentPopup(popupEl);
        const vm = new TeamSummaryVM({
            params,
            guideUrl: guideUrl('teams'),
            client: BeaconClient,
            storage: window.localStorage,
            applyTheme: setColourScheme,
            openSettings: () => settings.show(),
            openTeams: () => teams.show(),
            showIncident: (anchor) => popup.show(anchor),
            incidentChanged: () => popup.update(),
        });
        window.teamSummaryVM = vm; // for the teamsummary-docs harness and the console

        ko.applyBindings(vm);
        vm.pageTitle.subscribe((t) => { document.title = t; });

        setInterval(() => {
            vm.tick();
            popup.hideIfDetached();
        }, 1000);
        document.body.style.opacity = '1';

        BeaconToken.fetchBeaconTokenAndKeepReturningValidTokens(
            params.host,
            params.source,
            ({ token }) => vm.setToken(token),
        );
    });
});
