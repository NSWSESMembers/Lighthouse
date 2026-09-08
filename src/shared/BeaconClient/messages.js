import { request, toFormUrlEncoded } from './core/request.js';

export function send(recipients, jobId, messageText, isOperational, host, userId = 'notPassed', token) {
  const data = {
    Operational: isOperational,
    MessageText: messageText,
    JobId: jobId,
  };

  // Contact Groups (ContactTypeId 0) have no Detail/phone number of their own -
  // Beacon resolves their membership server-side and echoes it back as a
  // separate ContactGroups field, so they can't go through Recipients[i].
  const contactGroups = recipients.filter((recipient) => recipient.ContactTypeId === 0);
  const individualContacts = recipients.filter((recipient) => recipient.ContactTypeId !== 0);

  individualContacts.forEach((recipient, index) => {
    data[`Recipients[${index}][Recipient]`] = recipient.Detail;
    data[`Recipients[${index}][Description]`] = recipient.FirstName
      ? `${recipient.FirstName} ${recipient.LastName}`
      : recipient.Description;
    data[`Recipients[${index}][ContactId]`] = recipient.Id;
    data[`Recipients[${index}][ContactTypeId]`] = recipient.ContactTypeId;
  });

  contactGroups.forEach((group, index) => {
    data[`ContactGroups[${index}]`] = group.Id;
  });

  // Beacon intermittently 500s on this endpoint despite sending the message.
  return request(host + '/Api/v1/Messages?LighthouseFunction=SendJobMessage&userId=' + userId, {
    method: 'POST',
    token,
    form: toFormUrlEncoded(data),
    nullOnError: true,
  });
}

export function getMessageById(id, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Messages/' + id + '?LighthouseFunction=GetMessageById&userId=' + userId,
    { token },
  );
}
