console.info('Lighthouse: Teams/Jobs.js');

//inject our JS resource
var s = document.createElement('script');
s.src = chrome.extension.getURL('/Teams/content/Jobs.js');
(document.head || document.documentElement).appendChild(s)
