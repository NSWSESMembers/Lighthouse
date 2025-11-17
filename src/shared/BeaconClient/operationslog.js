import $ from 'jquery';

//limited to 1000 calls. no paging support
export function search(Id, host, userId = 'notPassed', token, callback) {
  $.ajax({
    type: 'GET',
    url: host + "/Api/v1/OperationsLog/search?LighthouseFunction=GetOperationsLogfromBeacon&userId=" + userId + "&JobIds%5B%5D=" + Id + "&PageIndex=1&PageSize=1000&SortOrder=desc&SortField=TimeLogged",
    beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + token)
    },
    cache: false,
    dataType: 'json',
    complete: function(response, textStatus) {
      if (textStatus == 'success') {
        let results = response.responseJSON;
        if (typeof callback === "function") {
          callback(results);
        }
      }
    }
  })
}


export function get(entryId, host, userId = 'notPassed', token, callback) {
  $.ajax({
    type: 'GET',
    url: host + "/Api/v1/OperationsLog/" + entryId + "?LighthouseFunction=GetOperationsLogEntryfromBeacon&userId=" + userId,
    beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + token)
    },
    cache: false,
    dataType: 'json',
    complete: function(response, textStatus) {
      if (textStatus == 'success') {
        let results = response.responseJSON;
        if (typeof callback === "function") {
          callback(results);
        }
      }
    }
  })
}

export function create(host, payloadFormEncoded, token, callback) {
  $.ajax({
    type: 'POST',
    url: host + '/Api/v1/OperationsLog',
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    data: payloadFormEncoded,                               
    cache: false,
    contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
    processData: false,

    complete: function (response, textStatus) {
      if (textStatus === 'success') {
        if (typeof callback === 'function') {
          callback(response.responseJSON);
        }
      } else {
        console.error("OpsLog POST failed", response);
      }
    }
  });
}