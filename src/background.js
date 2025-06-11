// This background script is initialised and executed once and exists
// separate to all other pages.

var tj = require('@tmcw/togeojson');
var DOMParser = require('xmldom').DOMParser;

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
const essentialEnergyOutagesFeed =
  'https://www.essentialenergy.com.au/Assets/kmz/current.kml';
const endeavourEnergyOutagesFeed =
  'https://www.endeavourenergy.com.au/designs/connectors/outage-feeds/get-current-outage';
const ausgridBaseUrl = 'https://www.ausgrid.com.au/';
const hazardWatchUrl = 'https://feed.firesnearme.hazards.rfs.nsw.gov.au/';
//external libs


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
  if (request.type === 'asbestos') {
    checkAsbestosRegister(
      request.address,
      function (result, colour, bool, url) {
        sendResponse({
          result: result,
          colour: colour,
          resultbool: bool,
          requrl: url,
        });
      },
    );
    return true;
  } else if (request.type === 'API_TOKEN_UPDATE') {
    let key = 'beaconAPIToken-' + request.host;
    chrome.storage.local
      .set({ key: JSON.stringify(request.token) })
      .then(() => {
        console.log(key + ' is set');
      });
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
  } else if (request.type === 'transport-cameras') {
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
  } else if (request.type === 'power-outages') {
    fetchPowerOutages(function (data) {
      sendResponse(data);
    });
    return true;
  } else if (request.type === 'hazard-watch') {
    fetchHazardWatch(function (data) {
      sendResponse(data);
    });
    return true;
  } else if (request.type === 'myAvailabilityOOAACSV') {
    pullmyAvailOOAACSV(request.url, function (data) {
      sendResponse(data);
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
  fetch(url, { headers: {
    'Accept': 'application/octet-stream',
  }}).then(response => response.text())
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

  fetch(`${transportFeed}${path}`,{
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
 * Fetches the hazard watch.
 *
 * @param params the HTTP URL parameters to add.
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
 * Fetches the current power outage details.
 *
 * @param callback the callback to send the data to.
 */
function fetchPowerOutages(callback) {
  console.info('fetching power outage locations');
  var finalData = {};

  fetchEssentialEnergyOutages(function (essentialEnergyData) {
    finalData.essential = essentialEnergyData;
    merge('EssentialEnergy');
  });

  fetchEndeavourEnergyOutages(function (endeavourEnergyData) {
    finalData.endeavour = endeavourEnergyData;
    merge('EndeavourEnergy');
  });

  fetchAusgridOutages(function (AusgridData) {
    finalData.ausgrid = AusgridData;
    merge('Ausgrid');
  });

  function merge(name) {
    console.log(
      name + ' is back,' + 'checking if all power outage data is back',
    );
    if (finalData.essential && finalData.endeavour && finalData.ausgrid) {
      console.log('merging all power outages');
      var merged = {};
      merged.features = [];
      //if you just push you end up with an array of the array not a merged array like you might want.
      merged.features.push.apply(merged.features, finalData.essential.features);
      merged.features.push.apply(merged.features, finalData.endeavour.features);
      merged.features.push.apply(merged.features, finalData.ausgrid.features);
      callback(merged);
    } else {
      console.log('missing some power outage data');
    }
  }
}

/**
 * Fetches the current power outages for Ausgrid.
 *
 * @param callback the callback to send the data to.
 */
function fetchAusgridOutages(callback) {
  console.info('fetching ausgrid power outage locations');


  fetch(`${ausgridBaseUrl}webapi/OutageMapData/GetCurrentUnplannedOutageMarkersAndPolygons?bottomleft.lat=-33.45170&bottomleft.lng=148.76319&topright.lat=-32.56033&topright.lng=153.66859&zoom=9`, {
    method: "GET",
    headers: {
        "Content-Type": "application/json",
      }
  }).then((resp) => {
    if (resp.ok) {
      resp.json().then((result) => {
        let ausgridGeoJson = {
            type: 'FeatureCollection',
            features: [],
          };
    
          result.forEach(function (item) {
            //build up some geojson from normal JSON
            var feature = {};
            feature.geometry = {};
            feature.geometry.type = 'GeometryCollection';
            feature.geometry.geometries = [];
    
            //make a polygon from each set
            var polygon = {};
            polygon.type = 'Polygon';
            polygon.coordinates = [];
    
            var ords = [];
            if (item.Polygons.length > 0) {
              item.Polygons[0].Coords.forEach(function (point) {
                ords.push([point.lng, point.lat]);
              });
              ords.push([
                item.Polygons[0].Coords[0].lng,
                item.Polygons[0].Coords[0].lat,
              ]); //push the first item again at the end to complete the polygon
            }
    
            polygon.coordinates.push(ords);
    
            feature.geometry.geometries.push(polygon);
    
            var point = {};
            point.type = 'Point';
            point.coordinates = [];
            point.coordinates.push(
              item.MarkerLocation.lng,
              item.MarkerLocation.lat,
            );
    
            feature.geometry.geometries.push(point);
    
                  feature.owner = 'Ausgrid';
                  feature.type = 'Feature';
                  feature.properties = {};
                  feature.properties.numberCustomerAffected = item.CustomersAffectedText;
                  feature.properties.incidentId = item.WebId;
                  feature.properties.reason = item.Cause;
                  feature.properties.status = item.Status;
                  feature.properties.type = 'Outage';
                  feature.properties.startDateTime = item.StartDateTime;
                  feature.properties.endDateTime = item.EstRestTime;

                  ausgridGeoJson.features.push(feature);

          });
          callback(ausgridGeoJson);
      })
    } else {
        // error
        var response = {
          error: 'Request failed',
          httpCode: 'error',
        };
        callback(response);
    }
}).catch(() => {
    // error
    var response = {
        error: 'Request failed',
        httpCode: 'error',
      };
      callback(response);
})
}

/**
 * Fetche Ausgrid power outage detail.
 * @param webId web ID
 * @param type OutageDisplayType
 * @param callback the callback to send the data to.
 */
// function fetchAusgridOutage(id, type, callback) {
//   console.info('fetching ausgrid power outage detail');

//   fetch(`${ausgridBaseUrl}webapi/OutageMapData/GetOutage`, {
//     method: "POST",
//     headers: {
//         "Content-Type": "application/json",
//       },
//     body: JSON.stringify({WebId:id,OutageDisplayType: type})
//   }).then((resp) => {
//     if (resp.ok) {
//       resp.json().then((json) => {
//         callback(json)
//       })
//     } else {
//         // error
//         var response = {
//           error: 'Request failed',
//           httpCode: 'error',
//         };
//         callback(response);
//     }
// }).catch(() => {
//     // error
//     var response = {
//         error: 'Request failed',
//         httpCode: 'error',
//       };
//       callback(response);
// })
// }

/**
 * Fetches the current power outages for Endeavour Energy.
 *
 * @param callback the callback to send the geoJSON data to.
 */
function fetchEndeavourEnergyOutages(callback) {
  console.info('fetching endeavour energy power outage locations');

  fetch(endeavourEnergyOutagesFeed)
    .then((resp) => {
      if (resp.ok) {
        resp.json().then((json) => {
          let endeavourGeoJson = {
            type: 'FeatureCollection',
            features: [],
          };
          // Convert the feed to geoJSON
          for (var i = 0; i < json.length; i++) {
            var incident = json[i];
            if (
              new Date() / 1000 - Date.parse(incident.startDateTime) / 1000 <
              30 * 24 * 60
            ) {
              //30 days ago only
              var feature = {
                type: 'Feature',
                owner: 'EndeavourEnergy',
                geometry: {
                  type: 'Point',
                  coordinates: [incident.longitude, incident.latitude],
                },
                properties: {
                  creationDateTime: incident.creationDateTime,
                  endDateTime: incident.endDateTime,
                  incidentId: incident.incidentId,
                  numberCustomerAffected: incident.numberCustomerAffected,
                  outageType: incident.outageType,
                  postcode: incident.postcode,
                  reason: incident.reason,
                  startDateTime: incident.startDateTime,
                  status: incident.status,
                  streetName: incident.streetName,
                  suburb: incident.suburb,
                },
              };

              endeavourGeoJson.features.push(feature);
            }
          }
          callback(endeavourGeoJson);
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
 * Fetches the current power outages for Essential Energy.
 *
 * @param callback the callback to send the geoJSON data to.
 */
function fetchEssentialEnergyOutages(callback) {
  console.info('fetching essential energy power outage locations');
  fetch(essentialEnergyOutagesFeed)
    .then((resp) => {
      if (resp.ok) {
        resp.text().then((txt) => {
          const kml = new DOMParser().parseFromString(txt, 'utf8');
          var essentialGeoJson = tj.kml(kml);
          for (var i = 0; i < essentialGeoJson.features.length; i++) {
            essentialGeoJson.features[i].owner = 'EssentialEnergy';
          }
          callback(essentialGeoJson);
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

function checkAsbestosRegister(inAddressObject, cb) {
  var AddressParts = /^(.+)\s(.+)$/.exec(inAddressObject.Street);
  if (!inAddressObject.Flat) inAddressObject.Flat = '';
  var formAddress =
    'https://www.fairtrading.nsw.gov.au/loose-fill-asbestos-insulation-register?' +
    'unit=' +
    encodeURI(inAddressObject.Flat) +
    '&' +
    'number=' +
    encodeURI(inAddressObject.StreetNumber) +
    '&' +
    'street=' +
    encodeURI(AddressParts[1]) +
    '&' +
    'suburb=' +
    encodeURI(inAddressObject.Locality) +
    '&' +
    'type=' +
    encodeURI(AddressParts[2]) +
    '&';

  console.log('loading cache');
  chrome.storage.local.get(['lighthouseFTCache']).then((ftCache) => {
    console.log(ftCache);

    var needToWriteChange = false;
    if (ftCache.length) {
      //walk the cache and clean it up first

      var foundinCache = false;
      ftCache.forEach(function (item) {
        if (item.url == formAddress) {
          console.log('found url in the cache');
          foundinCache = true;
          console.log(
            'cache is ' +
              (new Date().getTime() - new Date(item.timestamp).getTime()) /
                1000 /
                60 +
              'mins old',
          );
          if (
            (new Date().getTime() - new Date(item.timestamp).getTime()) /
              1000 /
              60 <
            4320
          ) {
            //3 days
            //its in the cache
            console.log('using it');
            processResult(item.result);
          } else {
            //oooooold
            console.log('cached item is stale. fetching new result');
            ftCache.splice(ftCache.indexOf(item), 1); //remove this item from the cache
            needToWriteChange = true;
            pullFTRegister(function (result) {
              if (result != 0) {
                //dont cache error results
                var cacheItem = {};
                cacheItem.url = formAddress;
                cacheItem.timestamp = new Date().toString();
                cacheItem.result = result;
                ftCache.push(cacheItem);
                needToWriteChange = true;
              }
              //return result
              processResult(result);
            });
          }
        } else {
          if (
            (new Date().getTime() - new Date(item.timestamp).getTime()) /
              1000 /
              60 >
            4320
          ) {
            //3 days
            console.log(
              'cleaning stale cache item ' +
                item.url +
                ' age:' +
                (new Date().getTime() - new Date(item.timestamp).getTime()) /
                  1000 /
                  60 +
                'mins old',
            );
            ftCache.splice(ftCache.indexOf(item), 1); //remove this item from the cache
            needToWriteChange = true;
          }
        }
      });

      if (foundinCache == false) {
        console.log('did not find url in the cache');
        pullFTRegister(function (result) {
          if (result != 0) {
            //dont cache error results
            var cacheItem = {};
            cacheItem.url = formAddress;
            cacheItem.timestamp = new Date().toString();
            cacheItem.result = result;
            ftCache.push(cacheItem);
            needToWriteChange = true;
          }
          //return result
          processResult(result);
        });
      }
    } else {
      //there is no cache so make one
      console.log('no cache object. creating a new one');
      ftCache = [];
      pullFTRegister(function (result) {
        if (result != 0) {
          //dont cache error results
          var cacheItem = {};
          cacheItem.url = formAddress;
          cacheItem.timestamp = new Date().toString();
          cacheItem.result = result;
          ftCache.push(cacheItem);
          needToWriteChange = true;
        }
        //return result
        processResult(result);
      });
    }

    //if we never call processResult we should write the changes out here.
    if (needToWriteChange) {
      console.log('writing out lighthouseFTCache');
      localStorage.setItem('lighthouseFTCache', JSON.stringify(ftCache));
    }

    function processResult(result) {
      switch (result) {
        case 0: //error
          console.log('Error searching');
          cb(
            "Error Searching The Asbestos Register<i class='fa fa-external-link' aria-hidden='true' style='margin-left:5px;margin-right:-5px'></i>",
            '',
            false,
            formAddress,
          );
          break;
        case 1: //positive/found
          console.log('On the Register');
          cb(
            inAddressObject.PrettyAddress +
              " was FOUND on the loose fill insulation asbestos register<i class='fa fa-external-link' aria-hidden='true' style='margin-left:5px;margin-right:-5px'></i>",
            'red',
            true,
            formAddress,
          );
          break;
        case 2: //negative/not found
          console.log('Not the Register');
          cb(
            inAddressObject.PrettyAddress + ' was not found on any register.',
            '',
            false,
            formAddress,
          );
          break;
      }
      if (needToWriteChange) {
        needToWriteChange = false;
        console.log('writing out lighthouseFTCache');
        chrome.storage.local
          .set({ lighthouseFTCache: JSON.stringify(ftCache) })
          .then(() => {
            console.log('lighthouseFTCache is set');
          });
      }
    }

    function pullFTRegister(cb) {
      cb(2) //error out until FT fix their register
      // fetch(formAddress)
      //   .then((resp) => {
      //     if (resp.ok) {
      //       resp.text().then((txt) => {
      //         if (
      //           !/No\sMatch\sFound/.test(txt) &&
      //           !/Confirmed\sMatch/.test(txt)
      //         ) {
      //           cb(0); //error
      //         }
      //         if (/Confirmed\sMatch/.test(txt)) {
      //           cb(1); //found
      //         }
      //         if (/No\sMatch\sFound/.test(txt)) {
      //           cb(2); //not found
      //         }
      //       });
      //     } else {
      //       cb(0); //error
      //     }
      //   })
      //   .catch(() => {
      //     cb(0); //fetch error
      //   });
    }

    
  });
}
