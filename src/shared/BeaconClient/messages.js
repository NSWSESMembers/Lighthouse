import { request, toFormUrlEncoded } from './core/request.js';

/**
 * Send a job SMS/message.
 *
 * @param {object[]} recipients  contact rows ({ Detail, FirstName, LastName, Id, ContactTypeId })
 * @param {string|number} jobId
 * @param {string} messageText
 * @param {boolean} isOperational
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<any>}  the created message, or null (Beacon intermittently 500s despite sending)
 */
export function send(recipients, jobId, messageText, isOperational, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;

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

  return request(host + '/Api/v1/Messages?LighthouseFunction=SendJobMessage&userId=' + userId, {
    method: 'POST',
    token,
    signal,
    form: toFormUrlEncoded(data),
    nullOnError: true,
  });
}

/**
 * @param {string|number} id
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object|null>}
 */
export function getMessageById(id, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(host + '/Api/v1/Messages/' + id + '?LighthouseFunction=GetMessageById&userId=' + userId, { token, signal });
}
