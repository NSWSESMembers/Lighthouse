
window.addEventListener('load', pageFullyLoaded, false);

function pageFullyLoaded(e) {
  whenMapIsReady(function() {
    console.log('map is ready')
    const MapManager = require('../../../lib/map/InjectScriptMapManager.js');
    //hide the maximize button
    let max = document.getElementsByClassName('titleButton maximize');
    max[0].classList.add('hidden');

    let mapManager = new MapManager();
    mapManager.initialise(contentViewModel.filterViewModel);
    })
}


// wait for address to have loaded
function whenMapIsReady(cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
      if (map.loaded)
      {
        console.log("map is ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
  }
}, 200);
}
