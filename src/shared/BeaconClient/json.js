import $ from 'jquery';


export function getJsonPaginated(url, token, pageLimit = 0, perPageLimit = 100, progresscb, cb, onPage) { //take url and a page limit and loop until a result returns less than we asked for
  var currentPage = 1;
  var totalResults = [];
  goGet(HandleResults,currentPage); //make the first call to kick off the loop

  function HandleResults(result) { //check the length of the return
    console.log("Results Returned:" + result.Results.length)
    if (typeof onPage === 'function') {
      onPage(result);
    }
    if (result.Results.length >= 1) { //add it to the array
      totalResults.push.apply(totalResults, result.Results);
      progresscb(totalResults.length,result.TotalItems)
      console.log("Total collected:"+totalResults.length+" of "+result.TotalItems);
      if (pageLimit !== currentPage) {
      if (totalResults.length < result.TotalItems) { //length of array is less than expected number
        console.log("There is more to get");
        currentPage++; //guess we should get the next
        goGet(HandleResults,currentPage);
      } else {
        console.log("pageLimit is reached, returning");
        cb(totalResults); //we are d
      }
      } else {
        console.log("Got them all");
        cb(totalResults); //we are done
      }
    } else { //last entry amazingly 0, or something is broken. lets stop
      progresscb(totalResults.length,result.TotalItems)
      console.log("Got them all");
        cb(totalResults); //we are done
      }
    }

  function goGet(cb,page) { //make the XMLHttpRequest with the given URL
    console.log("fetching page #"+page);
    $.ajax({
      type: 'GET'
      , url: url+"&PageIndex=" + page + "&PageSize=" + perPageLimit
      , beforeSend: function(n) {
        n.setRequestHeader("Authorization", "Bearer " + token)
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
          typeof progresscb === 'function' && progresscb(-1,-1)
        }
      }
    })

  }

}
