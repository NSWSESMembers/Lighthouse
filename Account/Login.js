console.info('Lighthouse: Account/Login.js');

// FIX - Add Missing Favicon
$('head').append('<link rel="SHORTCUT ICON" href="/Content/images/favicon.ico" />');

// IMPROVEMENT - Replace Window Title
$('head > title').text('Beacon - Login');

// FUNCTIONALITY - Add "Keep Alive" Option to Login Form
$('#loginForm > fieldset > .row:nth-last-child(2)')
  .before('<div class="lighthouse-keepalive">'+
            '<img src="' + chrome.extension.getURL("lighthouse128.png") + '" />'+
            '<input autocomplete="off" id="lighthouseKeepLogin" type="checkbox" /> '+
              'Try to keep my session active'+
            '</input>'+
            '<div class="text">'+
              'If your beacon session is idle for 25&nbsp;minutes you will be prompted to extend your session.'+
            '</div>'+
          '</div>');

// Check Existing "Keep Alive" setting, and set checkbox to match last usage
chrome.storage.sync.get(
  {
    keepalive: false,
  } ,
  function(items) {
    console.log("restoring keepalive setting:"+items.keepalive)
    document.getElementById('lighthouseKeepLogin').checked = items.keepalive;
});

// Event listener for keepalive box
document.getElementById('lighthouseKeepLogin').addEventListener('click', function() {
  console.log("will save keepalive setting:"+this.checked);
  chrome.storage.sync.set({
    keepalive: this.checked
  });
});
