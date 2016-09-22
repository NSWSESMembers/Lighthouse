// This background script is initialised and executed once and exists
// separate to all other pages.


//block message js core requests
chrome.webRequest.onBeforeRequest.addListener(
  function (details) {
    return {cancel: true};
  },
  { urls: ["https://*.ses.nsw.gov.au/js/messages/create?v=*"] },
  ["blocking"]);