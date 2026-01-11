var $ = require('jquery');
var moment = require('moment');
var periodicCheck = null

// wait for token to have loaded
export function fetchBeaconToken(apiHost, source, cb) { //when external vars have loaded
  var waiting = setInterval(function () { //run every 1sec until we have loaded the page (dont hate me Sam)
    chrome.storage.local.get('beaconAPIToken-' + apiHost, function (data) {
      var tokenJSON = JSON.parse(data['beaconAPIToken-' + apiHost])
      if (typeof tokenJSON.token !== "undefined" && typeof tokenJSON.expdate !== "undefined" && tokenJSON.token != '' && tokenJSON.expdate != '') {
        var token = tokenJSON.token
        var tokenexp = tokenJSON.expdate
        clearInterval(waiting); //stop timer

        if (periodicCheck == null) {
          periodicCheck = setInterval(function () {
            validateBeaconToken(apiHost, source)
          }, 3e5);
        }

        cb({
          token,
          tokenexp
        }); //call back
      }
    })
  }, 200);
}

// wait for token to have loaded
export function fetchBeaconTokenAndKeepReturningValidTokens(apiHost, source, cb) { //when external vars have loaded
  var waiting = setInterval(function () { //run every 1sec until we have loaded the page (dont hate me Sam)
    chrome.storage.local.get('beaconAPIToken-' + apiHost, function (data) {
      var tokenJSON = JSON.parse(data['beaconAPIToken-' + apiHost])
      if (typeof tokenJSON.token !== "undefined" && typeof tokenJSON.expdate !== "undefined" && tokenJSON.token != '' && tokenJSON.expdate != '') {
        var token = tokenJSON.token
        var tokenexp = tokenJSON.expdate
        clearInterval(waiting); //stop timer

        if (periodicCheck == null) {
          periodicCheck = setInterval(function () {
            validateBeaconTokenKeepReturning(apiHost, source, cb)
          }, 1 * 60 * 1000); // 1 minute
        }

        cb({
          token,
          tokenexp
        }); //call back
      }
    })
  }, 200);
}

function validateBeaconTokenKeepReturning(apiHost, source, cb) {
  fetchBeaconToken(apiHost, source, function ({
    token,
    tokenexp
  }) {
    if (moment().isAfter(moment(tokenexp).subtract(5, "minutes"))) {
      console.log("token expiry triggered. time to renew.")
      $.ajax({
        type: 'GET',
        url: source + "/Authorization/RefreshToken",
        beforeSend: function (n) {
          n.setRequestHeader("Authorization", "Bearer " + token)
        },
        cache: false,
        dataType: 'json',
        complete: function (response, _textStatus) {
          if (response.status === 200 && response.responseJSON) {
            var token = response.responseJSON.access_token;
            var tokenexp = response.responseJSON.expires_at;
            chrome.storage.local.set({
              ['beaconAPIToken-' + apiHost]: JSON.stringify({
                token: token,
                expdate: tokenexp
              })
            }, function () {
              console.log('local data set - beaconAPIToken');
              cb({
                token,
                tokenexp
              }); // call back again
            });
            console.log("successful token renew.");
          } else {
            console.error("Token renewal failed. Stopping further attempts.");
            clearInterval(periodicCheck); // Stop further attempts
            periodicCheck = null;
          }
        }
      });
    } else {
      console.log('api token still valid');
    }
  });
}

export function validateBeaconToken(apiHost, source) {
  fetchBeaconToken(apiHost, source, function ({
    token,
    tokenexp
  }) {
    if (moment().isAfter(moment(tokenexp).subtract(5, "minutes"))) {
      console.log("token expiry triggered. time to renew.")
      $.ajax({
        type: 'GET',
        url: source + "/Authorization/RefreshToken",
        beforeSend: function (n) {
          n.setRequestHeader("Authorization", "Bearer " + token)
        },
        cache: false,
        dataType: 'json',
        complete: function (response, _textStatus) {
          if (response.status === 200 && response.responseJSON) {
            var token = response.responseJSON.access_token;
            var tokenexp = response.responseJSON.expires_at;
            chrome.storage.local.set({
              ['beaconAPIToken-' + apiHost]: JSON.stringify({
                token: token,
                expdate: tokenexp
              })
            }, function () {
              console.log('local data set - beaconAPIToken');
            });
            console.log("successful token renew.");
          } else {
            console.error("Token renewal failed. Stopping further attempts.");
            clearInterval(periodicCheck); // Stop further attempts
            periodicCheck = null;
          }
        }
      });
    } else {
      console.log('api token still valid');
    }
  });
}
