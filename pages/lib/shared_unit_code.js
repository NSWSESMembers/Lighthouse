var $ = require('jquery');

function GetUnitNamefromBeacon(Id, host, token, callback) {
  console.log("GetUnitNamefromBeacon called with:" + Id + ", " + host);
  $.ajax({
    type: 'GET',
    url: host + "/Api/v1/Entities/" + Id,
    beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + token)
    },
    cache: false,
    dataType: 'json',
    complete: function(response, textStatus) {
      if (textStatus == 'success') {
        results = response.responseJSON;
        if (typeof callback === "function") {
          console.log("GetUnitNamefromBeacon call back");
          callback(results);
        }
      } else {
        if (typeof callback === "function") {
          console.log("GetUnitNamefromBeacon errored out");
          callback('', textStatus);
        }
      }
    }
  })
}

module.exports = {
  get_unit_name: GetUnitNamefromBeacon
}
