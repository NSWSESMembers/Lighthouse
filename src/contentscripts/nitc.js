var $ = require('jquery');
var inject = require('../../lib/inject.js');
var DOM = require('jsx-dom-factory');

//NITC Screen specific Code
//add statistics and export buttons

var buttonBar = $('.nitc-page #content .widget .widget-header .btn-group.pull-left.text-left');

function makeButton(id, background, border, text) {
  $(
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

makeButton("lighthouseStatsButton", "rebeccapurple", "#4c2673", "Statistics (Filtered)");
makeButton("lighthouseExportButton", "#d2322d", "#edadab", "Advanced Export (Filtered)");

inject('nitc.js');
