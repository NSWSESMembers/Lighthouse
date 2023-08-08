import $ from 'jquery';
import moment from 'moment';

export function filter(assetFilter, host, userId = 'notPassed', token, cb) {
  console.debug('fetching SES Asset Locations with possible filter on result');
  ReturnAssetLocations(host, userId, token, function (response) {
    if (assetFilter.length == 0) {
      //show everything
      cb(response);
    } else {
      //filtered
      var filteredResult = [];
      response.forEach(function (v) {
        if (assetFilter.includes(v.name)) {
          filteredResult.push(v);
        }
      });
      cb(filteredResult);
    }
  });
}

function ReturnAssetLocations(host, userId = 'notPassed', token, cb) {
  console.log('ReturnAssetLocations');
  Promise.all([fetchRadioAssets(host, userId, token), fetchTeleAssets(host, userId, token)]).then(function (res) {
    var response = [];
    res[0].forEach(function (i) {
      // PSN locations
      if (isNaN(i.properties.name)) {
        // hide numerical names that are not setup yet
        i.type = 'psn';
        i.lastSeen = i.properties.lastSeen;
        i.name = `${i.properties.name} (PSN)`;
        i.unitCode = i.properties.name.match(/([a-z]+)/i) ? i.properties.name.match(/([a-z]+)/i)[1] : i.properties.name;
        i.vehCode = i.properties.name.match(/[a-z]+(\d*[a-z]?)/i)
          ? i.properties.name.match(/[a-z]+(\d*[a-z]?)/i)[1]
          : '';
        i.markerLabel = i.properties.name;
        if (i.unitCode && i.vehCode) {
          i.markerLabel = `${i.unitCode}<br>${i.vehCode}`;
        }
        i.entity = i.properties.entity;
        i.capability = i.properties.capability;
        i.resourceType = i.properties.resourceType;
        i.talkGroup = i.properties.talkgroup != null ? i.properties.talkgroup : 'Unknown';
        i.talkGroupLastUpdated =
          i.properties.talkgroupLastUpdated != null ? i.properties.talkgroupLastUpdated : 'Unknown';
        i.licensePlate = i.properties.licensePlate;

        response.push(i);
      }
    });

    res[1].features.forEach(function (i) {
      if (isNaN(i.properties.displayName)) {
        // hide numerical names that are not setup yet
        //Telemetric Locations
        i.type = 'telematics';
        i.lastSeen = moment.unix(i.properties.timestamp).toISOString();
        i.name = `${i.properties.displayName.match(/(^\w*)/g)} (Tele)`;
        i.unitCode = i.properties.displayName.match(/([a-z]+)/i)
          ? i.properties.displayName.match(/([a-z]+)/i)[1]
          : i.properties.displayName;
        i.vehCode = i.properties.displayName.match(/[a-z]+(\d*[a-z]?)/i)
          ? i.properties.displayName.match(/[a-z]+(\d*[a-z]?)/i)[1]
          : '';
        i.markerLabel = i.properties.displayName;
        if (i.unitCode && i.vehCode) {
          i.markerLabel = `${i.unitCode}<br>${i.vehCode}`;
        }
        i.entity = 'N/A';
        i.capability = i.properties.displayName.match(/^\w.* (.*)/g);
        i.resourceType = i.properties.type;
        i.talkGroup = 'N/A';
        i.talkGroupLastUpdated = 'N/A';
        i.licensePlate = 'N/A';
        response.push(i);
      }
    });
    cb && cb(response);
  });
}

function fetchRadioAssets(host, userId = 'notPassed', token) {
  return new Promise((resolve, reject) => {
    const cache = localStorage.getItem(`LighthouseFetchedRadioAssets`);
    const secondsSinceEpoch = Math.round(Date.now() / 1000);
    if (cache != null) {
      const cacheJson = JSON.parse(cache);
      if (secondsSinceEpoch - Math.round(new Date(cacheJson.timestamp * 1000) / 1000) > 60) {
        // 60 second cache
        fetch();
      } else {
        console.log('fetchRadioAssets served from cache');
        resolve(cacheJson.data);
      }
    } else {
      fetch();
    }

    function fetch() {
      $.ajax({
        url: host + '/Api/v1/ResourceLocations/Radio?resourceTypes=',
        beforeSend: function (n) {
          n.setRequestHeader('Authorization', 'Bearer ' + token);
        },
        cache: false,
        dataType: 'json',
        data: { LighthouseFunction: 'fetchRadioAssets', userId: userId },
        type: 'GET',
        success: function (data) {
          localStorage.setItem(
            `LighthouseFetchedRadioAssets`,
            JSON.stringify({ timestamp: secondsSinceEpoch, data: data }),
          );
          console.log('fetchRadioAssets served from server');
          resolve(data);
        },
        error: function (error) {
          reject(error);
        },
      });
    }
  });
}

function fetchTeleAssets(host, userId = 'notPassed', token) {
  return new Promise((resolve, reject) => {
    const cache = localStorage.getItem(`LighthouseFetchedTeleAssets`);
    const secondsSinceEpoch = Math.round(Date.now() / 1000);
    if (cache != null) {
      const cacheJson = JSON.parse(cache);
      if (secondsSinceEpoch - Math.round(new Date(cacheJson.timestamp * 1000) / 1000) > 60) {
        // 60 second cache
        fetch();
      } else {
        console.log('fetchRadioAssets served from cache');
        resolve(cacheJson.data);
      }
    } else {
      fetch();
    }

    function fetch() {
      $.ajax({
        url: host + '/Api/v1/ResourceLocations/Telematics',
        beforeSend: function (n) {
          n.setRequestHeader('Authorization', 'Bearer ' + token);
        },
        cache: false,
        dataType: 'json',
        data: { LighthouseFunction: 'fetchTeleAssets', userId: userId },
        type: 'GET',
        success: function (data) {
          localStorage.setItem(
            `LighthouseFetchedTeleAssets`,
            JSON.stringify({ timestamp: secondsSinceEpoch, data: data }),
          );
          console.log('fetchTeleAssets served from server');
          resolve(data);
        },
        error: function (error) {
          reject(error);
        },
      });
    }
  });
}
