import { getJsonPaginated } from './json.js';
import $ from 'jquery';


//make the call to beacon
export function search(StartDate, EndDate, host, userId = 'notPassed', token, callback, progressCallBack, onPage) {
  console.debug("FRAO Search called", StartDate, EndDate, host, userId);
  let params = {};
  params['StatusStartDate'] = StartDate.toISOString();
  params['StatusEndDate'] = EndDate.toISOString();
  params['SortField'] = 'FRAONumber';
  params['SortOrder'] = 'desc';



  var url = host+"/Api/v1/FloodRescueAreaOperations/Search?LighthouseFunction=GetJSONFRAO&userId=" + userId + "&" + $.param(params, true);
  var lastDisplayedVal = 0 ;
  getJsonPaginated(
    url, token, 0, 50,
    function(count,total){
      if (count > lastDisplayedVal) { //buffer the output to that the progress alway moves forwards (sync loads suck)
        lastDisplayedVal = count;
        progressCallBack(count,total);
      }
      if (count == -1 && total == -1) { //allow errors
        progressCallBack(count,total);
      }

    },
    function(results) { //call for the JSON, rebuild the array and return it when done.
      console.debug("GetJSONfromBeacon call back");
      var obj = {
        "Results": results
      };
      callback(obj);
    }, function (pageResult) {
      if (typeof onPage === 'function') {
        onPage(pageResult);
      }
    }
  );

}