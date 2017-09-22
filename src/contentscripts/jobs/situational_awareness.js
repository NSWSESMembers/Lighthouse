const $ = require('jquery');
const DOM = require('jsx-dom-factory');
const moment = require('moment');
const inject = require('../../../lib/inject.js');
const LighthouseTeam = require('../../../pages/lib/shared_team_code.js');
const MapManager = require('../../../pages/lib/map/MapManager.js');

//inject the coded needed to fix visual problems
//needs to be injected so that it runs after the DOMs are created
inject('jobs/situational_awareness.js');

var token = null;
var hqs = null;
var startDate = null;
var endDate = null;

// Add the buttons for the extra layers
MapManager.createLayerMenu().appendTo('#currentSituationLayers');

// The map of timers which will update the lighthouse map layers when enabled
var timers = {};

/**
 * Registers the click handler on the filter buttons.
 *
 * @param buttonId the button ID.
 * @param layer the map layer to update.
 * @param updateFunction the update function.
 * @param interval the refresh interval.
 * @return timer the timer which refreshes the layer.
 */
function registerClickHandler(buttonId, layer, updateFunction, interval) {
    document.getElementById(buttonId).addEventListener('click',
        function () {
            console.debug(`toggle ${buttonId} clicked`);

            var button = $(`#${buttonId}`);
            var disabled = button.hasClass('tag-disabled');

            localStorage.setItem('Lighthouse-' + buttonId, disabled);

            if (disabled) {
                updateFunction();
                timers[layer] = setInterval(updateFunction, interval);
                button.removeClass('tag-disabled');
            } else {
                clearInterval(timers[layer]);
                window.postMessage({type: 'LH_CLEAR_LAYER_DATA', layer: layer}, '*');
                button.addClass('tag-disabled');
            }
        }, false);
}

registerClickHandler('toggleRfsIncidentsBtn', 'rfs', requestRfsLayerUpdate, 5 * 60000); // every 5 mins
registerClickHandler('toggleRmsIncidentsBtn', 'transport-incidents', requestTransportIncidentsLayerUpdate, 5 * 60000); // every 5 mins
registerClickHandler('toggleRmsFloodingBtn', 'transport-flood-reports', requestTransportFloodReportsLayerUpdate, 5 * 60000); // every 5 mins
registerClickHandler('toggleRmsCamerasBtn', 'transport-cameras', requestTransportCamerasLayerUpdate, 10 * 60000); // every 10 mins
registerClickHandler('toggleHelicoptersBtn', 'helicopters', requestHelicoptersLayerUpdate, 10000); // every 10s
registerClickHandler('toggleSesTeamsBtn', 'ses-teams', requestSesTeamsLayerUpdate, 5 * 60000); // every 5 minutes
registerClickHandler('togglePowerOutagesBtn', 'power-outages', requestPowerOutagesLayerUpdate, 5 * 60000); // every 5 mins
registerClickHandler('togglelhqsBtn', 'lhqs', requestLhqsLayerUpdate, 60 * 60000); // every 60 mins


//Clear all lighthouse filters when click. A little hacky by changing the button class then calling the click to clear inbuild timers and layers.
//saves recreating functions outside of registerClickHandler
$('input[data-bind="click: clearLayers"]')[0].addEventListener('click',
    function () {
        console.log('resetting lighthouse layers');
        var buttons = ['toggleRfsIncidentsBtn', 'toggleRmsIncidentsBtn', 'toggleRmsFloodingBtn', 'toggleRmsCamerasBtn', 'toggleHelicoptersBtn', 'togglePowerOutagesBtn', 'togglelhqsBtn'];
        buttons.forEach(function (buttonId) {
            var button = $(`#${buttonId}`);
            button.removeClass('tag-disabled');
            button.trigger('click');
        })
    });

/**
 * Sends a request to the background script to get the LHQ locations.
 */
function requestLhqsLayerUpdate() {
    console.debug('updating LHQs layer');
    $.getJSON(chrome.extension.getURL('resources/SES_HQs.geojson'), function (data) {
        passLayerDataToInject('lhqs', data)
    })

}

/**
 * Sends a request to the background script to get the latest RFS incidents.
 */
function requestRfsLayerUpdate() {
    console.debug('updating RFS layer');
    requestLayerUpdate('rfs')

}

/**
 * Sends a request to the background script to get the latest transport incidents.
 */
function requestTransportIncidentsLayerUpdate() {
    console.debug('updating transport incidents layer');
    fetchTransportResource('transport-incidents');
}

