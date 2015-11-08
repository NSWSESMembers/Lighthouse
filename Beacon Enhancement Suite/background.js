
console.log("BG CODE RUNNING");

var keepalive;
var timeSignedIn;
var nowTime = new Date().getTime();
var areweloggedin = false;

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {

  		if (areweloggedin == false && request.loggedin == true) //first time we knew about loggin in
      { 
        areweloggedin = true;

        chrome.storage.sync.get({
    keepalive: false
  }, function(items) {
    keepalive = items.keepalive;

        if (keepalive == true)
        {
        console.log("log in was triggered and will look at keeping alive");
        restartSlider()
  			sendResponse({result: "Will Keepalive"});
      } else {
        console.log("new log in was triggered but user not keeping alive");
      }
    });
  		} else if (request.loggedin == false) {
        console.log("was told we are not logged in");
        areweloggedin = false;
      }
  });

var MyLoop = setTimer();


function restartSlider(){
      console.log("Restarting the Loooper!");
      if(MyLoop == null){
      MyLoop = setTimer();
    }
}


function setTimer(){
    console.log("Starting the Loooper!");
     i = setInterval(KeepAliveLoop, (15*60*1000));
     return i;
}

function stopTimer() {
  console.log("Stopping the Looper!");
  clearInterval(MyLoop);
  MyLoop = null;
}




  function KeepAliveLoop() {

chrome.tabs.query({url:"https://beacon.ses.nsw.gov.au/*"}, function(tabs) {
    if (tabs.length > 0)
      console.log("Beacon is open somewhere");
    else
      console.log("Beacon is NOT open");
});




chrome.storage.sync.get({
    keepalive: false,
    timeIn: '',
  }, function(items) {
    keepalive = items.keepalive;
    timeSignedIn = items.timeIn;


//console.log(nowTime);
console.log("signin:"+timeSignedIn);
console.log("keepalive:"+keepalive);
console.log("timediff:"+(nowTime-timeSignedIn)/1000);
var diff = (nowTime-timeSignedIn)/1000;

//if under 24hrs ago they signed in and they ticked the box and we havnt hit a 401
if (diff < 86400 && areweloggedin == true  && keepalive == true)
{
  console.log("will try keep alive");

var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
      console.log("Kept Alive");
    } else if (xhttp.readyState == 4 && xhttp.status == 500) 
    {
      stopTimer();
      console.log("Logged out I think");
      areweloggedin == false;
    chrome.storage.sync.set({
    LoggedIn: false,
  });
    }
}
  xhttp.open("GET", "https://beacon.ses.nsw.gov.au/Api/v1/Jobs/1", true);
  xhttp.send();

} else {
  stopTimer();
  console.log("We dont need to run, stopping loop");
}
});

}


//}



