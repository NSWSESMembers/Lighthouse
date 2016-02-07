var $ = require('jquery');
var inject = require('../../lib/inject.js');
var DOM = require('jsx-dom-factory');

//NITC Screen specific Code
//add export button
var bar = document.getElementsByClassName("btn-group pull-left text-left");

var bar = $('.nitc-page #content .widget .widget-header .btn-group.pull-left.text-left');

$(
  <a href="#"
     id="lighthouseExportButton"
     class="btn btn-sm btn-default"
     style="margin-left: 20px; background: #d2322d; border-color: #edadab; color: white">
    <img style="width: 16px; vertical-align: top; margin-right: 5px"
         src={chrome.extension.getURL("icons/lh.png")} />Export (Filtered)
  </a>
)
.appendTo(bar);

inject('nitc.js');
