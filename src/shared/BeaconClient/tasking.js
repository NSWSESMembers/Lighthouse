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