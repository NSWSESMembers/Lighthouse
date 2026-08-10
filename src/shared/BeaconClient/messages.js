import $ from 'jquery';


export function send(recipients, jobId, messageText, isOperational, host, userId = 'notPassed', token, callback) {
const data = {
  Operational: isOperational,
  MessageText: messageText,
  JobId: jobId
};

// Contact Groups (ContactTypeId 0) have no Detail/phone number of their own -
// Beacon resolves their membership server-side and echoes it back as a
// separate ContactGroups field, so they can't go through Recipients[i].
const contactGroups = recipients.filter(recipient => recipient.ContactTypeId === 0);
const individualContacts = recipients.filter(recipient => recipient.ContactTypeId !== 0);

individualContacts.forEach((recipient, index) => {
  data[`Recipients[${index}][Recipient]`]      = recipient.Detail;
  data[`Recipients[${index}][Description]`]   = recipient.FirstName
    ? `${recipient.FirstName} ${recipient.LastName}`
    : recipient.Description;
  data[`Recipients[${index}][ContactId]`]     = recipient.Id;
  data[`Recipients[${index}][ContactTypeId]`] = recipient.ContactTypeId;
});

contactGroups.forEach((group, index) => {
  data[`ContactGroups[${index}]`] = group.Id;
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

export function getMessageById(id, host, userId = 'notPassed', token, callback, errorCallback) {
  $.ajax({
    type: 'GET',
    url: host + '/Api/v1/Messages/' + id + '?LighthouseFunction=GetMessageById&userId=' + userId,
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