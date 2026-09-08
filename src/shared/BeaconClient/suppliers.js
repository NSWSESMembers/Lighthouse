import { request } from './core/request.js';

export function get(unitId, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Suppliers/Job/' + unitId + '?LighthouseFunction=suppliersGet&userId=' + userId,
    { token },
  );
}
