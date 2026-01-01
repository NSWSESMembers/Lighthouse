import $ from 'jquery';


export function send(recipients, jobId, messageText, isOperational, host, userId = 'notPassed', token, callback) {
const data = {
  Operational: isOperational,
  MessageText: messageText,
  JobId: jobId
};

recipients.forEach((recipient, index) => {
  data[`Recipients[${index}][Recipient]`]      = recipient.Detail;
  data[`Recipients[${index}][Description]`]   = `${recipient.FirstName} ${recipient.LastName}`;
  data[`Recipients[${index}][ContactId]`]     = recipient.Id;
  data[`Recipients[${index}][ContactTypeId]`] = recipient.ContactTypeId;
});

  $.ajax({
    type: 'POST',
    url: host + '/Api/v1/Messages?LighthouseFunction=SendJobMessage&userId=' + userId,
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    data: $.param(data),
    cache: false,
    contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        //work around for beacon bug returning error 500 for no reason
        callback(response.responseJSON);
        } else {
          callback(null);
        }
    },
  });
}