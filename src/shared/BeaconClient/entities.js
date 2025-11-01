import $ from 'jquery';

export function search(query, host, userId = 'notPassed', token, callback) {
  console.log("entities.search called with:" + query + ", " + host);
  $.ajax({
    type: 'GET',
    url: host + "/Api/v1/Entities/Search?EntityName=" + query + "&LighthouseFunction=SearchEntitiesn&userId=" + userId,
    beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + token)
    },
    cache: false,
    dataType: 'json',
    complete: function(response, textStatus) {
      if (textStatus == 'success') {
        let results = response.responseJSON;
        if (typeof callback === "function") {
          console.log("entities.search call back");
          callback(results);
        }
      } else {
        if (typeof callback === "function") {
          console.log("entities.search errored out");
          callback('', textStatus);
        }
      }
    }
  })
}