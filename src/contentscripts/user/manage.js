var $ = require('jquery');
var inject = require('../../lib/inject.js');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
var DOM = require('jsx-dom-factory').default;


var buttonBar = $('div.widget div.widget-header');


$(<span><img style="width:16px;vertical-align:middle;margin-right:3px;margin-left:5px"
		src={chrome.runtime.getURL("icons/lh-black.png")} /> Hover over an orange permission box to see a description</span>).appendTo(buttonBar)


inject('user/manage.js');
