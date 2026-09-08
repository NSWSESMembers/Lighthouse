import { request } from './core/request.js';

export function search(query, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Entities/Search?EntityName=' + query + '&LighthouseFunction=SearchEntitiesn&userId=' + userId,
    { token },
  );
}

export function children(parent, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Entities/' + parent + '/Children/?LighthouseFunction=EntitiesChildren&userId=' + userId,
    { token },
  );
}

export function fetch(id, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Entities/' + id + '?LighthouseFunction=EntitiesFetch&userId=' + userId,
    { token },
  );
}
