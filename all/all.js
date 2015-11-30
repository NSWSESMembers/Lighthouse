// notify keep alive system that a new page has been loaded (and therefore the
// user's session has been refreshed)
console.log("telling the keep alive system we are still active")
chrome.runtime.sendMessage({activity: true});

// notify keep alive system whenever we click on something. We let the event
// propagate because we don't want to interfere with regular operation of <a>
$('a').click(function(e) {
  chrome.runtime.sendMessage({activity: true});
});

// inject JS that is to run on every page in page context
$.getScript(chrome.extension.getURL('/all/content/all.js'));

// attach a Lighthouse stamp bottom right
imageUrl = chrome.extension.getURL("lighthouse40.png");
$('body').css('background-image', 'url(' + imageUrl + ')')
         .css('background-repeat', 'no-repeat')
         .css('background-attachment', 'fixed')
         .css('background-position', 'right bottom');
