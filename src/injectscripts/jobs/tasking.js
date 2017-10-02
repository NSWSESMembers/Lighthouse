const MapManager = require('../../../pages/lib/map/InjectScriptMapManager.js');

window.addEventListener('load', pageFullyLoaded, false);

function pageFullyLoaded(e) {
	if (taskingViewModel.showMap.peek() == false) //dont do map stuff if the map is disabled
	{
		$('#lhlayers').hide();
	} else {
		let mapManager = new MapManager();
		mapManager.initialise(filterViewModel);
	}
}
