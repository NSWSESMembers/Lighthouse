const $ = require('jquery');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DOM = require('jsx-dom-factory').default;
import BeaconClient from '../../shared/BeaconClient.js';
import {
    simulationEnvironment,
    simulationLabel,
    sameSimulation,
    selectionStatus,
    isSimulationUnavailable,
} from '../../shared/cadenceSimulation.js';
import { watchSharedSelection, endSharedSelection } from '../../shared/cadenceSimulationShare.js';

// The Simulated Exercise Assets layer: its refresh interval matches LAD's
// radio refresh, and its on/off state is remembered like the other layers'.
const SIMULATED_ASSETS_LAYER = 'ses-assets-simulated';
const SIMULATED_ASSETS_BUTTON = 'toggleSesSimulatedAssetsBtn';
const SIMULATED_ASSETS_INTERVAL = 30000;


const lighthouseIcon = chrome.runtime.getURL('icons/lh-black.png');
const teamIcon = chrome.runtime.getURL('icons/bus.png');
const assetIcon = chrome.runtime.getURL('icons/asset-icons/asset-red.png');
//const hazardWatchIcon = chrome.runtime.getURL('icons/hazardWatch.png');

const helicopterIcon = chrome.runtime.getURL('icons/helicopter.png');
const rfsIcon = chrome.runtime.getURL('icons/rfs_emergency.png');
const lhqIcon = chrome.runtime.getURL('icons/ses.png');
const rmsIcon = chrome.runtime.getURL('icons/rms.png');
const rfscorpIcon = chrome.runtime.getURL('icons/rfs.png');
const sesIcon = chrome.runtime.getURL('icons/ses_corp.png');

const ausgridIcon = chrome.runtime.getURL('icons/ausgrid.png');
const endeavourIcon = chrome.runtime.getURL('icons/endeavour.png');
const essentialIcon = chrome.runtime.getURL('icons/essential.png');
// const evoIcon = chrome.runtime.getURL('icons/evo.png');

