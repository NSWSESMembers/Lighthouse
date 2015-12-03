console.info('Lighthouse: all/all.js');

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

// // attach a Lighthouse stamp bottom right
// imageUrl = chrome.extension.getURL("lighthouse40.png");
// $('body').css('background-image', 'url(' + imageUrl + ')')
//          .css('background-repeat', 'no-repeat')
//          .css('background-attachment', 'fixed')
//          .css('background-position', 'right bottom');


if (location.hostname == "beacon.ses.nsw.gov.au" && (new Date().getMonth() == 11))
{
console.log("Ho Ho Ho");
var logo = document.getElementsByClassName("navbar-brand");
logo[0].style.background="transparent url('"+chrome.extension.getURL("xmas.png")+"') 0% 50% no-repeat";
logo[0].style.backgroundSize="105px 35px";
logo[0].style.width="120px";
logo[0].style.height="50px";
logo[0].style.margin="0 0 0 10px";
logo[0].style.padding="0";

}

if (location.hostname == "trainbeacon.ses.nsw.gov.au" && (new Date().getMonth() == 11))
{
console.log("Ho Ho Ho");
var logo = document.getElementsByClassName("navbar-brand");
logo[0].style.background="transparent url('"+chrome.extension.getURL("training-xmas.png")+"') 0% 50% no-repeat";
}


//set the extension code var into the head
var s = document.createElement('script');
s.setAttribute('type', 'text/javascript');
s.innerHTML = "var lighthouseUrl = \"" + chrome.extension.getURL("") + "\"";
(document.head || document.documentElement).appendChild(s)




