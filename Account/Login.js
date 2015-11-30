//Fix missing favicon on login page
var s = document.createElement('link');
s.href="/Content/images/favicon.ico";
s.rel="SHORTCUT ICON";
document.getElementsByTagName('head')[0].appendChild(s);
//

//replace window title with job number
var s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.innerHTML = "document.title = \"Beacon - Login\"";
    (document.head || document.documentElement).appendChild(s)



var url = chrome.extension.getURL("lighthouse128.png");
$('#loginForm > fieldset > .row:nth-last-child(2)').before('<div class="lighthouse-keepalive"><img src="' + url + '" /><input autocomplete=\"off\" id=\"lighthouseKeepLogin\" type=\"checkbox\">  Try keep my session active</input><div class="text">If your beacon session idles for 25 minutes you will be promped to extend your session.</div></div>');



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

