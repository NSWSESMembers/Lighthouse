console.log("restarting the keep alive counter")
chrome.runtime.sendMessage({activity: true}, function(response) {console.log(response)});


var elts = document.getElementsByTagName('a');
var show = function() { chrome.runtime.sendMessage({activity: true}, function(response) {console.log(response)}); }
for (var i = elts.length - 1; i >= 0; --i) {
    elts[i].onclick = show;
}

//inject our JS resource
var s = document.createElement('script');
s.src = chrome.extension.getURL('/all/content/all.js');
(document.head || document.documentElement).appendChild(s)

var logo = document.getElementsByClassName("navbar-brand");
logo[0].style.background="transparent url('"+chrome.extension.getURL("lighthouse.png")+"') 0% 50% no-repeat";
logo[0].style.backgroundSize="105px 35px";
logo[0].style.width="120px";
logo[0].style.height="50px";
logo[0].style.margin="0 0 0 10px";
logo[0].style.padding="0";

