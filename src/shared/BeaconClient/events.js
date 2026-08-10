import $ from 'jquery';

// A single free-text `query` is sent against both EventName and Identifier
// simultaneously (same "OR across fields" shape as Users/Search) so callers
// don't need to guess whether the user typed an event name or its
// identifier (e.g. "6/1718"). ViewModelType=2 mirrors Beacon's own event
// picker requests.
export function search(query, host, userId = 'notPassed', token, callback, errorCallback) {
  $.ajax({
    type: 'GET',
    url: host + '/Api/v1/Events/Search?EventName=' + encodeURIComponent(query) +
      '&Identifier=' + encodeURIComponent(query) +
      '&ViewModelType=2&PageSize=10&SortField=identifier&SortOrder=asc' +
      '&LighthouseFunction=SearchEvents&userId=' + userId,
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        if (typeof callback === 'function') {
          callback(response.responseJSON);
        }
      } else {
        if (typeof errorCallback === 'function') {
          errorCallback(response);
        }
      }
    }
  });
}
