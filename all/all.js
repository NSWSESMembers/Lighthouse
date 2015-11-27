console.log("telling the keep alive system we are still active")
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


var img = document.createElement("img");
img.src = chrome.extension.getURL("lighthouse128.png");
img.style.opacity = "0.1";


document.getElementsByTagName('body')[0].style.backgroundImage = "url("+chrome.extension.getURL("lighthouse40.png")+")";

document.getElementsByTagName('body')[0].style.backgroundRepeat = "no-repeat";
document.getElementsByTagName('body')[0].style.backgroundPosition="0% 100%";

