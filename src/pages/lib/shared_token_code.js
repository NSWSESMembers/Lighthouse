import $ from 'jquery';
import moment from 'moment';
var periodicCheck = null;

// The token this page last handed its callback, and that callback. A Beacon
// tab, or another Lighthouse page, can store a newer token for the same
// environment at any time (each page renews on its own timer), so every check
// hands over a newer stored token rather than keeping the first one until
// this page renews it itself.
var latest = null; // { token, tokenexp }
var latestCb = null;
var renewing = null; // the renewal in flight, if any
var renewalFailed = false;

function readStored(data, apiHost) {
  try {
    const tokenJSON = JSON.parse(data['beaconAPIToken-' + apiHost]);
    if (tokenJSON?.token && tokenJSON?.expdate) return { token: tokenJSON.token, tokenexp: tokenJSON.expdate };
  } catch (_) {
    /* nothing stored yet */
  }
  return null;
}

function nearExpiry(tokenexp) {
  return moment().isAfter(moment(tokenexp).subtract(5, "minutes"));
}

// Hand `candidate` to the callback if it's a different token that expires no
// earlier than the one handed over last.
function deliverIfNewer(candidate, cb) {
  if (!candidate || (latest && candidate.token === latest.token)) return;
  if (latest && moment(candidate.tokenexp).isBefore(moment(latest.tokenexp))) return;
  latest = candidate;
  renewalFailed = false; // a new token: renewing it later is worth a try
  if (cb) cb({ token: candidate.token, tokenexp: candidate.tokenexp });
}

// wait for token to have loaded
export function fetchBeaconToken(apiHost, source, cb) {
  const waiting = setInterval(function () {
    chrome.storage.local.get('beaconAPIToken-' + apiHost, function (data) {
      const tokenJSON = JSON.parse(data['beaconAPIToken-' + apiHost]);
      if (tokenJSON?.token && tokenJSON?.expdate) {
        const { token, expdate: tokenexp } = tokenJSON;
        clearInterval(waiting); // stop timer

        latestCb = cb;
        latest = { token, tokenexp };
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

        latestCb = cb;
        latest = { token, tokenexp };
        startTokenValidation(apiHost, source, cb); // Start periodic validation
        cb({ token, tokenexp }); // callback with token
      }
    });
  }, 200);
}

/**
 * The newest token Lighthouse has for this Beacon environment, for a caller
 * whose request was refused (401/403): reads the stored token again, and
 * renews it first if it's expired or within 5 minutes of expiring. A newer
 * token also goes to the page's token callback. Resolves null if there's no
 * token at all; if renewal fails it resolves the newest token it has, so the
 * caller can tell a refusal of that token from one of a stale copy.
 *
 * @param {string} apiHost  Beacon API host (params.host)
 * @param {string} source  Beacon site origin (params.source), for renewal
 * @returns {Promise<string|null>}
 */
export function freshBeaconToken(apiHost, source) {
  return new Promise(function (resolve) {
    chrome.storage.local.get('beaconAPIToken-' + apiHost, function (data) {
      const stored = readStored(data, apiHost);
      // The later-expiring of the stored token and the one this page holds.
      const current =
        stored && latest && moment(stored.tokenexp).isBefore(moment(latest.tokenexp)) ? latest : stored || latest;
      if (!current) return resolve(null);
      if (nearExpiry(current.tokenexp)) {
        renewToken(apiHost, source, current.token, latestCb).then(function (renewed) {
          resolve(renewed ? renewed.token : current.token);
        });
        return;
      }
      deliverIfNewer(current, latestCb);
      resolve(current.token);
    });
  });
}

// Start a single periodic token validation timer
function startTokenValidation(apiHost, source, cb) {
  if (periodicCheck != null) return; // Avoid multiple timers

  periodicCheck = setInterval(function () {
    chrome.storage.local.get('beaconAPIToken-' + apiHost, function (data) {
      const stored = readStored(data, apiHost);
      if (stored) {
        if (nearExpiry(stored.tokenexp)) {
          if (!renewalFailed) renewToken(apiHost, source, stored.token, cb);
        } else {
          // Renewed elsewhere (a Beacon tab or another Lighthouse page).
          deliverIfNewer(stored, cb);
          console.log('API token still valid');
        }
      }
    });
  }, 1 * 60 * 1000); // Check every 1 minute
}

// Renew the token. Resolves the new { token, tokenexp }, or null if renewal
// failed; a renewal already running is shared rather than sent twice.
function renewToken(apiHost, source, token, cb) {
  if (renewing) return renewing;
  console.log("Token expiry triggered. Attempting to renew.");
  renewing = new Promise(function (resolve) {
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
          latest = { token: newToken, tokenexp: newTokenExp };
          if (cb) cb({ token: newToken, tokenexp: newTokenExp }); // callback with new token
          resolve(latest);
        });
        renewalFailed = false;
        console.log("Successful token renewal.");
      } else {
        // Stop renewing on the timer, but keep picking up tokens a Beacon tab
        // or another Lighthouse page stores (see startTokenValidation).
        console.error("Token renewal failed. Stopping further attempts.");
        renewalFailed = true;
        resolve(null);
      }
    }
  });
  }).finally(function () {
    renewing = null;
  });
  return renewing;
}
