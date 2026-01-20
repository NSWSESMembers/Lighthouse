import $ from 'jquery';

export function getIncidentImages(id, host, userId = 'notPassed', token, callback) {
  $.ajax({
    type: 'GET',
    url: host + "/Api/v1/Image/IncidentThumbnails/" + id + "?LighthouseFunction=getIncidentThumbnails&userId=" + userId,
    beforeSend: function (n) {
      n.setRequestHeader("Authorization", "Bearer " + token)
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        callback(response.responseJSON);
      } else {
        callback(null);
      }
    }
  });
}

// Returns raw image data as a Blob
export function getImageData(jobId, imageId, host, userId = 'notPassed', token, callback) {
  const xhr = new XMLHttpRequest();
  const url = host + "/Api/v1/Image/IncidentImage/" + jobId + "/" + imageId + "/?LighthouseFunction=getImageData&userId=" + userId;
  xhr.open('GET', url, true);
  xhr.setRequestHeader("Authorization", "Bearer " + token);
  xhr.responseType = 'blob';
  xhr.onload = function () {
    if (xhr.status >= 200 && xhr.status < 300) {
      callback(xhr.response);
    } else {
      callback(null);
    }
  };
  xhr.onerror = function () {
    callback(null);
  };
  xhr.send();
}
