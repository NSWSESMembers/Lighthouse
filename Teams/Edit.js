console.info('Lighthouse: Teams/Edit.js');

//inject our JS resource
var s = document.createElement('script');
s.src = chrome.extension.getURL('/Teams/content/Edit.js');
(document.head || document.documentElement).appendChild(s)
