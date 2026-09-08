import { request } from './core/request.js';

// No paging -- assumes a group never holds more than 1000 tags.
export async function getGroup(groupId, host, userId = 'notPassed', token) {
  const result = await request(
    host + '/Api/v1/Tags/Group/' + groupId + '?pageIndex=1&pageSize=1000&LighthouseFunction=getGroup&userId=' + userId,
    { token },
  );
  return result ? result.Results : result;
}
