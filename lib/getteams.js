var ReturnTeamsActiveAtLHQ = function(hq,sector,cb) {
	var now = moment();
	var end = moment();
	end.subtract(1, 'y');

	var UnitsToSearch = []

	if (hq.EntityTypeId == 2) { //thats a region, not state
		console.log("HQ Entity is not a unit, will resolve group")
		$.ajax({
			type: 'GET'
			, url: urls.Base+'/Api/v1/Entities/'+hq.Id+'/Children'
			, beforeSend: function(n) {
				n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
			}
			, data: {LighthouseFunction: 'LibGetTeamsResolveChildrenOfEntity'}
			, cache: false
			, dataType: 'json'
			, complete: function(response, textStatus) {
				if(textStatus == 'success')
				{
					if(response.responseJSON.length) {
						$.each(response.responseJSON, function(k,v){
							UnitsToSearch.push(v.Id);
						})
					}
					GetTeams(UnitsToSearch)
				}
			}
		})

	} else if (hq.EntityTypeId == 3) { //state. dont push anything, fetch them all.
		GetTeams(UnitsToSearch)

	} else { //its a single unit
		UnitsToSearch.push(hq.Id)
		GetTeams(UnitsToSearch)

	}

	function GetTeams(UnitsToSearch) {

		var theData = {
			'StartDate':          end.toISOString()
			, 'EndDate':            now.toISOString()
			, 'TypeIds[]':          1
			, 'IncludeDeleted':     false
			, 'StatusTypeId[]':     3
			, 'PageIndex':          1
			, 'PageSize':           1000
			, 'SortField':          'Callsign'
			, 'SortOrder':          'asc'
			,'LighthouseFunction': 'getteams' 
		}

		var AssignedToId = []
		var CreatedAtId = []
		$.each(UnitsToSearch, function(k,v){
			AssignedToId.push(v)
			CreatedAtId.push(v)
		})

		if (UnitsToSearch.length >= 1) //if theres a filter, use it otherwise send nothing meaning 'all hqs'
		{
			theData.AssignedToId = AssignedToId
			theData.CreatedAtId = CreatedAtId
		}
		if (sector !== null)
		{
			theData.SectorIds = sector
			theData.Unsectorised = true
		}

		theData.LighthouseFunction = 'LibGetTeamsSearch'

		$.ajax({
			type: 'GET'
			, url: urls.Base+'/Api/v1/Teams/Search'
			, beforeSend: function(n) {
				n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
			}
			, data: theData
			, cache: false
			, dataType: 'json'
			, complete: function(response, textStatus) {
				if(textStatus == 'success')
				{
					if (hq.EntityTypeId != 1) { //thats a region, or state, not unit
						$.each(response.responseJSON.Results,function(k,v){
							v.Callsign = '('+v.CreatedAt.Code+') '+v.Callsign
						})
					}
					cb(response)
				}

			}
		})

	}
}

module.exports = ReturnTeamsActiveAtLHQ;
