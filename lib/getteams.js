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
			, 'SortField':          'statustimestamp'
			, 'SortOrder':          'desc'
		}

		const perPageLimit = 250;
		var currentPage = 1;
		var totalResults = [];

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

		goGet(HandleResults,currentPage); //make the first call to kick off the loop





	function HandleResults(result) { //check the length of the return
		console.log("Results Returned:" + result.Results.length)

    if (result.Results.length >= 1) { //add it to the array
    	totalResults.push.apply(totalResults, result.Results);
    	console.log("Total collected:"+totalResults.length+" of "+result.TotalItems);
      if (totalResults.length < result.TotalItems) { //length of array is less than expected number
      	console.log("There is more to get");
        currentPage++; //guess we should get the next
        goGet(HandleResults,currentPage);
    } else {
    	console.log("Got them all");
        if (hq.EntityTypeId != 1) { //thats a region, or state, not unit
        	$.each(totalResults,function(k,v){
        		v.Callsign = '('+v.CreatedAt.Code+') '+v.Callsign
        	})
        }
        response = {}
        response.responseJSON = {}
        response.responseJSON.Results = totalResults
        console.log(response)
        cb(response); //we are done
    }
    } else { //last entry amazingly 0, or something is broken. lets stop
    	console.log("none"); 
    	response = {}
    	response.responseJSON = {}
    	response.responseJSON.Results = []
    	console.log(response)
        cb(response); //we are done 
    }
}


  function goGet(cb,page) { //make the XMLHttpRequest with the given URL
  	console.log("fetching page #"+page);
  	theData.PageIndex = page
  	theData.perPageLimit = perPageLimit
  	$.ajax({
  		type: 'GET'
  		, url: urls.Base+'/Api/v1/Teams/Search'
  		, data: theData
  		, beforeSend: function(n) {
  			n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
  		}
  		, cache: false
  		, dataType: 'json'
  		, complete: function(response, textStatus) {
  			if (textStatus == 'success')
  			{
  				console.log("Page #"+page+" is back");
  				var result = response.responseJSON;
  				typeof cb === 'function' &&  cb(result);
  			} else {
  				console.log("Sending back a fail");
  				typeof cb === 'function' &&  cb(null);

  			}
  		}
  	})

  }
}
}

module.exports = ReturnTeamsActiveAtLHQ;
