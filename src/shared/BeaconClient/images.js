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

//returns a image/jpeg
export function getImageData(jobId, imageId, host, userId = 'notPassed', token, callback) {
  $.ajax({
    type: 'GET',
    url: host + "/Api/v1/Image/IncidentImage/" + jobId + "/" + imageId + "/?LighthouseFunction=getImageData&userId=" + userId,
    beforeSend: function (n) {
      n.setRequestHeader("Authorization", "Bearer " + token)
    },
    cache: false,
    xhrFields: {
      responseType: 'arraybuffer'
    },
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        callback(response.response);
      } else {
        callback(null);
      }
    }
  });
}