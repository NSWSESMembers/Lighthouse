var $ = require('jquery');
var DOM = require('jsx-dom-factory');
var LighthouseChrome = require('../../pages/lib/shared_chrome_code.js');


$('head')
  .append('<title>Beacon - Login</title>') // Replace window title with "Beacon Login"
  .append('<link rel="SHORTCUT ICON" src="/Content/images/favicon.ico">'); // Fix missing favicon on login page

// Adds CSS Classes to BODY
$('body')
  // Start of the Hostname "beacon", "trainbeacon", "previewbeacon"
  .addClass(location.hostname.substring(0,location.hostname.indexOf('.')))
  // If Christmas
  .toggleClass('xmas', new Date().getMonth()==11);



  $('body').css({ 'background-image': 'url('+chrome.extension.getURL("icons/lhbackdrop.png")+')','background-repeat': 'no-repeat', 'background-size': 'contain','background-position': 'bottom right'})


// Team summary button
version = 'v'+chrome.manifest.version+' '+(chrome.manifest.name.includes("Development") ? "Development" : "Production")
$('body').append(
	<div class="col-xs-12" style="position:fixed;bottom:0px;right:0px;width:550px;text-align:right;margin-right:-10px;color:white">
	<small>Running Lighthouse extension {version} edition.</small>
	<div><small>Designed & developed by volunteers of the NSW SES. Lighthouse is distributed under an MIT Licence.</small></div>
	</div>
);




