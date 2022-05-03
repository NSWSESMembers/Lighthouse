import $ from 'jquery';

export function getName(id, host, userId = 'notPassed', token, callback) {
  console.log("Client.unit.getName() called with:" + id + ", " + host);
  $.ajax({
    type: 'GET',
    url: host + "/Api/v1/Entities/" + id + "?LighthouseFunction=GetUnitNamefromBeacon&userId=" + userId,
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
