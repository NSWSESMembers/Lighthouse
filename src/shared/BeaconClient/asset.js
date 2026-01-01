import $ from 'jquery';
import moment from 'moment';

export function filter(assetFilter, host, userId = 'notPassed', token, cb, err) {
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
  }, function (error) {
    err(error)
  });
}

function ReturnAssetLocations(host, userId = 'notPassed', token, cb, err) {
  console.log('ReturnAssetLocations');
  Promise.allSettled([fetchRadioAssets(host, userId, token), fetchTeleAssets(host, userId, token)]).then(function (
    res,
  ) {
    var response = [];
    //PSN Responses
    if (res[0].status === 'fulfilled') {
      res[0].value.forEach(function (i) {
        // PSN locations
        if (isNaN(i.properties.name)) {
          // hide numerical names that are not setup yet
          i.type = 'psn';
          i.lastSeen = i.properties.lastSeen;
          i.name = `${i.properties.name} (PSN)`;
          i.unitCode = i.properties.name.match(/([a-z]+)/i)
            ? i.properties.name.match(/([a-z]+)/i)[1]
            : i.properties.name;
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
    } else {
      err("Error fetching PSN asset locations")
    }
    //Telematic Responses
    if (res[1].status === 'fulfilled') {
      res[1].value.features.forEach(function (i) {
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
    } else {
      err("Error fetching Telemetric asset locations")
    }
    cb && cb(response);
  });
}

function fetchRadioAssets(host, userId = 'notPassed', token) {
  const source = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return new Promise((resolve, reject) => {
    const cache = localStorage.getItem(`${source}-LighthouseFetchedRadioAssets`);
    const secondsSinceEpoch = Math.round(Date.now() / 1000);
    if (cache != null) {
      const cacheJson = JSON.parse(cache);
      if (secondsSinceEpoch - Math.round(new Date(cacheJson.timestamp * 1000) / 1000) > 20) {
        // 20 second cache
        fetchAllResources()
      } else {
        console.log('fetchRadioAssets served from cache');
        resolve(cacheJson.data);
      }
    } else {
      fetchAllResources()
    }

function fetchAllResources() {
  const resourceTypes = [
    ""
  ];

  const fetchPromises = resourceTypes.map(type => {
    return $.ajax({
      url: host + '/Api/v1/ResourceLocations/Radio',
      data: {
        resourceTypes: type,
        LighthouseFunction: 'fetchRadioAssets',
        userId: userId
      },
      beforeSend: function (n) {
        n.setRequestHeader('Authorization', 'Bearer ' + token);
      },
      cache: false,
      dataType: 'json',
      type: 'GET'
    }).then(data => (data));
  });

  Promise.all(fetchPromises)
    .then(results => {
            const mergedData = results.flat(); // joins all arrays into one
      
      localStorage.setItem(
        `${source}-LighthouseFetchedRadioAssets`,
        JSON.stringify({ timestamp: secondsSinceEpoch, data: mergedData })
      );

      console.log('All radio assets fetched and stored.');
      resolve(mergedData);
    })
    .catch(error => {
      console.error('Error fetching radio assets:', error);
      reject(error);
    });
}
  });
}

function fetchTeleAssets(host, userId = 'notPassed', token) {
  const source = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return new Promise((resolve, reject) => {
    const cache = localStorage.getItem(`${source}-LighthouseFetchedTeleAssets`);
    const secondsSinceEpoch = Math.round(Date.now() / 1000);
    if (cache != null) {
      const cacheJson = JSON.parse(cache);
      if (secondsSinceEpoch - Math.round(new Date(cacheJson.timestamp * 1000) / 1000) > 20) {
        // 20 second cache
        fetch();
      } else {
        console.log('fetchTeleAssets served from cache');
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
            `${source}-LighthouseFetchedTeleAssets`,
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
