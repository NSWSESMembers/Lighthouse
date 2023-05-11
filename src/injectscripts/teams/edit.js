/* global vm, $ */
//edit and create page.
// background js fiddles with create page to expose same viewmodel as OutageDisplayType


//replace window title with team name if set
var callsign = teamViewModel.callsign.peek();
if (typeof callsign !== 'undefined' && callsign !== null) {
  document.title = callsign;
}

//when team members change
teamViewModel.members.subscribe(function() {
  // auto set the first team member as TL
  var lead = false
  $.each(teamViewModel.members.peek(), function(k, v) {
    if (v.TeamLeader.peek()) {
      lead = true
    }
  })
  if (!lead && teamViewModel.members.peek().length) { //we have no leader
    console.log("setting team leader to first member in team")
    teamViewModel.setTeamLeader(teamViewModel.members.peek()[0])
  }
})
