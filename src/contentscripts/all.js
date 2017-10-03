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
    chrome.storage.sync.get([event.data.name], function (data){
      window.postMessage({type: 'RETURN_COLLECTION', name: event.data.name, dataresult: data[event.data.name]}, '*');
    })
  } else if (event.data.type && (event.data.type == "SAVE_COLLECTION")) {
    chrome.storage.sync.get(event.data.name, function (existingdata){
      try {
        var items = JSON.parse(existingdata.lighthouseJobFilterCollections)
      } catch (e)
      {
        var items = []
      }
      items.push(JSON.parse(event.data.newdata))

      chrome.storage.sync.set({[event.data.name]:JSON.stringify(items)}, function (data){
        window.postMessage({type: 'RETURN_COLLECTION', name: event.data.name, dataresult: JSON.stringify(items)}, '*');

      })
    })
  } else if (event.data.type && (event.data.type == "DELETE_COLLECTION")) {
    chrome.storage.sync.get([event.data.name], function (existingdata){
      try {
        var items = JSON.parse(existingdata[event.data.name])
      } catch (e)
      {
        var items = []
      }

      items.forEach(function(item) {
        if (event.data.target == JSON.stringify(item)) {
          items.splice(items.indexOf(item), 1)
        }
      })
      chrome.storage.sync.set({[event.data.name]:JSON.stringify(items)}, function (data){
        window.postMessage({type: 'RETURN_COLLECTION', name: event.data.name, dataresult: JSON.stringify(items)}, '*');
      })
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
