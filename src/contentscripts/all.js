var inject = require('../../lib/inject.js');
var $ = require('jquery');
var DOM = require('jsx-dom-factory');
var LighthouseChrome = require('../../pages/lib/shared_chrome_code.js');

  // inject JS that is to run on every page in page context
inject('all.js');

// inject all.css - browserify-css takes care of this
require('../styles/all.css');

//set the extension code var into the head
var s = document.createElement('script');
s.setAttribute('type', 'text/javascript');
s.innerHTML = "var lighthouseUrl = \"" + chrome.extension.getURL("") + "\";\n var lighthouseEnviroment = \"" +(chrome.manifest.name.includes("Development") ? "Development" : "Production")+"\";\n";

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
