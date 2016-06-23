var $ = require('jquery');
var DOM = require('jsx-dom-factory');

// inject login.css (browserify-css takes care of this)
require('../styles/login.css');

$('head')
  .append('<title>Beacon - Login</title>') // Replace window title with "Beacon Login"
  .append('<link rel="SHORTCUT ICON" src="/Content/images/favicon.ico">'); // Fix missing favicon on login page

var url = chrome.extension.getURL("icons/lighthouse128.png");
var keepalivePanel = (
  <div id="lighthouse-keepalive" class="lighthouse-keepalive">
    <img src={url} />
    <label>
      <input autocomplete="off" id="lighthouseKeepLogin" type="checkbox" />
      Try keep my session active
    </label>
    <div class="text">
      If your beacon session idles for 25 minutes you will be prompted to
      extend your session.
    </div>
  </div>
);

$('#loginForm > fieldset > .row:nth-last-child(2)').before(keepalivePanel);
$(keepalivePanel).slideDown();

chrome.storage.sync.get({
    keepalive: false,
  }, function(items) {
    console.log("Lighthouse: KeepAlive Setting:"+items.keepalive)
    $('#lighthouseKeepLogin').attr('checked',items.keepalive);
});

//event listener for keepalive box
$('#lighthouseKeepLogin').on('click', function() {
  //console.log("Lighthouse: Storing KeepAlive Setting:"+this.checked);
  chrome.storage.sync.set({
    keepalive: this.checked
  });
});

// Adds CSS Classes to BODY
$('body')
  // Start of the Hostname "beacon", "trainbeacon", "previewbeacon"
  .addClass(location.hostname.substring(0,location.hostname.indexOf('.')))
  // If Christmas
  .toggleClass('xmas', new Date().getMonth()==11);
