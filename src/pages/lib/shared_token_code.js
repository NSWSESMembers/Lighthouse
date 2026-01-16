var $ = require('jquery');
var moment = require('moment');
var periodicCheck = null;

// wait for token to have loaded
export function fetchBeaconToken(apiHost, source, cb) {
  const waiting = setInterval(function () {
    chrome.storage.local.get('beaconAPIToken-' + apiHost, function (data) {
      const tokenJSON = JSON.parse(data['beaconAPIToken-' + apiHost]);
      if (tokenJSON?.token && tokenJSON?.expdate) {
        const { token, expdate: tokenexp } = tokenJSON;
        clearInterval(waiting); // stop timer

        startTokenValidation(apiHost, source, cb); // Start periodic validation
        cb({ token, tokenexp }); // callback with token
      }
    });
  }, 200);
}

// wait for token to have loaded and keep returning valid tokens
export function fetchBeaconTokenAndKeepReturningValidTokens(apiHost, source, cb) {
  const waiting = setInterval(function () {
    chrome.storage.local.get('beaconAPIToken-' + apiHost, function (data) {
      const tokenJSON = JSON.parse(data['beaconAPIToken-' + apiHost]);
      if (tokenJSON?.token && tokenJSON?.expdate) {
        const { token, expdate: tokenexp } = tokenJSON;
        clearInterval(waiting); // stop timer

        startTokenValidation(apiHost, source, cb); // Start periodic validation
        cb({ token, tokenexp }); // callback with token
      }
    });
  }, 200);
}

// Start a single periodic token validation timer
function startTokenValidation(apiHost, source, cb) {
  if (periodicCheck != null) return; // Avoid multiple timers

  periodicCheck = setInterval(function () {
    chrome.storage.local.get('beaconAPIToken-' + apiHost, function (data) {
      const tokenJSON = JSON.parse(data['beaconAPIToken-' + apiHost]);
      if (tokenJSON?.token && tokenJSON?.expdate) {
        const { token, expdate: tokenexp } = tokenJSON;

        if (moment().isAfter(moment(tokenexp).subtract(5, "minutes"))) {
          renewToken(apiHost, source, token, cb);
        } else {
          console.log('API token still valid');
        }
      }
    });
  }, 1 * 60 * 1000); // Check every 1 minute
}

// Renew the token
function renewToken(apiHost, source, token, cb) {
  console.log("Token expiry triggered. Attempting to renew.");
  $.ajax({
    type: 'GET',
    url: source + "/Authorization/RefreshToken",
    beforeSend: function (n) {
      n.setRequestHeader("Authorization", "Bearer " + token);
    },
    cache: false,
    dataType: 'json',
    complete: function (response, _textStatus) {
      if (response.status === 200 && response.responseJSON) {
        const newToken = response.responseJSON.access_token;
        const newTokenExp = response.responseJSON.expires_at;
        chrome.storage.local.set({
          ['beaconAPIToken-' + apiHost]: JSON.stringify({
            token: newToken,
            expdate: newTokenExp
          })
        }, function () {
          console.log('Local data set - beaconAPIToken');
          cb({ token: newToken, tokenexp: newTokenExp }); // callback with new token
        });
        console.log("Successful token renewal.");
      } else {
        console.error("Token renewal failed. Stopping further attempts.");
        clearInterval(periodicCheck); // Stop further attempts
        periodicCheck = null;
      }
    }
  });
}
