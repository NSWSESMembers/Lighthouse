var $ = require('jquery');

export function fetchHqDetailsSummary(HQName, host, token, cb) {
  var hq = {};
  $.ajax({
    type: 'GET',
    url: host + '/Api/v1/Headquarters/Search?Name=' + HQName,
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
        console.log("HQ Search response:", response);   
      if (textStatus == 'success') {
        if (response.responseJSON.Results.length) {
          var v = response.responseJSON.Results[0];
          hq.Entity = v.Entity;
          v.Entity.EntityTypeId = 1; //shouldnt be using entity for filters, so add the missing things
          hq.HeadquartersStatus = v.HeadquartersStatusType.Name;
          fetchHqAccreditations(v.Id, function (acred) {
            hq.acred = [];
            $.each(acred, function (k, v) {
              if (v.HeadquarterAccreditationStatusType.Id == 1) {
                //1 is available. everything else is bad. only return what is avail
                hq.acred.push(v.HeadquarterAccreditationType.Name);
              }
            });
            if (
              typeof hq.contacts !== 'undefined' &&
              typeof hq.currentJobCount !== 'undefined' &&
              typeof hq.currentTeamCount !== 'undefined'
            ) {
              //lazy mans way to only return once all the data is back
              cb(hq);
            }
          });
          fetchHqJobCount(v.Id, function (jobcount) {
            hq.currentJobCount = jobcount; //return a count
            if (
              typeof hq.contacts !== 'undefined' &&
              typeof hq.acred !== 'undefined' &&
              typeof hq.currentTeamCount !== 'undefined'
            ) {
              //lazy mans way to only return once all the data is back
              cb(hq);
            }
          });
          fetchHqTeamCount(v.Id, function (teamcount) {
            hq.currentTeamCount = teamcount; //return a count
            if (
              typeof hq.contacts !== 'undefined' &&
              typeof hq.acred !== 'undefined' &&
              typeof hq.currentJobCount !== 'undefined'
            ) {
              //lazy mans way to only return once all the data is back
              cb(hq);
            }
          });
          fetchHqContacts(v.Id, function (contacts) {
            //lazy mans way to only return once all the data is back
            hq.contacts = contacts; //return them all
            if (
              typeof hq.currentJobCount !== 'undefined' &&
              typeof hq.acred !== 'undefined' &&
              typeof hq.currentTeamCount !== 'undefined'
            ) {
              cb(hq);
            }
          });
        }
      }
    },
  });



/**
 * Fetch HQ Job Counts.
 *
 * @param HQId code of HQ.
 * @para cb cb
 * @returns something. or null. //TODO
 */

function fetchHqJobCount(HQId, cb) {
  $.ajax({
    type: 'GET',
    url:
      host +
      '/Api/v1/Jobs/Search?StartDate=&EndDate=&Hq=' +
      HQId +
      '&JobStatusTypeIds%5B%5D=2&JobStatusTypeIds%5B%5D=1&JobStatusTypeIds%5B%5D=5&JobStatusTypeIds%5B%5D=4&ViewModelType=5&PageIndex=1&PageSize=100',
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        cb(response.responseJSON.TotalItems); //return the count of how many results.
      }
    },
  });
}



/**
 * Fetch HQ Team Counts.
 *
 * @param HQId code of HQ.
 * @para cb cb
 * @returns something. or null. //TODO
 */
function fetchHqTeamCount(HQId, cb) {
  $.ajax({
    type: 'GET',
    url:
      host +
      '/Api/v1/Teams/Search?StatusStartDate=&StatusEndDate=&AssignedToId=' +
      HQId +
      '&StatusTypeId%5B%5D=3&IncludeDeleted=false&PageIndex=1&PageSize=200&SortField=CreatedOn&SortOrder=desc',
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        cb(response.responseJSON.TotalItems); //return the count of how many results.
      }
    },
  });
}

/**
 * Fetch HQ Contacts.
 *
 * @param HQId code of HQ.
 * @para cb cb
 * @returns something. or null. //TODO
 */

function fetchHqContacts(HQId, cb) {
  $.ajax({
    type: 'GET',
    url:
      host +
      '/Api/v1/Contacts/Search?HeadquarterIds=' +
      HQId +
      '&PageIndex=1&PageSize=50&SortField=createdon&SortOrder=asc',
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        cb(response.responseJSON.Results); //return everything as they are all useful
      }
    },
  });
}

/**
 * Fetch HQ Accreditations.
 *
 * @param HQId code of HQ.
 * @para cb cb
 * @returns something. or null. //TODO
 */

function fetchHqAccreditations(HQId, cb) {
  $.ajax({
    type: 'GET',
    url: host + '/Api/v1/HeadquarterAccreditations/' + HQId,
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        cb(response.responseJSON.HeadquarterAccreditationMappings);
      }
    },
  });
}

}