import $ from 'jquery';

export function task(teamID, jobId, host, userId = 'notPassed', token, callback) {

  $.ajax({
    type: 'POST',
    url: host + '/Api/v1/Tasking',
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    data: JSON.stringify({
      TeamIds: [teamID],
      JobIds: [jobId],
      LighthouseFunction: 'client.TaskTeam',
      userId: userId,
    }),
    cache: false,
    dataType: 'json',
    contentType: 'application/json; charset=utf-8',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        //work around for beacon bug returning error 500 for no reason
        callback(response.responseJSON);
        }
    },
  });
}

export function updateTeamStatus(host, taskingID, status, payload, token, callback) {
  $.ajax({
    type: 'POST',
    url: host + '/Api/v1/Tasking' + '/' + taskingID + '/' + status,
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    data: JSON.stringify(payload),
    cache: false,
    dataType: 'json',
    contentType: 'application/json; charset=utf-8',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        //work around for beacon bug returning error 500 for no reason
        callback(response.responseJSON);
        }
    },
  });
}

export function callOffTeam(host, taskingID, payload, token, callback) {
  $.ajax({
    type: 'PUT',
    url: host + '/Api/v1/Tasking' + '/' + taskingID + '/Calloff',
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    data: JSON.stringify(payload),
    cache: false,
    dataType: 'json',
    contentType: 'application/json; charset=utf-8',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        //work around for beacon bug returning error 500 for no reason
        callback(response.responseJSON);
        }
    },
  });
}

export function untaskTeam(host, taskingID, payload, token, callback) {
  $.ajax({
    type: 'DELETE',
    url: host + '/Api/v1/Tasking' + '/' + taskingID,
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    data: payload,
    cache: false,
    contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        //work around for beacon bug returning error 500 for no reason
        callback(response.responseJSON);
        }
    },
  });
}