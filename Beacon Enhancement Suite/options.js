var finalunitid;
var finalunitname;
var finalunitcode;

window.addEventListener("load", function load(event){
});

document.getElementById("resolve").addEventListener("click",function() {

  var results;
  var unitname = document.getElementById('unitname').value;



var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
     console.log(xhttp.responseText);
     results = JSON.parse(xhttp.responseText);
     console.log(results.Results[0].Id)
     finalunitid = results.Results[0].Id;
     finalunitname = results.Results[0].Name;
     finalunitcode = results.Results[0].Code;

     document.getElementById('unitname').value = finalunitname;

     document.getElementById("save").disabled = false;

    }
  }
  xhttp.open("GET", "https://beacon.ses.nsw.gov.au/Api/v1/Entities/Search?EntityName="+unitname+"&PageIndex=1&PageSize=10", true);
  xhttp.send();





});


// Saves options to chrome.storage
function save_options() {
  var time = document.getElementById('time').value;
  chrome.storage.sync.set({
    unitname: finalunitname,
    unitcode: finalunitcode,
    unitid: finalunitid,
    time: time
  }, function() {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
      window.location.replace("popup.html");
    }, 1000);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.sync.get({
    unitname: 'Parramatta',
    unitcode: 'PAR', 
    unitid: '199',
    time: 'today'
  }, function(items) {
    document.getElementById('time').value = items.time;
    document.getElementById('unitname').value = items.unitname;
    finalunitname = items.unitname;
    finalunitid = items.unitid;
    finalunitcode = items.unitcode;
  });
       document.getElementById("save").disabled = false;

}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click',
    save_options);