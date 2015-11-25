//Fix missing favicon on login page
var s = document.createElement('link');
s.href="/Content/images/favicon.ico";
s.rel="SHORTCUT ICON";
document.getElementsByTagName('head')[0].appendChild(s);
//


// //Add keep alive box to login screen
// var bar = document.getElementById("Password");

// var div = document.createElement("div");

// div.style.width="100%";
// div.style.height="100px";
// div.style.borderRadius = "10px";
// div.style.marginTop = "20px";
// div.style.border="1px";
// div.style.backgroundColor="grey";
// div.style.color="white";
// div.style.lineHeight="50px";



// div.innerHTML="<input autocomplete=\"off\" id=\"lighthouseKeepLogin\" type=\"checkbox\">  Try keep me logged in for 12 hours</input><h6>Chrome must remain open for this to work. Be security cautious of this and avoid using it on a public computer</h6>";

// var button = document.createElement("input");
// button.id="lighthouseKeepLogin";
// button.type="checkbox";
// button.innerHTML = "Keep Me Logged In for 24hrs";

// bar.parentNode.insertBefore(div,bar.nextSibling);


// chrome.storage.sync.get({
//     keepalive: false,
//   }, function(items) {
//     console.log("restoring keepalive setting:"+items.keepalive)

//     document.getElementById('lighthouseKeepLogin').checked = items.keepalive;
// });
// //


// //event listener for keepalive box
// document.getElementById('lighthouseKeepLogin').addEventListener('click', function() {
// var InTime = new Date().getTime();
// console.log("will save keepalive setting:"+this.checked);
// chrome.storage.sync.set({
//     keepalive: this.checked,
//     timeIn: InTime
//   });

// });


// //tell the background script we are logged out
// console.log("telling bg we are not logged in")
// chrome.runtime.sendMessage({loggedin: false}, function(response) {
//   console.log(response.farewell);
// });

