// eslint-disable-next-line @typescript-eslint/no-unused-vars
var DOM = require('jsx-dom-factory').default;
var encodedJson = document.getElementById("modelJson").textContent.replace(/&quot;/g, '"');
var model = JSON.parse(encodedJson);


if (model.clientName == "beacon" || model.clientName == "beacon Train" ||  model.clientName == "beacon Preview")//only run if we are logging into a beacon page.
{
  var $ = require('jquery/dist/jquery.min');
  require('../pages/lib/shared_chrome_code.js'); // side-effect

  let version = 'v'+chrome.manifest.version+' '+(chrome.manifest.name.includes("Development") ? "Development" : "Production")
  $('body').append(
    <span id ='lhbg'>
    <div class="col-xs-12" style="position:fixed;bottom:0px;right:0px;width:600px;text-align:right;margin-right:-10px;color:white">
    <small>Running Lighthouse extension {version} edition.</small>
    <div><small>Designed & developed by volunteers of the NSW SES. Lighthouse is distributed under an MIT Licence.</small></div>
    </div>
    </span>
    );


  $('#lhbg').css({ 'z-index':'-100', 'background-image': 'url('+chrome.extension.getURL("icons/lhbackdrop_dark.png")+')','background-repeat': 'no-repeat', 'background-size': 'auto 70%','background-position': 'bottom right','width': '100%','height':'100%','position':'absolute','top': '0px'})

}
