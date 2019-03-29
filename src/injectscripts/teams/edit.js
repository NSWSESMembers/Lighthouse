//edit and create page.
// background js fiddles with create page to expose same viewmodel as OutageDisplayType


//replace window title with team name if set
var callsign = vm.callsign.peek();
if (typeof callsign !== 'undefined' && callsign !== null) {
  document.title = callsign;
}

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
  console.log(lead)
})
