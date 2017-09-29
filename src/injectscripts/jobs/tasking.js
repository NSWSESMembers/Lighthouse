const MapManager = require('../../../pages/lib/map/InjectScriptMapManager.js');

window.addEventListener('load', pageFullyLoaded, false);

function pageFullyLoaded(e) {
    let mapManager = new MapManager();
    mapManager.initialise(filterViewModel);
}
