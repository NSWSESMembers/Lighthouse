var inject = require('../../lib/inject.js');
var $ = require('jquery');
var DOM = require('jsx-dom-factory');

  // inject JS that is to run on every page in page context
inject('all.js');

// inject all.css - browserify-css takes care of this
require('../styles/all.css');

// notify keep alive system that a new page has been loaded (and therefore the
// user's session has been refreshed)
console.log("telling the keep alive system we are still active")
chrome.runtime.sendMessage({activity: true});

// notify keep alive system whenever we click on something. We let the event
// propagate because we don't want to interfere with regular operation of <a>
$('a').click(function(e) {
  chrome.runtime.sendMessage({activity: true, link: this},function(){});
});
// notify keepalive system 
$(window).focus(function(){
  console.log('Focus');
  chrome.runtime.sendMessage({focus: true},function(){});
});



//set the extension code var into the head
var s = document.createElement('script');
s.setAttribute('type', 'text/javascript');
s.innerHTML = "var lighthouseUrl = \"" + chrome.extension.getURL("") + "\"";
(document.head || document.documentElement).appendChild(s)


$(document).ready(function(){



  // Map Mouse Eating Stopper
  if( ( $map = $('#map') ).length && ('#map_zoom_slider',$map).length ){
    var $mapblock = $(
      <div id="lighthouse_mapblock">
        <div>Click to zoom or move map</div>
      </div>
    );

    $mapblock
      .click(function(e){
        $(this).hide();
        e.stopPropagation();
      });

    $('#map')
      .append($mapblock)
      .mouseleave(function(e) {
        $mapblock.show();
      });
  }

});
