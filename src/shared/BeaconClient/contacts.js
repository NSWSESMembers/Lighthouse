import $ from 'jquery';

export function search(personID, host, userId = 'notPassed', token, callback) {
  console.log("contacts.search called with:" + personID + ", " + host);
  $.ajax({
    type: 'GET',
    url: host + "/Api/v1/Contacts/Search?PersonIds%5B0%5D=" + personID + "&IncludeDeleted=false&PageIndex=1&PageSize=20&SortField=createdon&SortOrder=asc&LighthouseFunction=SearchContacts&userId=" + userId,
    beforeSend: function(n) {
      n.setRequestHeader("Authorization", "Bearer " + token)
    },
    cache: false,
    dataType: 'json',
    complete: function(response, textStatus) {
      if (textStatus == 'success') {
        let results = response.responseJSON;
        if (typeof callback === "function") {
          console.log("contacts.search call back");
          callback(results);
        }
      } else {
        if (typeof callback === "function") {
          console.log("contacts.search errored out");
          callback('', textStatus);
        }
      }
    }
  })
}
