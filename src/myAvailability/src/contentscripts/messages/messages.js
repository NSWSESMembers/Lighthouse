// eslint-disable-next-line @typescript-eslint/no-unused-vars
var $ = require('jquery');


whenPageIsReady(function () {

$('div[aria-label="Channel list"]').parent().css('max-height', '1000px');

})



function whenPageIsReady(cb) {
  let startTime = Date.now();
  if ($('div[aria-label="Channel list"]').length > 0) {
    cb(); // Call back immediately
  } else {
    let waiting = setInterval(function () {
      if ($('div[aria-label="Channel list"]').length > 0) {
        clearInterval(waiting); // Stop timer
        cb(); // Call back
      } else if (Date.now() - startTime >= 5000) {
        clearInterval(waiting); // Stop after 5 seconds
        console.log('Timeout: Stopping waiting whenPageIsReady after 5 seconds.');
      }
    }, 500);
  }
}