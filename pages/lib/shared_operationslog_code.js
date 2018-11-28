var $ = require('jquery');
//limited to 1000 calls. no paging support
function GetOperationsLogfromBeacon(Id, host, token, callback) {  
  $.ajax({
    type: 'GET'
    , url: host+"/Api/v1/OperationsLog/search?JobIds%5B%5D="+Id+"&PageIndex=1&PageSize=1000&SortOrder=desc&SortField=TimeLogged"
    , beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + token)
    }
    , cache: false
    , dataType: 'json'
    , complete: function(response, textStatus) {
      if (textStatus == 'success')
      {
        results = response.responseJSON;
        if (typeof callback === "function") {
        callback(results);
}
}
}
})
}

module.exports = {
  get_operations_log: GetOperationsLogfromBeacon
}
