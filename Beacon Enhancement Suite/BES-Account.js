var bar = document.getElementById("Password");

var div = document.createElement("div");

div.style.width="100%";
div.style.height="50px";
div.style.borderRadius = "10px";
div.style.marginTop = "20px";
div.style.border="1px";
div.style.backgroundColor="grey";
div.style.color="white";
div.style.lineHeight="50px";


div.innerHTML="<input id=\"BESKeepLogin\" type=\"checkbox\" checked>  Keep me logged in for 12 hours</input>";

var button = document.createElement("input");
button.id="BESKeepLogin";
button.type="checkbox";
button.innerHTML = "Keep Me Logged In for 24hrs";

bar.parentNode.insertBefore(div,bar.nextSibling);


chrome.storage.sync.get({
    keepalive: 'false',
  }, function(items) {
    console.log("restoring keepalive setting:"+items.keepalive)

    document.getElementById('BESKeepLogin').checked = items.keepalive;
  });

document.getElementById('BESKeepLogin').addEventListener('click', function() {
var InTime = new Date().getTime();
console.log("saving keepalive setting:"+this.checked);
chrome.storage.sync.set({
    keepalive: this.checked,
    timeIn: InTime
  });

});


document.getElementById('BESKeepLogin').addEventListener('click', function() {
var InTime = new Date().getTime();
console.log("saving keepalive setting:"+this.checked);
chrome.storage.sync.set({
    keepalive: this.checked,
    timeIn: InTime
  });

});

console.log("telling bg we are not logged in")
chrome.runtime.sendMessage({loggedin: false}, function(response) {
  console.log(response.farewell);
});

