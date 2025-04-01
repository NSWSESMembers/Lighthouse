// function for injecting a script built to be run within the regular browser
// JS context

var inject = function (script) {
  var s = document.createElement('script');
  s.src = chrome.runtime.getURL('/myAvailability/injectscripts/' + script);
  s.onload = function () {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(s);
};

module.exports = inject;
