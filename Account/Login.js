//Fix missing favicon on login page
var s = document.createElement('link');
s.href="/Content/images/favicon.ico";
s.rel="SHORTCUT ICON";
document.getElementsByTagName('head')[0].appendChild(s);
//


//Add keep alive box to login screen
var bar = document.getElementById("Password");

var div = document.createElement("div");

div.style.width="100%";
div.style.height="100px";
div.style.borderRadius = "10px";
div.style.marginTop = "20px";
div.style.border="1px";
div.style.backgroundColor="grey";
div.style.color="white";
div.style.lineHeight="50px";



div.innerHTML="<input autocomplete=\"off\" id=\"lighthouseKeepLogin\" type=\"checkbox\">  Try keep my session active</input><h6>If your beacon session idles for 25 minutes you will be promped to extend your session.</h6>";

var button = document.createElement("input");
button.id="lighthouseKeepLogin";
button.type="checkbox";
button.innerHTML = "Remind me when I idle";

bar.parentNode.insertBefore(div,bar.nextSibling);


chrome.storage.sync.get({
    keepalive: false,
  }, function(items) {
    console.log("restoring keepalive setting:"+items.keepalive)
    document.getElementById('lighthouseKeepLogin').checked = items.keepalive;
});
//


//event listener for keepalive box
document.getElementById('lighthouseKeepLogin').addEventListener('click', function() {
console.log("will save keepalive setting:"+this.checked);
chrome.storage.sync.set({
    keepalive: this.checked,
  });

});

var url = chrome.extension.getURL("lighthouse128.png");
$('#loginForm > fieldset > .row:last').prepend('<div class="something"><img src="' + url + '" /><div class="text">blergh blargh foo bar</div></div>');
