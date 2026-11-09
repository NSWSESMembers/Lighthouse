// This background script is initialised and executed once and exists
// separate to all other pages.

import { installSharedSelection, SHARE_ACCESS_MESSAGE } from './shared/cadenceSimulationShare.js';

// CADence simulated exercises: lets Beacon pages read the exercise chosen on
// the CADence Simulated Exercise page (shared/cadenceSimulationShare.js).
const simulatedExerciseShareReady = installSharedSelection();

// Check whether new version is installed
// chrome.runtime.onInstalled.addListener(function(details){
//     const reason = details.reason
//        switch (reason) {
//           case 'install':
//              console.log('New User installed the extension.')
//              chrome.tabs.create({ url: 'https://lighthouse.ses.nsw.gov.au/#whatsnew' });
//              break;
//           case 'update':
//              console.log('User has updated their extension.')
//              chrome.tabs.create({ url: 'https://lighthouse.ses.nsw.gov.au/#whatsnew' });
//              break;
//           case 'chrome_update':
//           case 'shared_module_update':
//           default:
//              console.log('Other install events within the browser')
//              break;
//        }
// });

//Sit Aware Map Data Feeds
const rfsMajorIncidentsFeed =
  'https://www.rfs.nsw.gov.au/feeds/majorIncidents.json';
const transportFeed = 'https://api.transport.nsw.gov.au/';
const openSkyFeed = 'https://opensky-network.org/api/states/all';
const adsbFeed = "https://api.adsb.lol/v2/hex/"
const hazardWatchTrainingUrl = 'https://training.hazardwatch.gov.au/feed/v1/nswses-cap-au-active-warnings.geojson';
const hazardWatchUrl = 'https://hazardwatch.gov.au/feed/v1/nswses-cap-au-active-warnings.geojson ';

//external libs

var activeTabForTaskingRemote = null

// Load from storage on startup
chrome.storage.local.get(['activeTabForTaskingRemote']).then((res) => {
  if (res.activeTabForTaskingRemote) {
    activeTabForTaskingRemote = res.activeTabForTaskingRemote;
    console.log("Loaded activeTabForTaskingRemote from storage:", activeTabForTaskingRemote);
  }
});

//Catch nativation changes in REACT app myAvailability
//CAUTION - DONT USE INJECTS HERE AS THEY WILL STACK UP
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  // Regex for a 36-char UUID (8-4-4-4-12 hex digits)
  const uuidRegex = /[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}/;

  // Match only the exact path “/requests/out-of-area-activations/<UUID>”
  const activationPathRegex = new RegExp(`^/requests/out-of-area-activations/${uuidRegex.source}$`);

  try {
    const { pathname } = new URL(details.url);
    if (activationPathRegex.test(pathname)) {
      chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ["myAvailability/contentscripts/requests/out-of-area-activations.js"]
      });
    }
  } catch (e) {
    // invalid URL — skip
  }

  // Match only the exact path “/messages?”
  const messagesPathRegex = new RegExp(`^/messages(.*)$`);

  try {
    const { pathname } = new URL(details.url);
    if (messagesPathRegex.test(pathname)) {
      chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ["myAvailability/contentscripts/messages/messages.js"]
      });
    }
  } catch (e) {
    // invalid URL — skip
  }


});


chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type === SHARE_ACCESS_MESSAGE) {
    // A content script found session storage closed: answer once it's open.
    simulatedExerciseShareReady.then(() => sendResponse({ ok: true }));
    return true;
  } else if (request.type === 'rfs') {
    fetchRfsIncidents(function (data) {
      sendResponse(data);
    });
    return true;
  } else if (request.type === 'transport-incidents') {
    fetchTransportResource(
      'v1/live/hazards/incident/open',
      function (data) {
        sendResponse(data);
      },
      request.params.apiKey,
    );
    return true;
  } else if (request.type === 'transport-flood-reports') {
    fetchTransportResource(
      'v1/live/hazards/flood/open',
      function (data) {
        sendResponse(data);
      },
      request.params.apiKey,
    );
    return true;
  } else if (request.type === 'transport-local-reports') {
    fetchTransportResource(
      'v1/live/hazards/regional-lga-incident/open',
      function (data) {
        sendResponse(data);
      },
      request.params.apiKey,
    );
    return true;
  }  else if (request.type === 'transport-cameras') {
    fetchTransportResource(
      'v1/live/cameras',
      function (data) {
        sendResponse(data);
      },
      request.params.apiKey,
    );
    return true;
  } else if (request.type === 'helicopters') {
    fetchHelicopterLocations(request.params, function (data) {
      sendResponse(data);
    });
    return true;
  } else if (request.type === 'adsb') {
    fetchAdsbLocations(request.params, function (data) {
      sendResponse(data);
    });
    return true;
  } else if (request.type === 'hazard-watch') {
    fetchHazardWatch(function (data) {
      sendResponse(data);
    });
    return true;
  } else if (request.type === 'hazard-watch-training') {
    fetchTrainingHazardWatch(function (data) {
      sendResponse(data);
    });
    return true;
  } else if (request.type === 'myAvailabilityOOAACSV') {
    pullmyAvailOOAACSV(request.url, function (data) {
      sendResponse(data);
    });
    return true;
  } else if (request.type === 'tasking-register-for-remote') {
    activeTabForTaskingRemote = sender.tab.id
    console.log("Registered tab for tasking remote:", activeTabForTaskingRemote)
    chrome.storage.local.set({ activeTabForTaskingRemote }).then(() => {
      console.log("activeTabForTaskingRemote saved to storage");
    });
    return true;
  } else if (request.type === 'tasking-openURL') {
    console.log("Sending tasking remote command to tab:", activeTabForTaskingRemote)
    if (activeTabForTaskingRemote == sender.tab.id) {
      console.log("Refusing to send tasking remote command to same tab that sent it")
      sendResponse({ error: 'Cannot send tasking remote command to same tab that sent it' });
      return true;
    }
    if (activeTabForTaskingRemote == null) {
      console.log("Remote tab is null")
      sendResponse({ error: 'No remote tab registered' });
      return true;
    }
    chrome.tabs.update(activeTabForTaskingRemote, { url: request.url }, function () {
      if (chrome.runtime.lastError) {
        console.error("Error sending tasking remote command:", chrome.runtime.lastError);
        sendResponse({ error: 'Failed to send tasking remote command', message: chrome.runtime.lastError.message });
      } else {
        console.log("Tasking remote command sent");
        sendResponse({ success: true });
      }
    });
    return true;
  }
});


