import { request } from './core/request.js';

export function unaccepted(jobId, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Jobs/' + jobId + '/unacceptednotifications?LighthouseFunction=GetUnacceptedNotifications&userId=' + userId,
    { token },
  );
}

export function acknowledge(notificationId, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Notifications/' + notificationId + '/acknowledge?LighthouseFunction=AcknowledgeNotification&userId=' + userId,
    { method: 'POST', token },
  );
}
