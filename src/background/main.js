// This background script is initialised and executed once and exists
// separate to all other pages. This script is responsible for hitting the
// beacon API regularly to keep the user's session alive.

var baseUri = "https://beacon.ses.nsw.gov.au/";
var statusCheckInterval = 60 * 1000;
var keepaliveInterval = 25 * 60 * 1000;
var lastActivity = null;

var statusTimer = null;
var keepaliveTimer = null;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.focus) {
    console.log("Received FOCUS message from beacon page. Updating lastActivity.");
    lastActivity = new Date().getTime();
  }
  if (request.activity) {
    console.log("Received ACTIVITY message from beacon page. Setting timer...");
    startTimers();
  }
});

function startTimers() {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
  }

  // trigger keepaliveLoop() after 25 minutes. We reset this timer every time
  // we load a page since we don't need to keep alive if the user is hitting
  // the API organically.
  keepaliveTimer = setInterval(keepaliveLoop, keepaliveInterval);

  if (!statusTimer) {
    // check beacon's status every minute.
    statusTimer = setInterval(statusLoop, statusCheckInterval);
  }
}

function cancelTimers() {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }

  if (statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
  }
}

function statusLoop() {
  checkBeaconStillActive(function(active) {
    if(!active) {
      console.log("Beacon is no longer active so the keep alive timer has been killed.");
      cancelTimers();
    } else {
      console.log("Beacon is still active.");
    }
  });
}

function keepaliveLoop() {
  checkBeaconStillActive(function(active) {
    if(active) {
      if( ( new Date().getTime() - lastActivity ) <= keepaliveInterval ){
        console.info( 'Beacon Page had focus within last 25 minutes. Maintaining session.' );
        hitApi();
      } else {
        console.time('KeepAlive Prompt');
        if( confirm( 'You have been idle on Beacon for over 25 mins. Do you wish to remain logged in?' ) ) {
          hitApi();
        } else {
          cancelTimers();
          //they dont want to keep alive any more. set storage to false.
          chrome.storage.sync.set({
            keepalive: false,
          });
        }
        console.timeEnd('KeepAlive Prompt');
      }
    }
  });
}

function checkBeaconStillActive(cb) {
  chrome.storage.sync.get({
    keepalive: false,
  }, function(items) {
    if (items.keepalive) { //if the user has selected to keep their session alive
      chrome.tabs.query({
          url: baseUri + "*",
        },
        function(tabs) {
          cb(tabs.length > 0);
        }
      );
    }
  });
}


function hitApi(cb) {
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
      console.log("Beacon session kept alive");
      cb && cb(true);
    } else if (xhttp.readyState == 4 && xhttp.status == 500) {
      // Was hoping for a 401....but i guess 500 is means the same thing...
      console.log("Beacon appears to be logged out so cancelling keep alive");
      cancelTimers();
      cb && cb(false);
    }
  }
  xhttp.open("GET", baseUri + "Api/v1/Jobs/1", true);
  xhttp.send();
}
