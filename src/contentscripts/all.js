if (location.origin.indexOf("beacon.ses.nsw.gov.au") != -1)
{
  var inject = require('../../lib/inject.js');
  var $ = require('jquery');
  var DOM = require('jsx-dom-factory');
  var LighthouseChrome = require('../../pages/lib/shared_chrome_code.js');



  // inject JS that is to run on every page in page context
  inject('all.js');

// inject all.css - browserify-css takes care of this
require('../styles/all.css');

//set the extension code var into the head
var s = document.createElement('script');
s.setAttribute('type', 'text/javascript');
s.innerHTML = "var lighthouseUrl = \"" + chrome.extension.getURL("") + "\";\n var lighthouseEnviroment = \"" +(chrome.manifest.name.includes("Development") ? "Development" : "Production")+"\";\n";

(document.head || document.documentElement).appendChild(s)


window.addEventListener("message", function(event) {
  // We only accept messages from ourselves or the extension
  if (event.source != window)
    return;
  if (event.data.type && (event.data.type == "FETCH_COLLECTION")) {
    chrome.storage.sync.get([event.data.name+'-'+location.hostname], function (data){ //append hostname so that storage is specific to host (trainbeacon/production/preview)
      window.postMessage({type: 'RETURN_COLLECTION', name: event.data.name, dataresult: data[event.data.name+'-'+location.hostname]}, '*'); //return object can be removed (name+lostname)
    })
  } else if (event.data.type && (event.data.type == "SAVE_COLLECTION")) {
    chrome.storage.sync.get([event.data.name+'-'+location.hostname], function (existingdata){
      try {
        var items = JSON.parse(existingdata[event.data.name+'-'+location.hostname])
      } catch (e)
      {
        var items = []
      }
      items.push(JSON.parse(event.data.newdata))

      chrome.storage.sync.set({[event.data.name+'-'+location.hostname]:JSON.stringify(items)}, function (data){
        window.postMessage({type: 'RETURN_COLLECTION', name: event.data.name, dataresult: JSON.stringify(items)}, '*');

      })
    })
  } else if (event.data.type && (event.data.type == "DELETE_COLLECTION")) {
    chrome.storage.sync.get([event.data.name+'-'+location.hostname], function (existingdata){
      try {
        var items = JSON.parse(existingdata[event.data.name+'-'+location.hostname])
      } catch (e)
      {
        var items = []
      }
      items.forEach(function(item) {
        if (event.data.target == JSON.stringify(item)) {
          items.splice(items.indexOf(item), 1)
        }
      })
      chrome.storage.sync.set({[event.data.name+'-'+location.hostname]:JSON.stringify(items)}, function (data){
        window.postMessage({type: 'RETURN_COLLECTION', name: event.data.name, dataresult: JSON.stringify(items)}, '*');
      })
    })
  } else if (event.data.type && (event.data.type == "PURGE_COLLECTION")) {
    chrome.storage.sync.remove([event.data.name+'-'+location.hostname])
    chrome.storage.local.clear(function() {})
  } else if (event.data.type && (event.data.type == "FROM_PAGE_UPDATE_API_TOKEN")) {
    chrome.storage.local.set({['beaconAPIToken-'+event.data.host]:JSON.stringify({token:event.data.token,expdate:event.data.tokenexp})}, function (){
      console.log('local data set - beaconAPIToken')
    })
  }
}, false);


  $(document).ready(function(){

  // Map Mouse Eating Stopper
  if (location.pathname != "/Jobs/SituationalAwareness") {
    if( ( $map = $('#map') ).length && ('#map_zoom_slider',$map).length ){
      var $mapblock = $(
        <div id="lighthouse_mapblock">
        <div>Click to zoom or move map</div>
        </div>
        );

      $mapblock
      .click(function(e){
        $(this).hide();
        e.stopPropagation();
      });

      $('#map')
      .append($mapblock)
      .mouseleave(function(e) {
        $mapblock.show();
      });
    }
  }

});
}
