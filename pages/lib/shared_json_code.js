function goGetMeSomeJSONFromBeacon(url, progresscb, cb) { //take url and a page limit and loop until a result returns less than we asked for
  const perPageLimit = 300; //small for testing
  var currentPage = 1;
  var totalResults = [];
  goGet(HandleResults,currentPage); //make the first call to kick off the loop


  function HandleResults(result) { //check the length of the return
    console.log("Results Returned:" + result.Results.length)
    console.log(result);

    if (result.Results.length >= 1) { //add it to the array
      totalResults.push.apply(totalResults, result.Results);
      progresscb(totalResults.length,result.TotalItems)
      console.log("Total collected:"+totalResults.length+" of "+result.TotalItems);
      if (totalResults.length < result.TotalItems) { //length of array is less than expected number
        console.log("There is more to get");
        currentPage++; //guess we should get the next
        goGet(HandleResults,currentPage);
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
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      if (xhttp.readyState == 4 && xhttp.status == 200) {
        //try {
          console.log("Page #"+page+" is back");
          var result = JSON.parse(xhttp.responseText);
          typeof cb === 'function' &&  cb(result);
        /*} catch (e) {
          typeof progresscb === 'function' && progresscb(-1,-1);
          console.log(e);
        };*/
      } else if (xhttp.readyState == 4 && xhttp.status != 200) {
        console.log("Sending back a fail");
        typeof progresscb === 'function' && progresscb(-1,-1)
      }
    }
    console.log("fetching page #"+page);
    xhttp.open("GET", url + "&PageIndex=" + page + "&PageSize=" + perPageLimit, true);
    xhttp.send();

  }

}

module.exports = {
  get_json: goGetMeSomeJSONFromBeacon,
}
