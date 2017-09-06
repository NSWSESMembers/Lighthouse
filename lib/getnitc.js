var ReturnNitcAtLHQ = function(hq,size,cb) {
	var start = moment();
	var end = moment();
	end.subtract(15, 'd');
	start.add(15, 'd');


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
						GetEvents(UnitsToSearch)
					}
				}
			})

	} else if (hq.EntityTypeId == 3) { //state. dont push anything, fetch them all.
		GetEvents(UnitsToSearch)

	} else { //its a single unit
		UnitsToSearch.push(hq.Id)
		GetEvents(UnitsToSearch)

	}

	function GetEvents(UnitsToSearch) {

		var theData = {
			'StartDate':          end.toISOString()
			, 'EndDate':            start.toISOString()
			, 'IncludeCompleted':     true
			, 'PageIndex':          1
			, 'PageSize':           size
			, 'SortField':          'Id'
			, 'SortOrder':          'desc'
			,'LighthouseFunction': 'getnitc' 
		}

		var entityIds = []
		$.each(UnitsToSearch, function(k,v){
			entityIds.push(v)
		})

		if (UnitsToSearch.length >= 1) //if theres a filter, use it otherwise send nothing meaning 'all hqs'
		{
			theData.entityIds = entityIds
		}

		$.ajax({
			type: 'GET'
			, url: urls.Base+'/Api/v1/NonIncident/search'
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
							v.Name = '('+v.CreatedAt.Code+') '+v.Name
						})
					}

				}
				cb(response)
			}
		})

	}
}

module.exports = ReturnNitcAtLHQ;
