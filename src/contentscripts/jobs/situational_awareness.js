const $ = require('jquery');
const DOM = require('jsx-dom-factory').default;
const moment = require('moment');
const inject = require('../../lib/inject.js');
const MapManager = require('../../lib/map/ContentScriptMapManager.js').default;


//inject the coded needed to fix visual problems
//needs to be injected so that it runs after the DOMs are created
inject('jobs/situational_awareness.js');

// Add the buttons for the extra layers
const mapManager = new MapManager();
MapManager.createLayerMenu().appendTo('#currentSituationLayers');
MapManager.asset_filter_modal().appendTo('body');

mapManager.initialise();

//Clear all lighthouse filters when click. A little hacky by changing the button class then calling the click to clear inbuild timers and layers.
//saves recreating functions outside of registerClickHandler
$('input[data-bind="click: clearLayers"]')[0].addEventListener('click',
    function () {
        console.log('resetting lighthouse layers');
        var buttons = ['toggleRfsIncidentsBtn', 'toggleRmsIncidentsBtn', 'toggleRmsFloodingBtn', 'toggleSesFilteredAssetsBtn', 'toggleRmsCamerasBtn', 'toggleHelicoptersBtn', 'togglePowerOutagesBtn', 'togglelhqsBtn', 'toggleSesFilteredAssets'];
        buttons.forEach(function (buttonId) {
            var button = $(`#${buttonId}`);
            button.removeClass('tag-disabled');
            button.trigger('click');
        })
    });