/**
 * A class for helping out with map layer access on the content script side.
 */
 export default class ContentScriptMapManager {

    /**
     * Constructs a new map manager.
     */
     constructor() {
        // The map of timers which will update the lighthouse map layers when enabled
        this._timers = {};
    }

    /**
 * Build a modal to inject into the body for asset selection
 */
     static asset_filter_modal()  {
        return $(
    <div id="LHAssetFilterModal" class="modal fade" role="dialog">
<div class="modal-dialog modal-sm" style="width:50%">
  <div class="modal-content">
     <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal">&times;</button>
        <h4 class="modal-title">Lighthouse Asset Filter</h4>
     </div>
     <div class="modal-body">
        <h4>Select assets to show</h4>
        <p/>
        <div class="container-fluid">

           <div class='row' style="display: flex; align-items: center;">
              <div class="col-md-5 text-center">
              <h5>All Assets</h5>
              <input type="text" style="width: 65%; margin:auto; margin-bottom: 5px" id="assetListAllQuickSearch" maxlength="30" class="form-control" placeholder="Filter"></input>
              <div id="asset-map-filter-loading" class="filter-loader-container">
                <div class="filter-loader-background">
                  <div class="filter-loader">Loading...</div>
                </div>
                </div>
                 <select multiple id="assetFilterListAll">
                 </select>
              </div>
              <div class="col-md-2 text-center">
              <div>
                 <div>
                    <button style="margin-bottom: 5px; width: 100px" type="button" class="btn btn-primary" id="teamFilterListAddSelected">Add<span style="margin-left: 10px;" class="glyphicon glyphicon-arrow-right" aria-hidden="true"></span></button>
                 </div>
                 <div>
                    <button style="margin-top: 5px; width: 100px" type="button" class="btn btn-primary" id="teamFilterListRemoveSelected"><span style="margin-right: 10px;" class="glyphicon glyphicon-arrow-left" aria-hidden="true"></span>Remove</button>
                 </div>
                 </div>
              </div>
              <div class="col-md-5 text-center">
              <h5>Selected Assets</h5>
              <input type="text" style="width: 65%; margin:auto; margin-bottom: 5px" id="assetListSelectedQuickSearch" maxlength="30" class="form-control" placeholder="Filter"></input>
                 <select multiple id="assetFilterListSelected">
                 </select>
              </div>
           </div>
        </div>
     </div>
     <div class="modal-footer">
        <button type="button" class="btn btn-primary" id="assetSaveFiltersButton" data-dismiss="modal">Proceed</button>
     </div>
  </div>
</div>
</div>
)
        }


    /** TODO: Fix Hazard Watch
    <span id="toggleHazardWatchBtn" class="label tag tag-lh-filter tag-disabled">
    <img style="max-width: 16px; vertical-align: top;margin-right: 4px;" src={hazardWatchIcon} />
    <span class="tag-text">Hazard Watch</span>
    </span>
    */

    /** PLACEHOLDER: Evo Energy Boundary Button
     * Comments: Removed as not within NSW boundary. Here for future. 
        <span id="toggleBoundaryEvoBtn" class="label tag tag-lh-filter tag-disabled">
        <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src={evoIcon} />
        <span class="tag-text">Evo Energy</span>
        </span>
     */
   
    /**
     * Creates a menu for the map layers.
     *
     * @returns {*|jQuery|HTMLElement}
     */
     static createLayerMenu() {
        return $(<li id="lhlayers">
            <a href="#" class="js-sub-menu-toggle">
            <img src={lighthouseIcon} style="width:14px;vertical-align:top;margin-right:10px;float:left" />
            <span class="text">Lighthouse</span>
            <i class="toggle-icon fa fa-angle-left"></i>
            </a>
            <ul class="sub-menu ">
            <li>
            <a class="js-sub-sub-menu-toggle" href="#">
            <img src={sesIcon} style="width:14px;vertical-align:sub;margin-right:7px;" />
            <span class="text toggle-tag-text">NSW SES</span>
            </a>
            <ul class="sub-sub-menu">
            <li class="clearfix">
            <span id="togglelhqsBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src={lhqIcon} />
            <span class="tag-text">SES LHQs</span>
            </span>
            <span id="toggleSesTeamsBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px; background: #fff;vertical-align: top;margin-right: 4px;" src={teamIcon} />
            <span class="tag-text">Team Tasking</span>
            </span>
            <span id="toggleSesFilteredAssetsBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px; vertical-align: top;margin-right: 4px;" src={assetIcon} />
            <span class="tag-text">Filtered Asset Locations</span>
            </span>
            <span id="toggleSesSimulatedAssetsBtn" class="label tag tag-lh-filter tag-disabled" style="display: none">
            <img style="max-width: 16px; vertical-align: top;margin-right: 4px;" src={assetIcon} />
            <span class="tag-text">Simulated Exercise Assets</span>
            </span>
            </li>
            </ul>
            </li>
            <li>
            <a class="js-sub-sub-menu-toggle" href="#">
            <img src={rmsIcon} style="margin-top:4px;width:14px;vertical-align:top;float:left;margin-right:7px;" />
            <span class="text toggle-tag-text">Roads and Maritime Services</span>
            </a>
            <ul class="sub-sub-menu">
            <li class="clearfix">
            <span id="toggleRmsIncidentsBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src="https://www.livetraffic.com/assets/icons/map/general-hazards/moderate-now.svg" />
            <span class="tag-text">RMS Incidents</span>
            </span>
            <span id="toggleRmsFloodingBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src="https://www.livetraffic.com/assets/icons/map/other-hazards/flood.svg" />
            <span class="tag-text">RMS Flood Reports</span>
            </span>
            <span id="toggleRmsLocalBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src="https://www.livetraffic.com/assets/icons/map/general-hazards/low-now.svg" />
            <span class="tag-text">Local Council Incidents</span>
            </span>
            <span id="toggleRmsCamerasBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px; background: #fff;vertical-align: top;margin-right: 4px;" src="https://www.livetraffic.com/assets/icons/map/others/camera-N.svg" />
            <span class="tag-text">RMS Cameras</span>
            </span>
            </li>
            </ul>
            </li>
            <li>
            <a class="js-sub-sub-menu-toggle" href="#">
            <img src={rfscorpIcon} style="width:14px;vertical-align:top;float:left;margin-right:7px;" />
            <span class="text toggle-tag-text">NSW Rural Fire Service</span>
            </a>
            <ul class="sub-sub-menu">
            <li class="clearfix">
            <span id="toggleRfsIncidentsBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src={rfsIcon} />
            <span class="tag-text">RFS Incidents</span>
            </span>
            </li>
            </ul>
            </li>
            <li>
            <a class="js-sub-sub-menu-toggle" href="#">
            <i class="toggle-icon-sub fa fa-flash"></i>
            <span class="text toggle-tag-text">Energy &amp; Utilities</span>
            </a>
            <ul class="sub-sub-menu">
            <li class="clearfix">
            <span id="togglePowerOutagesBtn" class="label tag tag-lh-filter tag-disabled">
            <span class="glyphicon glyphicon-flash" aria-hidden="true"></span>
            <span class="tag-text"> All Power Outages</span>
            </span>
            </li>
            <li class="clearfix">
            <hr style="height: 1px;margin-top:5px;margin-bottom:5px" />
            <span style="font-weight: bold;display: block;font-size: smaller;">
                Electricity Boundaries &amp; Outages by Provider
            </span>
            <span id="toggleBoundaryAusgridBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src={ausgridIcon} />
            <span class="tag-text">Ausgrid</span>
            </span>
            <span id="toggleBoundaryEndeavourBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src={endeavourIcon} />
            <span class="tag-text">Endeavour Energy</span>
            </span>
            <span id="toggleBoundaryEssentialBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src={essentialIcon} />
            <span class="tag-text">Essential Energy</span>
            </span>
            </li>
            </ul>
            </li>
            <li>
            <a class="js-sub-sub-menu-toggle" href="#">
            <i class="toggle-icon-sub fa fa-bell"></i>
            <span class="text toggle-tag-text">Other</span>
            </a>
            <ul class="sub-sub-menu">
            <li class="clearfix">
            <span id="toggleHelicoptersBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px; background: #fff;vertical-align: top;margin-right: 4px;" src={helicopterIcon} />
            <span class="tag-text">Rescue Aircraft (OpenSky)</span>
            </span>
            <span id="toggleAdsbBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px; background: #fff;vertical-align: top;margin-right: 4px;" src={helicopterIcon} />
            <span class="tag-text">Rescue Aircraft (ADSB)</span>
            </span>
            </li>
            </ul>
            </li>
            </ul>
            </li>);
}

    /**
     * Initialises the map manager.
     */
     initialise() {
        this._registerClickHandler('toggleRfsIncidentsBtn', 'rfs', this._requestRfsLayerUpdate, 5 * 60000); // every 5 mins
        this._registerClickHandler('toggleRmsIncidentsBtn', 'transport-incidents', this._requestTransportIncidentsLayerUpdate, 5 * 60000); // every 5 mins
        this._registerClickHandler('toggleRmsFloodingBtn', 'transport-flood-reports', this._requestTransportFloodReportsLayerUpdate, 5 * 60000); // every 5 mins
        this._registerClickHandler('toggleRmsLocalBtn', 'transport-local-reports', this._requestTransportLocalReportsLayerUpdate, 5 * 60000); // every 5 mins
        this._registerClickHandler('toggleRmsCamerasBtn', 'transport-cameras', this._requestTransportCamerasLayerUpdate, 10 * 60000); // every 10 mins
        this._registerClickHandler('toggleHelicoptersBtn', 'helicopters', ContentScriptMapManager._requestHelicoptersLayerUpdate, 6 * 10000); // every 60s
        this._registerClickHandler('toggleAdsbBtn', 'adsb', ContentScriptMapManager._requestAdsbLayerUpdate, 6 * 10000); // every 60s
        this._registerClickHandler('toggleSesTeamsBtn', 'ses-teams', this._requestSesTeamsLayerUpdate, 5 * 60000); // every 5 minutes
        this._registerClickHandler('toggleSesFilteredAssetsBtn', 'ses-assets-filtered', this._requestSesFilteredAssets, 60000); // every 1 minutes
        //this._registerClickHandler('toggleHazardWatchBtn', 'hazard-watch', this._requestHazardWatchLayerUpdate, 5 * 60000); // every 5 minutes
        this._registerClickHandler('togglePowerOutagesBtn', 'power-outages', this._requestPowerOutagesLayerUpdate, 5 * 60000); // every 5 mins
        this._registerClickHandler('togglelhqsBtn', 'lhqs', this._requestLhqsLayerUpdate, 60 * 60000); // every 60 mins

        this._registerClickHandler('toggleBoundaryAusgridBtn', 'power-boundary-ausgrid', this._requestAusgridBoundaryOutageLayerUpdate, 5 * 60000); // every 60 mins

        this._registerClickHandler('toggleBoundaryEndeavourBtn', 'power-boundary-endeavour', this._requestEndeavourBoundaryOutageLayerUpdate, 5 * 60000); // every 60 mins

        this._registerClickHandler('toggleBoundaryEssentialBtn', 'power-boundary-essential', this._requestEssentialBoundaryOutageLayerUpdate, 5 * 60000); // every 60 mins

        this._initialiseSimulatedAssetsLayer();

        window.addEventListener('message', function (event) {
            // We only accept messages from background
            if (event.source !== window)
                return;
            if (event.data.type) {
                if (event.data.type === 'LH_USER_API') {
                    this._base = event.data.base;
                    //console.debug('Got base: ' + this._base);

                } else if (event.data.type === 'LH_USER_ACCESS_TOKEN') {
                    this._token = event.data.token;
                    //console.debug('Got access-token: ' + this._token);
                    (this._tokenWaiters || []).splice(0).forEach((resolve) => resolve(this._token));

                } else if (event.data.type === 'LH_SELECTED_STATE') {
                    this._hqs = event.data.params.hqs;
                    this._startDate = event.data.params.startDate;
                    this._endDate = event.data.params.endDate;
                    //console.debug('Got hqs: ' + this._hqs);
                    //console.debug('Got start: ' + this._startDate);
                    //console.debug('Got end: ' + this._endDate);
                    if (event.data.params.firstRun !== true) {
                    if (!$('#toggleSesTeamsBtn').hasClass('tag-disabled')) //if the teams button is pressed, teams are shown, update them with the new data
                     {
                        this._requestSesTeamsLayerUpdate()
                     }
                     //TODO: Race condition with on page load and on button click
                     if (!$('#toggleSesFilteredAssetsBtn').hasClass('tag-disabled')) //if the asset button is pressed, teams are shown, update them with the new data
                      {
                         this._requestSesFilteredAssets()
                      }
                    }

    } else if (event.data.type === 'LH_RESPONSE_HELI_PARAMS') {
        let params = event.data.params;
        this._requestLayerUpdate('helicopters', params);
    } else if (event.data.type === 'LH_RESPONSE_ADSB_PARAMS') {
        let params = event.data.params;
        this._requestLayerUpdate('adsb', params);
    } else if (event.data.type === 'LH_RESPONSE_TRANSPORT_KEY') {

        let sessionKey = 'lighthouseTransportApiKeyCache';
        let transportApiKeyCache = event.data.key;

        //console.debug('got transport key: ' + transportApiKeyCache);
        sessionStorage.setItem(sessionKey, transportApiKeyCache);
        this._fetchTransportResourceWithKey(transportApiKeyCache, event.data.layer);
    }
}
}.bind(this), false);

}

    /**
     * Registers the click handler on the filter buttons.
     *
     * @param buttonId the button ID.
     * @param layer the map layer to update.
     * @param updateFunction the update function.
     * @param interval the refresh interval.
     * @return timer the timer which refreshes the layer.
     */
     _registerClickHandler(buttonId, layer, updateFunction, interval) {
        console.log(buttonId)
        document.getElementById(buttonId).addEventListener('click',
            function (e) {

                //work out if it was a human or a script that clicked
                let headless = true 
                if (e.pointerType != "") {
                    headless = false
                }

                console.debug(`toggle ${buttonId} clicked`);

                let button = $(`#${buttonId}`);
                let disabled = button.hasClass('tag-disabled');

                localStorage.setItem('Lighthouse-' + buttonId, disabled);

                if (disabled) {
                    updateFunction = updateFunction.bind(this);
                    updateFunction({headless: headless});
                    this._timers[layer] = setInterval(updateFunction, interval);
                    button.removeClass('tag-disabled');
                } else {
                    clearInterval(this._timers[layer]);
                    window.postMessage({type: 'LH_CLEAR_LAYER_DATA', layer: layer}, '*');
                    button.addClass('tag-disabled');
                }
            }.bind(this), false);
    }

    /**
     * Sends a request to the background script to get the LHQ locations.
     */
     _requestLhqsLayerUpdate() {
        console.debug('updating LHQs layer');
        $.getJSON(chrome.runtime.getURL('resources/SES_HQs.geojson'), function (data) {
            ContentScriptMapManager._passLayerDataToInject('lhqs', data);
        }.bind(this))
    }
    
    /**
     * Sends a request to the background script to get the electricity distribution area polygons and outages
     */

     _requestAllElectricityBoundaryLayerUpdate() {
        this._requestAusgridBoundaryLayerUpdate();
        this._requestEndeavourBoundaryLayerUpdate();
        this._requestEssentialBoundaryLayerUpdate();
    }

    // Ausgrid
     _requestAusgridBoundaryOutageLayerUpdate() {
        this._requestAusgridBoundaryLayerUpdate();
        this._requestAusgridOutagesLayerUpdate();
    }

     _requestAusgridBoundaryLayerUpdate() {
        console.debug('updating Ausdgrid boundary layer');
        $.getJSON(chrome.runtime.getURL('resources/ausgrid_boundary.geojson'), function (data) {
            ContentScriptMapManager._passLayerDataToInject('power-boundary-ausgrid', data);
        }.bind(this))
    }

     _requestAusgridOutagesLayerUpdate() {
        this._requestLayerUpdate('power-outages-ausgrid')
    }

    // Endeavour
    _requestEndeavourBoundaryOutageLayerUpdate() {
        this._requestEndeavourBoundaryLayerUpdate();
        this._requestEndeavourOutagesLayerUpdate();
    }

    _requestEndeavourBoundaryLayerUpdate() {
        console.debug('updating Endeavour boundary layer');
        $.getJSON(chrome.runtime.getURL('resources/endeavour_boundary.geojson'), function (data) {
            ContentScriptMapManager._passLayerDataToInject('power-boundary-endeavour', data);
        }.bind(this))
    }

     _requestEndeavourOutagesLayerUpdate() {
        this._requestLayerUpdate('power-outages-endeavour')
    }

    // Essential

    _requestEssentialBoundaryOutageLayerUpdate() {
        this._requestEssentialBoundaryLayerUpdate();
        this._requestEssentialOutagesLayerUpdate();
    }
     _requestEssentialBoundaryLayerUpdate() {
        console.debug('updating Essential boundary layer');
        $.getJSON(chrome.runtime.getURL('resources/essential_boundary.geojson'), function (data) {
            ContentScriptMapManager._passLayerDataToInject('power-boundary-essential', data);
        }.bind(this))
    }

    _requestEssentialOutagesLayerUpdate() {
        this._requestLayerUpdate('power-outages-essential')
    }


    // Evo (ACT) Boundary Only
     _requestEvoBoundaryLayerUpdate() {
        console.debug('updating Evo boundary layer');
        $.getJSON(chrome.runtime.getURL('resources/evo_boundary.geojson'), function (data) {
            ContentScriptMapManager._passLayerDataToInject('evo-boundary', data);
        }.bind(this))
    }

    /**
     * Sends a request to the background script to get the latest RFS incidents.
     */
     _requestRfsLayerUpdate() {
        //console.debug('updating RFS layer');
        this._requestLayerUpdate('rfs');
    }

    /**
     * Sends a request to the background script to get the latest transport incidents.
     */
     _requestTransportIncidentsLayerUpdate() {
        //console.debug('updating transport incidents layer');
        this._fetchTransportResource('transport-incidents');
    }

    /**
     * Sends a request to the background script to get the latest transport flood reports.
     */
     _requestTransportFloodReportsLayerUpdate() {
        //console.debug('updating transport flood layer');
        this._fetchTransportResource('transport-flood-reports');
    }

    /**
     * Sends a request to the background script to get the latest transport local reports.
     */
     _requestTransportLocalReportsLayerUpdate() {
        //console.debug('updating transport local layer');
        this._fetchTransportResource('transport-local-reports');
    }

    /**
     * asks for the cameras via the fetchTransportResource function
     */
     _requestTransportCamerasLayerUpdate() {
        //console.debug('updating transport cameras layer');
        this._fetchTransportResource('transport-cameras');
    }

    _requestPowerOutagesLayerUpdate() {
        //console.debug('updating power-outages layer');
        this._requestLayerUpdate('power-outages')
    }

    _requestHazardWatchLayerUpdate() {
        //console.debug('updating hazard-watch layer');
        this._requestLayerUpdate('hazard-watch')

    }

    /**
     * Requests an update to the SES teams location layer.
     */
     _requestSesTeamsLayerUpdate() {
        //console.debug('updating SES teams layer',this);

        if (!this._token) {
            // If the inject script hasn't sent over the HQs wait a few seconds then retry
            setTimeout(this._requestSesTeamsLayerUpdate.bind(this), 2000);
            return;
        }

        BeaconClient.team.getTeamGeoJson(this._hqs, this._startDate, this._endDate, { host: this._base, userId: 'ContentScriptMapManager', token: this._token })
            .then((result) => {
                ContentScriptMapManager._passLayerDataToInject('ses-teams', result);
            })
            .catch((error) => console.error('Failed to fetch SES teams layer', error));
    }

    /**
     * Requests an update to the SES filtered asset layer.
     */
     _requestSesFilteredAssets(passedVars) {
        if (!this._token) {
            // If the inject script hasn't sent over the HQs wait a few seconds then retry
            setTimeout(this._requestSesFilteredAssets.bind(this), 2000);
            return;
        } else {
            if (passedVars && passedVars.headless == false) {
                //something about drawing that modal for picking assets
                window.postMessage({type: 'LH_ASSETFILTERMODALCALL'}, '*');
            } else {
                let loadIn = JSON.parse(localStorage.getItem('LighthouseJobViewAssetFilter')) || []
                BeaconClient.asset.filter(loadIn, { host: this._base, userId: 'ContentScriptMapManager', token: this._token })
                    .then((result) => {
                        ContentScriptMapManager._passLayerDataToInject('ses-assets-filtered', result);
                    })
                    .catch((error) => console.log(error));
            }
      }
    }

    /**
     * The Simulated Exercise Assets layer (Train and Test Beacon only): the
     * vehicles and vessels of the CADence exercise chosen for this Beacon
     * environment on the CADence Simulated Exercise page, beside the live
     * asset layers (see shared/cadenceSimulationShare.js). Its button only
     * shows while an exercise is chosen, and the layer stays on from one
     * exercise to the next until it's turned off.
     */
     _initialiseSimulatedAssetsLayer() {
        const button = $(`#${SIMULATED_ASSETS_BUTTON}`);
        const environment = simulationEnvironment(location.origin);
        if (!environment) {
            button.remove();
            return;
        }
        this._simulationEnv = environment.env;
        const savedKey = `Lighthouse-${SIMULATED_ASSETS_BUTTON}`;

        button.on('click', () => {
            const turnOn = button.hasClass('tag-disabled');
            localStorage.setItem(savedKey, turnOn);
            this._setSimulatedAssetsLayer(turnOn && !!this._simulation);
        });

        watchSharedSelection(environment.env, (selection) => {
            const previous = this._simulation;
            this._simulation = selection;
            const on = !button.hasClass('tag-disabled');
            if (!selection) {
                // No exercise is chosen any more.
                button.hide();
                if (on) this._setSimulatedAssetsLayer(false);
                return;
            }
            button.attr('title', `Simulated positions from the CADence exercise ${simulationLabel(selection)}`).show();
            if (on) {
                if (!sameSimulation(previous, selection)) this._requestSesSimulatedAssets();
            } else if (localStorage.getItem(savedKey) === 'true') {
                this._setSimulatedAssetsLayer(true);
            }
        });
    }

    _setSimulatedAssetsLayer(on) {
        const button = $(`#${SIMULATED_ASSETS_BUTTON}`);
        clearInterval(this._timers[SIMULATED_ASSETS_LAYER]);
        this._simulatedAssetsRequest = (this._simulatedAssetsRequest || 0) + 1; // drops a response in flight
        if (on) {
            button.removeClass('tag-disabled');
            this._requestSesSimulatedAssets();
            this._timers[SIMULATED_ASSETS_LAYER] = setInterval(
                () => this._requestSesSimulatedAssets(),
                SIMULATED_ASSETS_INTERVAL,
            );
        } else {
            button.addClass('tag-disabled');
            // Nothing's drawn before the inject script has sent its token over.
            if (this._token) window.postMessage({ type: 'LH_CLEAR_LAYER_DATA', layer: SIMULATED_ASSETS_LAYER }, '*');
        }
    }

    /**
     * Requests an update to the Simulated Exercise Assets layer.
     */
     _requestSesSimulatedAssets() {
        const selection = this._simulation;
        if (!selection || $(`#${SIMULATED_ASSETS_BUTTON}`).hasClass('tag-disabled')) return;
        if (!this._token || !this._base) {
            // The inject script hasn't sent the token over yet
            clearTimeout(this._simulatedAssetsRetry);
            this._simulatedAssetsRetry = setTimeout(() => this._requestSesSimulatedAssets(), 2000);
            return;
        }
        const request = (this._simulatedAssetsRequest = (this._simulatedAssetsRequest || 0) + 1);
        BeaconClient.asset
            .simulated({
                host: this._base,
                token: this._token,
                refreshToken: () => this._freshToken(),
                simulation: { exerciseId: selection.exerciseId, copyId: selection.copyId },
            })
            .then((assets) => {
                // A newer request, another exercise, or the layer turned off.
                if (request !== this._simulatedAssetsRequest) return;
                ContentScriptMapManager._passLayerDataToInject(SIMULATED_ASSETS_LAYER, assets);
                // An ended exercise sends no positions, and so does one that
                // hasn't published any yet: check which.
                if (assets.length === 0) this._checkSimulationStillRunning(selection);
            })
            .catch((error) => {
                console.warn('Failed to fetch the simulated exercise assets', error);
                if (isSimulationUnavailable(error)) this._endSimulation(selection, 'unavailable');
            });
    }

    /**
     * After an empty simulated feed: if the exercise has ended (or the
     * backend refused the sign-in), send everything back to live positions.
     * LAD and the CADence Simulated Exercise page say why.
     */
    _checkSimulationStillRunning(selection) {
        if (this._simulationCheck) return;
        this._simulationCheck = selectionStatus(selection, {
            host: this._base,
            token: this._token,
            refreshToken: () => this._freshToken(),
        })
            .then((status) => {
                if (status === 'ended' || status === 'unavailable') return this._endSimulation(selection, status);
            })
            .catch((error) => console.warn("Couldn't check the simulated exercise is still running", error))
            .finally(() => {
                this._simulationCheck = null;
            });
    }

    /**
     * Beacon's current token, for a CADence call that was refused: the inject
     * script only sends it over every 5 minutes, so the copy here can be older
     * than the one Beacon has renewed to. Asks for it now and resolves with
     * what arrives, or the copy already held if nothing does within 2 seconds.
     */
    _freshToken() {
        return new Promise((resolve) => {
            const waiters = (this._tokenWaiters = this._tokenWaiters || []);
            const done = (token) => {
                clearTimeout(timer);
                resolve(token || null);
            };
            const timer = setTimeout(() => {
                const index = waiters.indexOf(done);
                if (index !== -1) waiters.splice(index, 1);
                resolve(this._token || null);
            }, 2000);
            waiters.push(done);
            window.postMessage({ type: 'LH_REQUEST_USER_ACCESS_TOKEN' }, '*');
        });
    }

    _endSimulation(selection, reason) {
        return endSharedSelection(this._simulationEnv, selection, reason).catch((error) =>
            console.warn("Couldn't record that the simulated exercise ended", error),
        );
    }

    /**
     * Fetches a resource from the transport API.
     *
     * @param layer the layer to fetch, e.g. 'transport-incidents'.
     */
     _fetchTransportResource(layer) {
        let sessionKey = 'lighthouseTransportApiKeyCache';
        let transportApiKeyCache = sessionStorage.getItem(sessionKey);

        if (transportApiKeyCache) {
            //console.debug('Using cached key: ' + transportApiKeyCache);
            this._fetchTransportResourceWithKey(transportApiKeyCache, layer);

        } else {
            //console.debug('Fetching ops log key');
            window.postMessage({type: 'LH_GET_TRANSPORT_KEY', layer: layer}, '*');
        }
    }

    /**
     * Fetches a resource from the transport API.
     *
     * @param layer the layer to fetch.
     * @param apiKey the transport.nsw.gov.au API key.
     */
     _fetchTransportResourceWithKey(apiKey, layer) {
        console.info(`fetching transport resource: ${apiKey} ${layer}`);
        let params = {apiKey: apiKey};
        this._requestLayerUpdate(layer, params)
    }

    /**
     * Sends a request to the background script to get the latest helicopter positions.
     */
     static _requestHelicoptersLayerUpdate() {
        console.debug('updating helicopter opensky layer');
        window.postMessage({type: 'LH_REQUEST_HELI_PARAMS'}, '*');
    }

     /**
     * Sends a request to the background script to get the latest ADSB positions.
     */
     static _requestAdsbLayerUpdate() {
        console.debug('updating helicopter adsb layer');
        window.postMessage({type: 'LH_REQUEST_ADSB_PARAMS'}, '*');
    }   

    /**
     * Sends a message to the background script with layer name and params.
     * background should reply with a data set or error. reply of data is forwarded
     * to a function to the injected script to be used.
     * @param layer the layer to fetch.
     * @param params an API key or something needed to fetch the resource.
     */
     _requestLayerUpdate(layer, params = {}) {
        chrome.runtime.sendMessage({type: layer, params: params}, function (response) {
            if (response.error) {
                console.error(`Update to ${layer} failed: ${response.error} http-code:${response.httpCode}`);
            } else {
                ContentScriptMapManager._passLayerDataToInject(layer, response)
            }
        }.bind(this));
    }

    /**
     * Sends a message to the injected script with layer name and data.
     * dont expect a response.
     * @param layer the layer to own the data.
     * @param response the data to use.
     */
     static _passLayerDataToInject(layer, response) {
        window.postMessage({type: 'LH_UPDATE_LAYERS_DATA', layer: layer, response: response}, '*');
    }
};
