/* global vm, $ */
//edit and create page.
// background js fiddles with create page to expose same viewmodel as OutageDisplayType

var recentActivations = require('../../lib/teamRecentActivations.js');

//replace window title with team name if set
vm.callsign.subscribe(function() {
var callsign = vm.callsign.peek();
if (typeof callsign !== 'undefined' && callsign !== null) {
  document.title = `${callsign} - Edit`;
}
})

// ---- Recent Activations fieldset ----
// Lets an editor expand a recent activation for the assigned-to unit and
// click a name from its responses straight into the team. Shared with the
// Team Create page - see lib/teamRecentActivations.js.
recentActivations.initRecentActivationsFieldset(vm);

//when team members change
vm.members.subscribe(function() {
  // auto set the first team member as TL
  var lead = false
  $.each(vm.members.peek(), function(k, v) {
    if (v.TeamLeader.peek()) {
      lead = true
    }
  })
  if (!lead && vm.members.peek().length) { //we have no leader
    console.log("setting team leader to first member in team")
    vm.setTeamLeader(vm.members.peek()[0])
  }
})
