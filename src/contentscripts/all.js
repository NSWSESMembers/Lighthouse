if (location.origin.indexOf("beacon.ses.nsw.gov.au") != -1) {
  var inject = require('../lib/inject.js');
  var $ = require('jquery');
  require('../pages/lib/shared_chrome_code.js');

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  var DOM = require('jsx-dom-factory').default;


  let version = 'v' + chrome.manifest.version_name + ' ' + (chrome.manifest.name.includes("Development") ? "Development" : "Production")

  console.log(`%c Lighthouse extension ${version} version`, "color: #ffffff; background: #363636; padding: 0 3px;");


  // inject JS that is to run on every page in page context
  inject('all.js');

  // inject all.css - browserify-css takes care of this
  require('../styles/all.css');

  //set the extension code var into the head
  // var s = document.createElement('script');
  // s.setAttribute('type', 'text/javascript');
  // s.innerHTML = "var lighthouseUrl = \"" + chrome.runtime.getURL("") + "\";\n var lighthouseEnviroment = \"" +(chrome.manifest.name.includes("Development") ? "Development" : "Production")+"\";\n";
  //(document.head || document.documentElement).appendChild(s)



  window.addEventListener("message", function (event) {
    // We only accept messages from ourselves or the extension
    if (event.source != window)
      return;
    if (event.data.type && (event.data.type == "LIGHTHOUSE_URL")) {
      window.postMessage({ type: 'RETURN_LIGHTHOUSE_URL', url: chrome.runtime.getURL(""), lighthouseEnviroment: (chrome.manifest.name.includes("Development") ? "Development" : "Production") })
    } else if (event.data.type && (event.data.type == "FETCH_COLLECTION")) {
      chrome.storage.sync.get([event.data.name + '-' + location.hostname], function (data) { //append hostname so that storage is specific to host (trainbeacon/production/preview)
        window.postMessage({ type: 'RETURN_COLLECTION', name: event.data.name, dataresult: data[event.data.name + '-' + location.hostname] }, '*'); //return object can be removed (name+lostname)
      })
    } else if (event.data.type && (event.data.type == "SAVE_COLLECTION")) {
      chrome.storage.sync.get([event.data.name + '-' + location.hostname], function (existingdata) {
        let items;
        try {
          items = JSON.parse(existingdata[event.data.name + '-' + location.hostname])
        } catch (e) {
          items = []
        }
        items.push(JSON.parse(event.data.newdata))

        chrome.storage.sync.set({ [event.data.name + '-' + location.hostname]: JSON.stringify(items) }, function (_data) {
          window.postMessage({ type: 'RETURN_COLLECTION', name: event.data.name, dataresult: JSON.stringify(items) }, '*');

        })
      })
    } else if (event.data.type && (event.data.type == "DELETE_COLLECTION")) {
      chrome.storage.sync.get([event.data.name + '-' + location.hostname], function (existingdata) {
        let items;
        try {
          items = JSON.parse(existingdata[event.data.name + '-' + location.hostname])
        } catch (e) {
          items = []
        }
        items.forEach(function (item) {
          if (event.data.target == JSON.stringify(item)) {
            items.splice(items.indexOf(item), 1)
          }
        })
        chrome.storage.sync.set({ [event.data.name + '-' + location.hostname]: JSON.stringify(items) }, function (_data) {
          window.postMessage({ type: 'RETURN_COLLECTION', name: event.data.name, dataresult: JSON.stringify(items) }, '*');
        })
      })
    } else if (event.data.type && (event.data.type == "PURGE_COLLECTION")) {
      chrome.storage.sync.remove([event.data.name + '-' + location.hostname])
      chrome.storage.local.clear(function () {
        // do nothing
      });
    } else if (event.data.type && (event.data.type == "FROM_PAGE_UPDATE_API_TOKEN")) {
      chrome.storage.local.set({ ['beaconAPIToken-' + event.data.host]: JSON.stringify({ token: event.data.token, expdate: event.data.tokenexp }) }, function () {
        console.log('local data set - beaconAPIToken');
      })
    } else if (event.data.type && (event.data.type == "FROM_PAGE_REGISTER_TASKING_REMOTE")) {
      chrome.runtime.sendMessage({ type: 'tasking-register-for-remote' }, function () {
        console.log('Registered tab for Tasking Remote Control');
      });
    }
  }, false);


  $(document).ready(function () {

    // Map Mouse Eating Stopper
    if (location.pathname != "/Jobs/SituationalAwareness") {
      let $map;
      if (($map = $('#map')).length && ('#map_zoom_slider', $map).length) {
        var $mapblock = $(
          <div id="lighthouse_mapblock">
            <div>Click to zoom or move map</div>
          </div>
        );

        $mapblock
          .click(function (e) {
            $(this).hide();
            e.stopPropagation();
          });

        $('#map')
          .append($mapblock)
          .mouseleave(function (_e) {
            $mapblock.show();
          });
      }
    }

  });
}
