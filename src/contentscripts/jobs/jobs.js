var $ = require('jquery');
var inject = require('../../../lib/inject.js');
var DOM = require('jsx-dom-factory');


// Add buttons to top of job screen for summary, statistics and advanced export
var buttonBar = $('div.widget.clearfix.table-widget > div.widget-header .btn-group.pull-left.text-left');

function makeButton(id, lighthousePage, background, border, text) {
  return $(
    <a href="#"
    id={id}
    data-page={lighthousePage}
    class="btn btn-sm btn-default lh-update-filter"
    style={'margin-left: 20px; background: ' + background + '; border-color: ' + border + '; color: white;'}>
    <img style="width: 16px; vertical-align: top; margin-right: 5px"
    src={chrome.extension.getURL("icons/lh.png")} />{text}
    </a>
    )
  .appendTo(buttonBar);
}

makeButton("lighthouseSummaryButton", "summary", "#175781", "#0f3a57", "Summary (Filtered)");
makeButton("lighthouseStatsButton", "stats", "rebeccapurple", "#4c2673", "Statistics (Filtered)");
makeButton("lighthouseExportButton", "advexport", "#d2322d", "#edadab", "Advanced Export (Filtered)");

//inject our JS resource
inject('jobs/jobs.js');
