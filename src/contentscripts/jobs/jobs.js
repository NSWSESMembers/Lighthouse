var $ = require('jquery');
var inject = require('../../../lib/inject.js');
var DOM = require('jsx-dom-factory');

// Add buttons to top of job screen for summary, statistics and advanced export
var buttonBar = $('.job-page .job-reg-widget .btn-group.pull-left.text-left');

function makeButton(id, page, background, border, text) {
  return $(
    <a href="#"
       data-page={page}
       id={id}
       class="btn btn-sm btn-default"
       style={'margin-left: 20px; background: ' + background + '; border-color: ' + border + '; color: white;'}
       title={'[Lighthouse] ' + text + ' (Filtered)'}
       target="_blank">
      <img style="width: 16px; vertical-align: top; margin-right: 5px"
           src={chrome.extension.getURL("icons/lh.png")} />{text}
    </a>
  )
  .appendTo(buttonBar);
}

makeButton("lighthouseSummaryButton",  'summary',        "#175781",       "#0f3a57", "Summary");
makeButton("lighthouseStatsButton",    'stats',          "rebeccapurple", "#4c2673", "Statistics");
makeButton("lighthouseExportButton",   'advexport',      "#d2322d",       "#edadab", "Advanced Export");
makeButton("lighthouseHardcopyButton", 'exporthardcopy', "#175781",       "#0f3a57", "Export Hardcopy");

//inject our JS resource
inject('jobs/jobs.js');
