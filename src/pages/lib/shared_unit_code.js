var $ = require('jquery');

export function get_unit_name(Id, host, userId = 'notPassed', token, callback) {
  console.log("GetUnitNamefromBeacon called with:" + Id + ", " + host);
  $.ajax({
    type: 'GET',
    url: host + "/Api/v1/Entities/" + Id + "?LighthouseFunction=GetUnitNamefromBeacon&userId=" + userId,
    beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + token)
    },
    cache: false,
    dataType: 'json',
    complete: function(response, textStatus) {
      if (textStatus == 'success') {
        let results = response.responseJSON;
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
