/* global teamViewModel, $, _, ko */
//edit and create page.
// background js fiddles with create page to expose same viewmodel as OutageDisplayType


//replace window title with team name if set
var callsign = teamViewModel.callsign.peek();
if (typeof callsign !== 'undefined' && callsign !== null) {
  document.title = callsign;
}

//prefill members from a ?lhmembers=[id,id,...] param - same
//lhquickrecipient-style pattern messages/create.js uses for jobId/recipients
function parse_query_string(query) {
  var vars = query.split('&');
  var query_string = {};
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    if (typeof query_string[pair[0]] === 'undefined') {
      query_string[pair[0]] = decodeURIComponent(pair[1]);
    } else if (typeof query_string[pair[0]] === 'string') {
      var arr = [query_string[pair[0]], decodeURIComponent(pair[1])];
      query_string[pair[0]] = arr;
    } else {
      query_string[pair[0]].push(decodeURIComponent(pair[1]));
    }
  }
  return query_string;
}

// memberId here is a RegistrationNumber (mams's identifier), not Beacon's
// internal Person.Id, so lookup goes through PersonManager.SearchPeople.
// ViewModelType: 3 (Enum.PeopleViewModelType.Team.Id, same type
// loadPeople() requests) gets back a person shaped correctly to add
// straight to the team, no separate GetPersonById needed. Prefer an
// already-loaded person from teamViewModel.people() when there's a match
// (has isSelected wired up already); otherwise the search result needs
// isSelected manually attached as a ko.observable before addPersonToTeam
// can call person.isSelected(true) on it.
async function addTeamMemberById(memberId) {
  var matched = _.find(teamViewModel.people(), function (p) { return String(p.RegistrationNumber) === String(memberId); });

  if (!matched) {
    try {
      var searchResponse = await teamViewModel.PersonManager.SearchPeople({ RegistrationNumber: String(memberId), ViewModelType: 2 });
      var data = searchResponse && searchResponse.Results && searchResponse.Results[0];
      if (!data) {
        console.log('lighthouse: could not find person for registration number ' + memberId + ' to add to team');
        return;
      }
      data.isSelected = ko.observable(false);
      matched = data;
    } catch (err) {
      console.log('lighthouse: error looking up person ' + memberId + ' to add to team - ' + (err && err.message));
      return;
    }
  }

  teamViewModel.addPersonToTeam(matched);
}

// Sets the team's Assigned To HQ to the incident's own HQ (rather than
// leaving it defaulted to whatever HQ the person creating the team is
// logged in under) - GetEntityById is async and resolves to the full
// entity object entityAssignedTo expects, not just an id.
async function setTeamEntityById(entityId) {
  try {
    var entity = await teamViewModel.EntityManager.GetEntityById(entityId);
    if (entity) {
      teamViewModel.entityAssignedTo(entity);
    }
  } catch (err) {
    console.log('lighthouse: error loading entity ' + entityId + ' to assign team to - ' + (err && err.message));
  }
}

$(document).ready(function () {
  var query = window.location.search.substring(1);
  if (!query) return;
  var qs = parse_query_string(query);

  teamViewModel.setSelectedTeamType({ Id: 1 });

  if (typeof qs.lhmembers !== 'undefined') {
    var memberIds = JSON.parse(unescape(qs.lhmembers));
    $.each(memberIds, function (k, memberId) {
      addTeamMemberById(memberId);
    });
  }

  if (typeof qs.lhentityid !== 'undefined' && qs.lhentityid !== 'null') {
    var desiredEntityId = unescape(qs.lhentityid);

    // The Team Create page can default Assigned To on its own (e.g. to the
    // creating user's home HQ) shortly after load - if we set ours first,
    // its default overwrites us straight after. Wait for entityAssignedTo
    // to actually get defined once, then apply ours right after and stop
    // listening, so we always land last regardless of who's first.
    if (teamViewModel.entityAssignedTo.peek()) {
      setTeamEntityById(desiredEntityId);
    } else {
      var entityDefinedSub = teamViewModel.entityAssignedTo.subscribe(function () {
        entityDefinedSub.dispose();
        setTeamEntityById(desiredEntityId);
      });
    }
  }
});

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
