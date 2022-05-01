// function for injecting a script built to be run within the regular browser
// JS context

var $ = require('jquery');

var inject = function(script) {
  $.getScript(chrome.extension.getURL('/injectscripts/' + script));
};

module.exports = inject;
