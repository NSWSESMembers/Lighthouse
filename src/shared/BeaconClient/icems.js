import { request, toFormUrlEncoded } from './core/request.js';

export function getMessageById(id, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Icems/messages/' + id + '?LighthouseFunction=GetMessageById&userId=' + userId,
    { token },
  );
}

export function getIncident(incidentIdentifier, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Icems/incidents/' + encodeURIComponent(incidentIdentifier) + '?LighthouseFunction=GetIcemsIncident&userId=' + userId,
    { token },
  );
}

export function acknowledgeIum(id, vm, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Icems/messages/' + id + '/acknowledgeIum?LighthouseFunction=AcknowledgeIum&userId=' + userId,
    { method: 'POST', token, form: toFormUrlEncoded(vm) },
  );
}
