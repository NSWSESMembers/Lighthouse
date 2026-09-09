import { request } from './core/request.js';

/**
 * Unaccepted notifications for a job. Beacon returns a bare array here.
 *
 * @param {string|number} jobId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object[]>}
 */
export async function unaccepted(jobId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  const result = await request(
    host + '/Api/v1/Jobs/' + jobId + '/unacceptednotifications?LighthouseFunction=GetUnacceptedNotifications&userId=' + userId,
    { token, signal },
  );
  return result || [];
}

/**
 * @param {string|number} notificationId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<any>}
 */
export function acknowledge(notificationId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(
    host + '/Api/v1/Notifications/' + notificationId + '/acknowledge?LighthouseFunction=AcknowledgeNotification&userId=' + userId,
    { method: 'POST', token, signal },
  );
}
