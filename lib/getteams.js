var ReturnTeamsActiveAtLHQ = function(hq,sector,cb) {

	var now = moment();
	var end = moment();
	end.subtract(1, 'y');

	var UnitsToSearch = []

	if (hq.EntityTypeId != 1) {
		console.log("HQ Entity is not a unit, will resolve group")
		$.ajax({
			type: 'GET'
			, url: urls.Base+'/Api/v1/Entities/'+hq.Id+'/Children'
			, beforeSend: function(n) {
				n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
			}
			, data: {LighthouseFunction: 'ResolveChildrenOfEntity'}
			, cache: false
			, dataType: 'json'
			, complete: function(response, textStatus) {
				console.log('textStatus = "%s"', textStatus, response);
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

	} else {
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

		theData.AssignedToId = AssignedToId
		theData.CreatedAtId = CreatedAtId

		if (sector !== null)
		{
			theData.SectorIds = sector
			theData.Unsectorised = true
		}

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
					cb(response)
				}

			}
		})

	}
}

module.exports = ReturnTeamsActiveAtLHQ;
