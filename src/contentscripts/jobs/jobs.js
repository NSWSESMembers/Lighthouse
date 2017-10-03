var $ = require('jquery');
var inject = require('../../../lib/inject.js');
var DOM = require('jsx-dom-factory');

window.addEventListener("message", function(event) {
  // We only accept messages from ourselves or the extension
  if (event.source != window)
    return;
  if (event.data.type && (event.data.type == "FETCH_JOB_FILTER_COLLECTION")) {
    chrome.storage.sync.get("lighthouseJobFilterCollections", function (data){
      window.postMessage({type: 'RETURN_JOB_FILTER_COLLECTION', dataresult: data.lighthouseJobFilterCollections}, '*');
    })
  } else if (event.data.type && (event.data.type == "SAVE_JOB_FILTER_COLLECTION")) {
    chrome.storage.sync.get("lighthouseJobFilterCollections", function (existingdata){
      try {
        var items = JSON.parse(existingdata.lighthouseJobFilterCollections)
      } catch (e)
      {
        var items = []
      }
      items.push(JSON.parse(event.data.newdata))

      chrome.storage.sync.set({"lighthouseJobFilterCollections":JSON.stringify(items)}, function (data){
        window.postMessage({type: 'RETURN_JOB_FILTER_COLLECTION', dataresult: JSON.stringify(items)}, '*');

      })
    })
  } else if (event.data.type && (event.data.type == "DELETE_JOB_FILTER_COLLECTION")) {
    chrome.storage.sync.get("lighthouseJobFilterCollections", function (existingdata){
      try {
        var items = JSON.parse(existingdata.lighthouseJobFilterCollections)
      } catch (e)
      {
        var items = []
      }

      items.forEach(function(item) {
        if (event.data.target == JSON.stringify(item)) {
          items.splice(items.indexOf(item), 1)
        }
      })
      chrome.storage.sync.set({"lighthouseJobFilterCollections":JSON.stringify(items)}, function (data){
        window.postMessage({type: 'RETURN_JOB_FILTER_COLLECTION', dataresult: JSON.stringify(items)}, '*');
      })
    })
  } 
}, false);


// Add buttons to top of job screen for summary, statistics and advanced export
var buttonBar = $('.job-page .job-reg-widget .btn-group.pull-left.text-left');

function makeButton(id, background, border, text) {
  return $(
    <a href="#"
    id={id}
    class="btn btn-sm btn-default"
    style={'margin-left: 20px; background: ' + background + '; border-color: ' + border + '; color: white;'}>
    <img style="width: 16px; vertical-align: top; margin-right: 5px"
    src={chrome.extension.getURL("icons/lh.png")} />{text}
    </a>
    )
  .appendTo(buttonBar);
}

makeButton("lighthouseSummaryButton", "#175781", "#0f3a57", "Summary (Filtered)");
makeButton("lighthouseStatsButton", "rebeccapurple", "#4c2673", "Statistics (Filtered)");
makeButton("lighthouseExportButton", "#d2322d", "#edadab", "Advanced Export (Filtered)");

//inject our JS resource
inject('jobs/jobs.js');
