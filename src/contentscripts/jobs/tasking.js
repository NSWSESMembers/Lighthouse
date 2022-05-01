var inject = require('../../lib/inject.js');
var $ = require('jquery');
const MapManager = require('../../lib/map/ContentScriptMapManager.js').default;
var DOM = require('jsx-dom-factory').default;


// Add team create button to team tab
$(
  <a href="/Teams/Create"
     role="button"
     class="btn btn-sm btn-success"
     target="_blank">
    <i class="fa fa-plus"></i> Create new Team
  </a>
).appendTo('#team > div > div > div.widget-header');
     //data-bind="css: {disabled: !user.isInRole(Enum.RoleEnum.TeamManagement.Id)}">

// Add job create button to job tab
$(
  <a class="btn btn-sm btn-success create-new-btn"
     href="/Jobs/Create">
    <i class="fa fa-plus"></i> Create new Job
  </a>
).appendTo('#job > div > div > div.widget-header');

// Add Other Layers sub heading
$(
  <li id="other-menu" class="menu-heading sub-heading">
  Other Layers
  </li>
).appendTo('#filter > nav > ul');

//inject the coded needed to fix visual problems
//needs to be injected so that it runs after the DOMs are created
inject('jobs/tasking.js');

const mapManager = new MapManager();

// Add the buttons for the extra layers
let otherMenu = $('#other-menu');
MapManager.createLayerMenu().insertAfter(otherMenu);
mapManager.initialise();
