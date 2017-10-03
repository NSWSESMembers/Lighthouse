var $ = require('jquery');
var inject = require('../../../lib/inject.js');
var DOM = require('jsx-dom-factory');

window.addEventListener("message", function(event) {
  // We only accept messages from ourselves or the extension
  if (event.source != window)
    return;
  if (event.data.type && (event.data.type == "FETCH_TEAM_FILTER_COLLECTION")) {
    console.log('message')
    chrome.storage.sync.get("lighthouseTeamFilterCollections", function (data){
      window.postMessage({type: 'RETURN_TEAM_FILTER_COLLECTION', dataresult: data.lighthouseTeamFilterCollections}, '*');
    })
  } else if (event.data.type && (event.data.type == "SAVE_TEAM_FILTER_COLLECTION")) {
    chrome.storage.sync.get("lighthouseTeamFilterCollections", function (existingdata){
      try {
        var items = JSON.parse(existingdata.lighthouseTeamFilterCollections)
      } catch (e)
      {
        var items = []
      }
      items.push(JSON.parse(event.data.newdata))

      chrome.storage.sync.set({"lighthouseTeamFilterCollections":JSON.stringify(items)}, function (data){
        window.postMessage({type: 'RETURN_TEAM_FILTER_COLLECTION', dataresult: JSON.stringify(items)}, '*');

      })
    })
  } else if (event.data.type && (event.data.type == "DELETE_TEAM_FILTER_COLLECTION")) {
    chrome.storage.sync.get("lighthouseTeamFilterCollections", function (existingdata){
      try {
        var items = JSON.parse(existingdata.lighthouseTeamFilterCollections)
      } catch (e)
      {
        var items = []
      }

      items.forEach(function(item) {
        if (event.data.target == JSON.stringify(item)) {
          items.splice(items.indexOf(item), 1)
        }
      })
      chrome.storage.sync.set({"lighthouseTeamFilterCollections":JSON.stringify(items)}, function (data){
        window.postMessage({type: 'RETURN_TEAM_FILTER_COLLECTION', dataresult: JSON.stringify(items)}, '*');
      })
    })
  } 
}, false);

// inject our JS resource
inject('teams/teams.js');

// Team summary button
$('.widget-header').append(
  <a id="lighthouseTeamSummaryButton"
     class="btn btn-sm btn-default"
     style="margin-left: 20px; background: blue; color: white"
     href="#">
    <img style="width: 16px; vertical-align: top; margin-right: 5px"
         src={chrome.extension.getURL("icons/lh.png")} />
      Summary Screen
  </a>
);
