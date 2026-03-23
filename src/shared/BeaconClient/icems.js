import $ from 'jquery';

export function getMessageById(id, host, userId = 'notPassed', token, callback, errorCallback) {
  $.ajax({
    type: 'GET',
    url: host + '/Api/v1/Icems/messages/' + id + '?LighthouseFunction=GetMessageById&userId=' + userId,
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

export function getIncident(incidentIdentifier, host, userId = 'notPassed', token, callback, errorCallback) {
  $.ajax({
    type: 'GET',
    url: host + '/Api/v1/Icems/incidents/' + encodeURIComponent(incidentIdentifier) + '?LighthouseFunction=GetIcemsIncident&userId=' + userId,
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

export function acknowledgeIum(id, vm, host, userId = 'notPassed', token, callback, errorCallback) {
  $.ajax({
    type: 'POST',
    url: host + '/Api/v1/Icems/messages/' + id + '/acknowledgeIum?LighthouseFunction=AcknowledgeIum&userId=' + userId,
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    data: $.param(vm),
    cache: false,
    contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
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

