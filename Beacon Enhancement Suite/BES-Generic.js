console.log("starting the keep alive loop")
chrome.runtime.sendMessage({loggedin: true}, function(response) {
});

var logo = document.getElementsByClassName("navbar-header");
logo[0].style.backgroundColor="#FF6600";


var bar = document.getElementById("navbar");
bar.style.backgroundColor="#FF6600";