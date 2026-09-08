import { request } from './core/request.js';

export function search(personID, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Contacts/Search?PersonIds%5B0%5D=' + personID + '&IncludeDeleted=false&PageIndex=1&PageSize=20&SortField=createdon&SortOrder=asc&LighthouseFunction=SearchContacts&userId=' + userId,
    { token },
  );
}

// Forced to only be SMS or contact groups for now.
export function searchAll(query, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Contacts/SearchAll?SearchTerm=' + encodeURIComponent(query) +
      '&RecipientTypes%5B0%5D=Contact%20Group' +
      '&ContactTypeIds%5B0%5D=2' +
      '&RecipientTypes%5B1%5D=Internal' +
      '&RecipientTypes%5B2%5D=External' +
      '&PageIndex=1&PageSize=20&LighthouseFunction=SearchContacts&userId=' + userId,
    { token },
  );
}
