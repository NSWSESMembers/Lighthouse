import { request, toFormUrlEncoded } from './core/request.js';

/**
 * @param {string|number} id
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object|null>}
 */
export function getMessageById(id, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(host + '/Api/v1/Icems/messages/' + id + '?LighthouseFunction=GetMessageById&userId=' + userId, { token, signal });
}

/**
 * @param {string} incidentIdentifier
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object|null>}
 */
export function getIncident(incidentIdentifier, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(
    host + '/Api/v1/Icems/incidents/' + encodeURIComponent(incidentIdentifier) + '?LighthouseFunction=GetIcemsIncident&userId=' + userId,
    { token, signal },
  );
}

/**
 * @param {string|number} id  message id
 * @param {Record<string, unknown>} payload  IUM acknowledgement fields
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<any>}
 */
export function acknowledgeIum(id, payload, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(
    host + '/Api/v1/Icems/messages/' + id + '/acknowledgeIum?LighthouseFunction=AcknowledgeIum&userId=' + userId,
    { method: 'POST', token, signal, form: toFormUrlEncoded(payload) },
  );
}
