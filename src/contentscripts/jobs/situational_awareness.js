const $ = require('jquery');
const DOM = require('jsx-dom-factory');
const moment = require('moment');
const inject = require('../../../lib/inject.js');
const LighthouseTeam = require('../../../pages/lib/shared_team_code.js');

//inject the coded needed to fix visual problems
//needs to be injected so that it runs after the DOMs are created
inject('jobs/situational_awareness.js');

const lighthouseIcon = chrome.extension.getURL('icons/lh-black.png');
const teamIcon = chrome.extension.getURL('icons/bus.png');
const helicopterIcon = chrome.extension.getURL('icons/helicopter.png');
const rfsIcon = chrome.extension.getURL('icons/rfs_emergency.png');
const lhqIcon = chrome.extension.getURL('icons/ses.png');
const rmsIcon = chrome.extension.getURL('icons/rms.png');
const rfscorpIcon = chrome.extension.getURL('icons/rfs.png');

var token = null;

// Add the buttons for the extra layers
$(<li id="lhlayers">
    <a href="#" class="js-sub-menu-toggle">
        <img src={lighthouseIcon} style="width:14px;vertical-align:top;margin-right:10px;float:left" />
        <span class="text">Lighthouse</span>
        <i class="toggle-icon fa fa-angle-left"></i>
    </a>
    <ul class="sub-menu ">
        <li>
            <a class="js-sub-sub-menu-toggle" href="#">
                <img src={rmsIcon} style="margin-top:4px;width:14px;vertical-align:top;margin-left:-12px;float:left" />
                <span class="text toggle-tag-text">Roads and Maritime Services</span>
            </a>
            <ul class="sub-sub-menu">
                <li class="clearfix">
                    <span id="toggleRmsIncidentsBtn" class="label tag tag-lh-filter tag-disabled">
                        <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src="https://www.livetraffic.com/images/icons/hazard/traffic-incident.gif" />
                        <span class="tag-text">RMS Incidents</span>
                    </span>
                    <span id="toggleRmsFloodingBtn" class="label tag tag-lh-filter tag-disabled">
                        <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src="https://www.livetraffic.com/images/icons/hazard/weather-flood.gif" />
                        <span class="tag-text">RMS Flood Reports</span>
                    </span>
                    <span id="toggleRmsCamerasBtn" class="label tag tag-lh-filter tag-disabled">
                        <img style="max-width: 16px; background: #fff;vertical-align: top;margin-right: 4px;" src="https://www.livetraffic.com/images/icons/traffic-conditions/traffic-web-camera.gif" />
                        <span class="tag-text">RMS Cameras</span>
                    </span>
                </li>
            </ul>
        </li>
        <li>
            <a class="js-sub-sub-menu-toggle" href="#">
                <img src={rfscorpIcon} style="width:14px;vertical-align:top;margin-left:-12px;float:left" />
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
                <i class="toggle-icon-sub fa fa-bell"></i>
                <span class="text toggle-tag-text">Other</span>
            </a>
            <ul class="sub-sub-menu">
                <li class="clearfix">
                    <span id="toggleSesTeamsBtn" class="label tag tag-lh-filter tag-disabled">
                        <img style="max-width: 16px; background: #fff;vertical-align: top;margin-right: 4px;" src={teamIcon} />
                        <span class="tag-text">SES Team Locations</span>
                    </span>
                    <span id="toggleHelicoptersBtn" class="label tag tag-lh-filter tag-disabled">
                        <img style="max-width: 16px; background: #fff;vertical-align: top;margin-right: 4px;" src={helicopterIcon} />
                        <span class="tag-text">Rescue Helicopters</span>
                    </span>
                    <span id="togglelhqsBtn" class="label tag tag-lh-filter tag-disabled">
                        <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src={lhqIcon} />
                        <span class="tag-text">SES LHQs</span>
                    </span>
                    <span id="togglePowerOutagesBtn" class="label tag tag-lh-filter tag-disabled">
                        <span class="glyphicon glyphicon-flash" aria-hidden="true"></span>
                        <span class="tag-text">Power Outages</span>
                    </span>
                </li>
            </ul>
        </li>
    </ul>
</li>).appendTo('#currentSituationLayers');

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
    $.getJSON( chrome.extension.getURL('resources/SES_HQs.geojson'), function( data ) {
        passLayerDataToInject('lhqs',data)
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

    let hqs = [];
    let host = location.origin;

    // Grab the last 30 days
    let start = new Date();
    start.setDate(start.getDate() - 30);
    let end = new Date();
    let statusTypes = [3]; // Only get activated teams

    LighthouseTeam.get_teams(hqs, host, start, end, token, function(teams) {

        // Make a promise to collect all the team details in promises
        new Promise((mainResolve) => {
            let promises = [];

            teams.Results.forEach(function (team) {

                // Create a promise for this team to check its tasking and details
                promises.push(new Promise((resolve) => {
                    LighthouseTeam.get_tasking(team.Id, host, token, function (teamTasking) {
                        let latestTasking = null;
                        let latestTime = null;

                        // Find the latest tasking
                        teamTasking.Results.forEach(function (task) {
                            let rawStatusTime = new Date(task.CurrentStatusTime);
                            let taskTime = new Date(rawStatusTime.getTime());

                            // it wasn't an un-task or a tasking (so its a action the team made like on route or onsite)
                            if (latestTime < taskTime && task.CurrentStatus !== "Tasked" && task.CurrentStatus !== "Untasked") {
                                latestTasking = task;
                                latestTime = taskTime;
                            }
                        });

                        // If valid tasking was found, add that into a geoJson feature
                        if (latestTasking !== null) {
                            let feature = {
                                'type': 'Feature',
                                'geometry': {
                                    'type': 'Point',
                                    'coordinates': [
                                        latestTasking.Job.Address.Longitude,
                                        latestTasking.Job.Address.Latitude
                                    ]
                                },
                                'properties': {
                                    'teamId': latestTasking.Team.Id,
                                    'teamCallsign': latestTasking.Team.Callsign,
                                    'onsite': latestTasking.Onsite,
                                    'offsite': latestTasking.Offsite,
                                    'currentStatusTime': latestTasking.CurrentStatusTime,
                                    'jobId': latestTasking.Job.Id,
                                }
                            };

                            if (latestTasking.PrimaryTaskType) {
                                feature.properties.primaryTask = latestTasking.PrimaryTaskType.Name;
                            }

                            resolve(feature);
                        }

                        // No relevant tasking for this team
                        resolve(null);
                    });
                }));
            });

            mainResolve(promises);

        }).then((promises) => {

            // Wait for all the team tasking promises to complete
            Promise.all(promises).then(function (features) {

                let geoJson = {
                    'type': 'FeatureCollection',
                    'features': []
                };

                // Collect all non-null features
                features.forEach(function (feature) {
                    if (feature) {
                        geoJson.features.push(feature);
                    }
                });

                console.debug('Found ' + geoJson.features.length + ' teams');
                passLayerDataToInject('ses-teams', geoJson);

            }, function (error) {
                passLayerDataToInject('ses-teams', error);
            });
        });
    }, statusTypes);
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
        window.postMessage({ type: 'LH_GET_TRANSPORT_KEY', layer: layer }, '*');
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
    var params = { apiKey: apiKey };
    requestLayerUpdate(layer,params)
}


/**
 * Sends a request to the background script to get the latest helicopter positions.
 */
 function requestHelicoptersLayerUpdate() {
    console.debug('updating transport incidents layer');
    var params = '';
    window.postMessage({ type: 'LH_REQUEST_HELI_PARAMS' }, '*');
}


/**
 * Sends a message to the background script with layer name and params.
 * background should reply with a data set or error. reply of data is forwarded
 * to a function to the injected script to be used.
 * @param layer the layer to fetch.
 * @param params an API key or something needed to fetch the resource.
 */
function requestLayerUpdate(layer,params = {}) {
    chrome.runtime.sendMessage({type: layer, params: params}, function (response) {
        if (response.error) {
            console.error(`Update to ${type} failed: ${response.error} http-code:${response.httpCode}`);
        } else {
            passLayerDataToInject(layer,response)
        }
    });
}

/**
 * Sends a message to the injected script with layer name and data.
 * dont expect a response.
 * @param layer the layer to own the data.
 * @param response the data to use.
 */
function passLayerDataToInject(layer,response) {
    window.postMessage({type: 'LH_UPDATE_LAYERS_DATA', layer: layer, response: response}, '*');
}


window.addEventListener('message', function(event) {
    // We only accept messages from background
    if (event.source !== window)
        return;

    if (event.data.type) {
        if (event.data.type === 'LH_USER_ACCESS_TOKEN') {
            token = event.data.token;
            console.debug('Got access-token: ' + token);

        } else if (event.data.type === 'LH_RESPONSE_HELI_PARAMS') {
            var params = event.data.params;
            requestLayerUpdate('helicopters',params);

        } else if (event.data.type === 'LH_RESPONSE_TRANSPORT_KEY') {

            var sessionKey = 'lighthouseTransportApiKeyCache';
            var transportApiKeyCache = event.data.key;

            console.debug('got transport key: ' + transportApiKeyCache);
            sessionStorage.setItem(sessionKey, transportApiKeyCache);
            fetchTransportResourceWithKey(transportApiKeyCache, event.data.layer);
        }
    }
}, false);
