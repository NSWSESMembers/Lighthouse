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


//forced to only be SMS or contact groups for now
export function searchAll(query, host, userId = 'notPassed', token, callback) {
  console.log("contacts.searchAll called with:" + host);
$.ajax({
    type: 'GET',
    url: host + "/Api/v1/Contacts/SearchAll?SearchTerm=" + encodeURIComponent(query) + 
             "&RecipientTypes%5B0%5D=Contact%20Group" +
             "&ContactTypeIds%5B0%5D=2" +
             "&RecipientTypes%5B1%5D=Internal" +
             "&RecipientTypes%5B2%5D=External" +
             "&PageIndex=1&PageSize=20&LighthouseFunction=SearchContacts&userId=" + userId,
    beforeSend: function(n) {
        n.setRequestHeader("Authorization", "Bearer " + token)
    },
    cache: false,
    dataType: 'json',
    complete: function(response, textStatus) {
        if (textStatus == 'success') {
            let results = response.responseJSON;
            if (typeof callback === "function") {
                console.log("contacts.searchAll call back");
                callback(results);
            }
        } else {
            if (typeof callback === "function") {
                console.log("contacts.searchAll errored out");
                callback('', textStatus);
            }
        }
    }
})
}