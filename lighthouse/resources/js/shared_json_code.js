function goGetMeSomeJSONFromBeacon(url, progresscb, cb) { //take url and a page limit and loop until a result returns less than we asked for
        const perPageLimit = 300; //small for testing
        var currentPage = 0;
        var totalResults = [];
        goGet(HandleResults); //make the first call to kick off the loop
        function HandleResults(result) { //check the length of the return
            console.log("Results Returned :" + result.Results.length)
            console.log(result);
            if (result.Results.length == perPageLimit) //number of results is the limit, must be more to get.
            {
                totalResults.push.apply(totalResults, result.Results);
                progresscb(totalResults.length,result.TotalItems)
                console.log("Total collected:"+totalResults.length);
                goGet(HandleResults);

            } else {
                console.log("Got them all");
                totalResults.push.apply(totalResults, result.Results);
                progresscb(totalResults.length,result.TotalItems)
                console.log("Total collected:"+totalResults.length);
                cb(totalResults); //we are done
            }
        }
        function goGet(cb) { //make the XMLHttpRequest with the given URL
            var xhttp = new XMLHttpRequest();
            currentPage++;
            xhttp.onreadystatechange = function() {
                if (xhttp.readyState == 4 && xhttp.status == 200) {
                    //console.log(xhttp.responseText);

                    try {
                        console.log("Page #"+currentPage+" is back");
                        var result = JSON.parse(xhttp.responseText);
                        cb(result);
                    } catch (e) {
                        progresscb(-1,-1);
                        //throw new Error('Error talking with beacon. JSON result isnt valid');
                        console.log(e);
                    };
                } else if (xhttp.readyState == 4 && xhttp.status != 200) {
                    console.log("Sending back a fail");
                    progresscb(-1,-1)
                }
            }
            console.log("fetching page #"+currentPage);
            xhttp.open("GET", url + "&PageIndex=" + currentPage + "&PageSize=" + perPageLimit, true);
            xhttp.send();

        }

    }