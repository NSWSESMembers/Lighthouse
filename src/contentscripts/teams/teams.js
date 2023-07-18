var $ = require('jquery');
var inject = require('../../lib/inject.js');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
var DOM = require('jsx-dom-factory').default;

// inject our JS resource
inject('teams/teams.js');

// Team summary button
$('.widget-header').append(
  <a id="lighthouseTeamSummaryButton"
     class="btn btn-sm btn-default"
     style="margin-left: 20px; background: blue; color: white"
     href="#">
    <img style="width: 16px; vertical-align: top; margin-right: 5px"
         src={chrome.runtime.getURL("icons/lh.png")} />
      Summary Screen
  </a>
);
