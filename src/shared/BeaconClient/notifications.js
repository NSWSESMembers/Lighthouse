import $ from 'jquery';

export function unaccepted(jobId, host, userId = 'notPassed', token, callback) {
  $.ajax({
    type: 'GET',
    url: host + "/Api/v1/Jobs/" + jobId + "/unacceptednotifications?LighthouseFunction=GetUnacceptedNotifications&userId=" + userId,
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