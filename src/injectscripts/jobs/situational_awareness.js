const MapManager = require('../../../lib/map/InjectScriptMapManager.js');

window.addEventListener('load', pageFullyLoaded, false);

function pageFullyLoaded(e) {
    //hide the maximize button
    let max = document.getElementsByClassName('titleButton maximize');
    max[0].classList.add('hidden');

    let mapManager = new MapManager();
    mapManager.initialise(contentViewModel.filterViewModel);
}
