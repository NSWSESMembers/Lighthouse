var $ = require('jquery');

function GetResourcesfromBeacon(Id, host, userId = 'notPassed', token, callback) {
  console.log("GetResourcesfromBeacon called with:" + Id + ", " + host);

  $.ajax({
    type: 'GET',
    url: host + "/Api/v1/Entities/" + Id + "?LighthouseFunction=GetResourcesfromBeacon&userId=" + userId,
    beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + token)
    },
    cache: false,
    dataType: 'json',
    complete: function(response, textStatus) {
      if (textStatus == 'success') {
        results = response.responseJSON;
        if (typeof callback === "function") {
          console.log("GetResourcesfromBeacon call back with:");
          console.log(results); //.Results);
          callback(results);
        }
      }
    }
  })
}

module.exports = {
  get_unit_resouces: GetResourcesfromBeacon
}
