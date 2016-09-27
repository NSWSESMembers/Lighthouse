var $ = require('jquery');


$('head')
  .append('<title>Beacon - Login</title>') // Replace window title with "Beacon Login"
  .append('<link rel="SHORTCUT ICON" src="/Content/images/favicon.ico">'); // Fix missing favicon on login page

// Adds CSS Classes to BODY
$('body')
  // Start of the Hostname "beacon", "trainbeacon", "previewbeacon"
  .addClass(location.hostname.substring(0,location.hostname.indexOf('.')))
  // If Christmas
  .toggleClass('xmas', new Date().getMonth()==11);
