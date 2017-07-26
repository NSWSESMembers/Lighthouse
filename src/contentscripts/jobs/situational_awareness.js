const $ = require('jquery');
const inject = require('../../../lib/inject.js');

//inject the coded needed to fix visual problems
//needs to be injected so that it runs after the DOMs are created
inject('jobs/situational_awareness.js');

const lighthouseIcon = chrome.extension.getURL("") + 'icons/lh-black.png';
const helicopterIcon = chrome.extension.getURL("") + 'icons/helicopter.png';
const rfsIcon = chrome.extension.getURL("") + 'icons/rfs_emergency.png';

// Add the buttons for the extra layers
$('#currentSituationLayers')
    .append('<li>\
        <a href="#" class="js-sub-menu-toggle">\
          <img src="' + lighthouseIcon + '" style="width: 16px">\
          <span class="text">Lighthouse</span>\
          <i class="toggle-icon fa fa-angle-left"></i>\
        </a>\
        <ul class="sub-menu ">\
          <li>\
          <div class="text btn-toolbar" role="toolbar">\
            <div>\
              <span id="toggleRfsIncidentsBtn" class="label tag tag-lh-filter tag-disabled">\
                <img style="max-width: 16px" src="' + rfsIcon + '" />\
                <span class="tag-text">RFS</span>\
              </span>\
              <span id="toggleRmsIncidentsBtn" class="label tag tag-lh-filter tag-disabled">\
                <img style="max-width: 16px" src="https://www.livetraffic.com/images/icons/hazard/traffic-incident.gif" />\
                <span class="tag-text">RMS Incidents</span>\
              </span>\
              <span id="toggleRmsFloodingBtn" class="label tag tag-lh-filter tag-disabled">\
                <img style="max-width: 16px" src="https://www.livetraffic.com/images/icons/hazard/weather-flood.gif" />\
                <span class="tag-text">RMS Flood Reports</span>\
              </span>\
              <span id="toggleHelicoptersBtn" class="label tag tag-lh-filter tag-disabled">\
                <img style="max-width: 16px; background: #fff;" src="' + helicopterIcon + '" />\
                <span class="tag-text">Helicopters</span>\
              </span>\
            </div>\
          </div>\
          </li>\
        </ul>\
        </li>');

var pollRfsTimer;
var pollTransportIncidentsTimer;
var pollTransportFloodReportsTimer;
var pollHelicoptersTimer;

/**
 * Registers the click handler on the filter buttons.
 *
 * @param buttonId the button ID.
 * @param layer the map layer to update.
 * @param timer the timer which refreshes the layer.
 * @param updateFunction the update function.
 * @param interval the refresh interval.
 */
function registerClickHandler(buttonId, layer, timer, updateFunction, interval) {
    document.getElementById(buttonId).addEventListener('click',
        function () {
            console.debug(`toggle ${buttonId} clicked`);

            var button = $(`#${buttonId}`);
            var disabled = button.hasClass('tag-disabled');

            if (disabled) {
                updateFunction();
                timer = setInterval(updateFunction, interval);
                button.removeClass('tag-disabled');
            } else {
                clearInterval(timer);
                window.postMessage({type: 'LH_CLEAR_LAYER_DATA', layer: layer}, '*');
                button.addClass('tag-disabled');
            }
        }, false);
}

registerClickHandler('toggleRfsIncidentsBtn', 'rfs', pollRfsTimer, requestRfsLayerUpdate, 5 * 60000); // every 5 mins
registerClickHandler('toggleRmsIncidentsBtn', 'transport-incidents', pollTransportIncidentsTimer, requestTransportIncidentsLayerUpdate, 5 * 60000); // every 5 mins
registerClickHandler('toggleRmsFloodingBtn', 'transport-flood-reports', pollTransportFloodReportsTimer, requestTransportFloodReportsLayerUpdate, 5 * 60000); // every 5 mins
registerClickHandler('toggleHelicoptersBtn', 'helicopters', pollHelicoptersTimer, requestHelicoptersLayerUpdate, 10000); // every 10s

/**
 * Sends a request to the background script to get the latest RFS incidents.
 */
function requestRfsLayerUpdate() {
    console.debug('updating RFS layer');
    window.postMessage({ type: 'LH_UPDATE_LAYERS', layer: 'rfs' }, '*');
}

/**
 * Sends a request to the background script to get the latest transport incidents.
 */
function requestTransportIncidentsLayerUpdate() {
    console.debug('updating transport incidents layer');
    window.postMessage({ type: 'LH_UPDATE_LAYERS', layer: 'transport-incidents' }, '*');
}

/**
 * Sends a request to the background script to get the latest transport flood reports.
 */
function requestTransportFloodReportsLayerUpdate() {
    console.debug('updating transport incidents layer');
    window.postMessage({ type: 'LH_UPDATE_LAYERS', layer: 'transport-flood-reports' }, '*');
}

/**
 * Sends a request to the background script to get the latest helicopter positions.
 */
function requestHelicoptersLayerUpdate() {
    console.debug('updating transport incidents layer');
    var params = '';
    window.postMessage({ type: 'LH_REQUEST_HELI_PARAMS' }, '*');
}

window.addEventListener('message', function(event) {
    // We only accept messages from ourselves
    if (event.source !== window)
        return;

    if (event.data.type) {
        if (event.data.type === 'LH_RESPONSE_HELI_PARAMS') {
            var params = event.data.params;
            window.postMessage({ type: 'LH_UPDATE_LAYERS', layer: 'helicopters', params: params }, '*');

        } else if (event.data.type === 'LH_UPDATE_LAYERS') {
            var layer = event.data.layer;
            chrome.runtime.sendMessage({type: layer, params: event.data.params}, function (response) {
                if (response.error) {
                    console.error(`Update to ${type} failed: ${response.error} http-code:${response.httpCode}`);
                } else {
                    window.postMessage({type: 'LH_UPDATE_LAYERS_DATA', layer: layer, response: response}, '*');
                }
            });
        }
    }
}, false);