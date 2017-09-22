const MapManager = require('../../../pages/lib/map/InjectScriptMapManager.js');

window.addEventListener('load', pageFullyLoaded, false);

function pageFullyLoaded(e) {
    //hide the maximize button
    let max = document.getElementsByClassName('titleButton maximize');
    max[0].classList.add('hidden');

    let mapManager = new MapManager();
    mapManager.initialise(contentViewModel.filterViewModel);
}

// Instance the tour
require('bootstrap-tour')

var tour = new Tour({
  name: "LHTourSituationalAwareness",
  smartPlacement: true,
  placement: "right",
  steps: [
  {
    element: "",
    placement: "top",
    orphan: true,
    backdrop: true,
    title: "Lighthouse Welcome",
    onNext: function (tour) {
      $('#lhquickfilter > ul').show();
  },
  content: "Lighthouse has made some changes to this page. would you like a tour?"
},
{
    element: "#lhquickfilter",
    title: "Lighthouse Quickfilters",
    placement: "right",
    backdrop: false,
    onNext: function (tour) {
      $('#lhquickfilter > ul').hide();
      $('#lhlayers > ul').show();
  },
  content: "Lighthouse adds a new filter menu that groups together common filters.eg 'Rescue Jobs' covers RCR, Flood, and VR.",
},
{
    element: "#lhlayers",
    title: "Lighthouse Layers",
    placement: "right",
    backdrop: false,
    onNext: function (tour) {
      $('#lhlayers > ul').hide();
  },
  content: "Lighthouse adds a number of new map layers. These layers will add icons to the map which can be clicked for further information.",
},
{
    element: "",
    placement: "top",
    orphan: true,
    backdrop: true,
    title: "Questions?",
    content: "Thats about it. If you have any questions please seek help from the 'About Lighthout' button under the lighthouse menu on the top menu"
},
]
})

    /// Initialize the tour
    tour.init();

// Start the tour
tour.start();
