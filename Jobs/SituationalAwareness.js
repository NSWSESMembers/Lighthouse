console.info('Lighthouse: Jobs/Situational Awareness.js');

//inject the coded needed to fix visual problems
//needs to be injected so that it runs after the DOMs are created
var s = document.createElement('script');
s.src = chrome.extension.getURL('Jobs/content/SituationalAwareness.js');
(document.head || document.documentElement).appendChild(s)
