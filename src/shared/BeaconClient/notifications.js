import $ from 'jquery';

export function unaccepted(jobId, host, userId = 'notPassed', token, callback, errorCallback) {
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
      } else {
        if (typeof errorCallback === "function") {
          errorCallback(response);
        }
      }
    }
  })
}

export function acknowledge(notificationId, host, userId = 'notPassed', token, callback, errorCallback) {
  return new Promise((resolve, reject) => {
    $.ajax({
      type: 'POST',
      url: host + "/Api/v1/Notifications/" + notificationId + "/acknowledge?LighthouseFunction=AcknowledgeNotification&userId=" + userId,
      beforeSend: function(n) {
        n.setRequestHeader("Authorization", "Bearer " + token)
      },
      cache: false,
      dataType: 'json',
      complete: function(response, textStatus) {
        if (textStatus == 'success') {
          const result = response.responseJSON;
          if (typeof callback === "function") {
            callback(result);
          }
          resolve(result);
        } else {
          if (typeof errorCallback === "function") {
            errorCallback(response);
          }
          reject(response);
        }
      }
    });
  });
}