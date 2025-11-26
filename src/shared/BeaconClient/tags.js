import $ from 'jquery';


//no paging. hope we never have more than 1000 tags in a group.
export function getGroup(groupId, host, userId = 'notPassed', token, callback) {
  console.log("getGroup called with:" + groupId + ", " + host);

  $.ajax({
    type: 'GET',
    url: host + "/Api/v1/Tags/Group/" + groupId + "?pageIndex=1&pageSize=1000&LighthouseFunction=getGroup&userId=" + userId,
    beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + token)
    },
    cache: false,
    dataType: 'json',
    complete: function(response, textStatus) {
      if (textStatus == 'success') {
        let results = response.responseJSON;
        if (typeof callback === "function") {
          callback(results.Results);
        }
      }
    }
  })
}
