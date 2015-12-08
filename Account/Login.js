$('head')
  .append('<title>Beacon - Login</title>') // Replace window title with "Beacon Login"
  .append('<link rel="SHORTCUT ICON" src="/Content/images/favicon.ico">'); // Fix missing favicon on login page

$('#loginForm > fieldset > .row:nth-last-child(2)')
  .before('<div id="lighthouse-keepalive" class="lighthouse-keepalive" style="display:none"><img src="' + chrome.extension.getURL("lighthouse128.png") + '" /><label><input autocomplete="off" id="lighthouseKeepLogin" type="checkbox">  Try keep my session active</label><div class="text">If your beacon session idles for 25 minutes you will be promped to extend your session.</div></div>');
$('#lighthouse-keepalive').slideDown();

chrome.storage.sync.get({
    keepalive: false,
  }, function(items) {
    console.log("Lighthouse: KeepAlive Setting:"+items.keepalive)
    $('#lighthouseKeepLogin').attr('checked',items.keepalive);
});

//event listener for keepalive box
$('#lighthouseKeepLogin').on('click', function() {
  console.log("Lighthouse: Storing KeepAlive Setting:"+this.checked);
  chrome.storage.sync.set({
    keepalive: this.checked
  });
});