/**
 * Sends a request to the background script to get the latest transport flood reports.
 */
function requestTransportFloodReportsLayerUpdate() {
    console.debug('updating transport incidents layer');
    fetchTransportResource('transport-flood-reports');
}


/**
 * asks for the cameras via the fetchTransportResource function
 *
 */
function requestTransportCamerasLayerUpdate() {
    console.debug('updating transport cameras layer');
    fetchTransportResource('transport-cameras');
}


function requestPowerOutagesLayerUpdate() {
    console.debug('updating power-outages layer');
    requestLayerUpdate('power-outages')
}

/**
 * Requests an update to the SES teams location layer.
 */
function requestSesTeamsLayerUpdate() {
    console.debug('updating SES teams layer');

    if (!hqs) {
        // If the inject script hasn't sent over the HQs wait a few seconds then retry
        setTimeout(requestSesTeamsLayerUpdate, 2000);
        return;
    }

    LighthouseTeam.getTeamGeoJson(hqs, startDate, endDate, token, function(result) {
        passLayerDataToInject('ses-teams', result);
    });
}

/**
 * Fetches a resource from the transport API.
 *
 * @param layer the layer to fetch, e.g. 'transport-incidents'.
 */
function fetchTransportResource(layer) {
    var sessionKey = 'lighthouseTransportApiKeyCache';
    var transportApiKeyCache = sessionStorage.getItem(sessionKey);

    if (transportApiKeyCache) {
        console.debug('Using cached key: ' + transportApiKeyCache);
        fetchTransportResourceWithKey(transportApiKeyCache, layer);

    } else {
        console.debug('Fetching ops log key');
        window.postMessage({type: 'LH_GET_TRANSPORT_KEY', layer: layer}, '*');
    }
}


/**
 * Fetches a resource from the transport API.
 *
 * @param layer the layer to fetch.
 * @param apiKey the transport.nsw.gov.au API key.
 */
function fetchTransportResourceWithKey(apiKey, layer) {
    console.info(`fetching transport resource: ${apiKey} ${layer}`);
    var params = {apiKey: apiKey};
    requestLayerUpdate(layer, params)
}


/**
 * Sends a request to the background script to get the latest helicopter positions.
 */
function requestHelicoptersLayerUpdate() {
    console.debug('updating transport incidents layer');
    var params = '';
    window.postMessage({type: 'LH_REQUEST_HELI_PARAMS'}, '*');
}


/**
 * Sends a message to the background script with layer name and params.
 * background should reply with a data set or error. reply of data is forwarded
 * to a function to the injected script to be used.
 * @param layer the layer to fetch.
 * @param params an API key or something needed to fetch the resource.
 */
function requestLayerUpdate(layer, params = {}) {
    chrome.runtime.sendMessage({type: layer, params: params}, function (response) {
        if (response.error) {
            console.error(`Update to ${type} failed: ${response.error} http-code:${response.httpCode}`);
        } else {
            passLayerDataToInject(layer, response)
        }
    });
}

/**
 * Sends a message to the injected script with layer name and data.
 * dont expect a response.
 * @param layer the layer to own the data.
 * @param response the data to use.
 */
function passLayerDataToInject(layer, response) {
    window.postMessage({type: 'LH_UPDATE_LAYERS_DATA', layer: layer, response: response}, '*');
}


window.addEventListener('message', function (event) {
    // We only accept messages from background
    if (event.source !== window)
        return;

    if (event.data.type) {
        if (event.data.type === 'LH_USER_ACCESS_TOKEN') {
            token = event.data.token;
            console.debug('Got access-token: ' + token);

        } else if (event.data.type === 'LH_SELECTED_STATE') {
            hqs = event.data.params.hqs;
            startDate = event.data.params.startDate;
            endDate = event.data.params.endDate;
            console.debug('Got hqs: ' + hqs);
            console.debug('Got start: ' + startDate);
            console.debug('Got end: ' + endDate);

        } else if (event.data.type === 'LH_RESPONSE_HELI_PARAMS') {
            var params = event.data.params;
            requestLayerUpdate('helicopters', params);

        } else if (event.data.type === 'LH_RESPONSE_TRANSPORT_KEY') {

            var sessionKey = 'lighthouseTransportApiKeyCache';
            var transportApiKeyCache = event.data.key;

            console.debug('got transport key: ' + transportApiKeyCache);
            sessionStorage.setItem(sessionKey, transportApiKeyCache);
            fetchTransportResourceWithKey(transportApiKeyCache, event.data.layer);
        }
    }
}, false);