/**
 * Fetches myAvail OOAA CSV Lists
 *
 * @param url url on S3
 */
function pullmyAvailOOAACSV(url, cb) {
  fetch(url, {
    headers: {
      'Accept': 'application/octet-stream',
    }
  }).then(response => response.text())
    .then((text) => {
      cb(text)
    });
}

/**
 * Fetches the current RFS incidents from their JSON feed.
 *
 * @param callback the callback to send the data to.
 */
function fetchRfsIncidents(callback) {
  console.info('fetching RFS incidents');

  fetch(rfsMajorIncidentsFeed).then((resp) => {
    if (resp.ok) {
      resp.json().then((json) => {
        console.log('sending back rfs incidents')
        callback(json)
      })
    } else {
      // error
      var response = {
        error: 'Request failed',
        httpCode: 'resp not ok',
      };
      callback(response);
    }
  }).catch(() => {
    // error
    var response = {
      error: 'Request failed',
      httpCode: 'fetch error',
    };
    callback(response);
  })
}

/**
 * Fetches a resource from the transport API.
 *
 * @param path the path to the resource, e.g. ''.
 * @param callback the callback to send the data to.
 * @param apiKey the transport.nsw.gov.au API key.
 */
function fetchTransportResource(path, callback, apiKey) {
  console.info('fetching transport resource: ' + path);

  fetch(`${transportFeed}${path}`, {
    headers: {
      "Authorization": `apikey ${apiKey}`,
    },
  }).then((resp) => {
    if (resp.ok) {
      resp.json().then((json) => {
        console.log('sending back transport resource')
        callback(json)
      })
    } else {
      // error
      var response = {
        error: 'Request failed',
        httpCode: 'resp not ok',
      };
      callback(response);
    }
  }).catch(() => {
    // error
    var response = {
      error: 'Request failed',
      httpCode: 'fetch error',
    };
    callback(response);
  })
}

/**
 * Fetches the current rescue helicopter locations.
 *
 * @param params the HTTP URL parameters to add.
 * @param callback the callback to send the data to.
 */
function fetchHelicopterLocations(params, callback) {
  console.info('fetching helicopter locations');

  fetch(`${openSkyFeed}${params}`)
    .then((resp) => {
      if (resp.ok) {
        resp.json().then((json) => {
          console.info('sending back helicopter locations');
          callback(json);
        });
      } else {
        // error
        var response = {
          error: 'Request failed',
          httpCode: 'error',
        };
        callback(response);
      }
    })
    .catch(() => {
      // error
      var response = {
        error: 'Request failed',
        httpCode: 'error',
      };
      callback(response);
    });
}

/**
 * Fetches the current rescue helicopter locations via ADSB API.
 *
 * @param params the HTTP URL parameters to add.
 * @param callback the callback to send the data to.
 */
function fetchAdsbLocations(params, callback) {
  fetch(`${adsbFeed}${params}`)
    .then((resp) => {
      if (resp.ok) {
        resp.json().then((json) => {
          callback(json);
        });
      } else {
        // error
        var response = {
          error: 'Request failed',
          httpCode: 'error',
        };
        callback(response);
      }
    })
    .catch(() => {
      // error
      var response = {
        error: 'Request failed',
        httpCode: 'error',
      };
      callback(response);
    });
}

/**
 * Fetches the hazard watch.
 *
 * @param callback the callback to send the data to.
 */
function fetchHazardWatch(callback) {
  console.info('fetching hazard watch');
  fetch(hazardWatchUrl)
    .then((resp) => {
      if (resp.ok) {
        resp.json().then((json) => {
          console.info('sending hazard watch');
          callback(json);
        });
      } else {
        // error
        var response = {
          error: 'Request failed',
          httpCode: 'error',
        };
        callback(response);
      }
    })
    .catch(() => {
      // error
      var response = {
        error: 'Request failed',
        httpCode: 'error',
      };
      callback(response);
    });
}

/**
 * Fetches the hazard watch training data.
 *
 * @param callback the callback to send the data to.
 */
function fetchTrainingHazardWatch(callback) {
  console.info('fetching hazard watch training data');
  fetch(hazardWatchTrainingUrl)
    .then((resp) => {
      if (resp.ok) {
        resp.json().then((json) => {
          callback(json);
        });
      } else {
        // error
        var response = {
          error: 'Request failed',
          httpCode: 'error',
        };
        callback(response);
      }
    })
    .catch(() => {
      // error
      var response = {
        error: 'Request failed',
        httpCode: 'error',
      };
      callback(response);
    });
}
