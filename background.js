console.log("BG CODE RUNNING");

var keepalive;
var timeSignedIn;
var nowTime = new Date().getTime();
var areweloggedin = false;

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {

        if (request.activity == true) //we are active, so restart the timer
        {
            restartLooper();
        }
    });


var MyLoop = setTimer();


function restartLooper() {
    console.log("Restarting the Loooper!");
    if (MyLoop == null) {
        MyLoop = setTimer();
    }
}


function setTimer() {
    console.log("Starting the Loooper!");
    i = setInterval(KeepAliveLoop, (25 * 60 * 1000)); //10 sec (15 * 60 * 1000 would be 15 min)
    return i;
}

function stopTimer() {
    console.log("Stopping the Looper!");
    clearInterval(MyLoop);
    MyLoop = null;
}




function KeepAliveLoop() {




console.log("will check if beacon is open")
    chrome.tabs.query({
        url: "https://beacon.ses.nsw.gov.au/*"
    }, function(tabs) {
        if (tabs.length > 0)
        {
            console.log("Beacon is open somewhere");

            var r = confirm("You have been idle on Beacon for over 25 minutes. Please press OK to stay logged in, or Cancel to let your session time out");
if (r == true) {
    console.log("You pressed OK!");


            console.log("will try keep alive");

            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (xhttp.readyState == 4 && xhttp.status == 200) {
                    console.log("Kept Alive");
                    //Was hoping for a 401....but i guess 500 is means the same thing...nice coding there
                } else if (xhttp.readyState == 4 && xhttp.status == 500) {
                    stopTimer();
                    console.log("Logged out I think");
                }
            }
            xhttp.open("GET", "https://beacon.ses.nsw.gov.au/Api/v1/Jobs/1", true);
            xhttp.send();

             } else {
    console.log("You pressed Cancel!");
    stopTimer()
}

    } else
        {
            stopTimer();
            console.log("Beacon is NOT open");
        }    
    });

   

}

//}