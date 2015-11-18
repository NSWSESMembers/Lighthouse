console.log("starting the keep alive loop")
chrome.runtime.sendMessage({loggedin: true}, function(response) {
});

//inject our JS resource
var s = document.createElement('script');
s.src = chrome.extension.getURL('lighthouse-GenericContent.js');
(document.head || document.documentElement).appendChild(s)



var logo = document.getElementsByClassName("navbar-brand");
logo[0].style.background="transparent url('"+chrome.extension.getURL("lighthouse.png")+"') 0% 50% no-repeat";
logo[0].style.backgroundSize="105px 35px";
logo[0].style.width="120px";
logo[0].style.height="50px";
logo[0].style.margin="0 0 0 10px";
logo[0].style.padding="0";

