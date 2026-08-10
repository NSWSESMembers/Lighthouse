import $ from 'jquery';

export function getSimplePerson(personId, host, userId = 'notPassed', token, callback, errorCallback) {
  $.ajax({
    type: 'GET',
    url: host + '/Api/v1/People/GetSimplePerson/' + encodeURIComponent(personId) + '?LighthouseFunction=GetSimplePerson&userId=' + userId,
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        if (typeof callback === 'function') {
          callback(response.responseJSON);
        }
      } else {
        if (typeof errorCallback === 'function') {
          errorCallback(response);
        }
      }
    }
  });
}
