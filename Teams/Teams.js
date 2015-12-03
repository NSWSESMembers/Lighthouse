console.info('Lighthouse: Teams/Teams.js');

//add summary button
$lighthouseTeamSummaryButton = jQuery('<a href="#" id="lighthouseTeamSummaryButton" class="btn btn-sm btn-default" style="margin-left:20px;background:blue;color:#FFF"><img style="width:16px;vertical-align:top;margin-right:5px" src="' + chrome.extension.getURL('lh.png') + '">Summary Screen</a>');
jQuery('.widget-header').append($lighthouseTeamSummaryButton);

//inject our JS resource
var s = document.createElement('script');
s.src = chrome.extension.getURL('/Teams/content/Teams.js');
(document.head || document.documentElement).appendChild(s)
