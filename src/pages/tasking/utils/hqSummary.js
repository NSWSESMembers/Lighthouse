var $ = require('jquery');

// Beacon HeadquartersStatusTypeId -> display name.
const HQ_STATUS_NAMES = { 1: 'Monitoring', 2: 'Not Monitoring', 3: 'Unavailable' };

/**
 * Beacon Entities/Search URL for an HQ marker. EntityName matches the 3-letter
 * unit code as well as names, so units are searched by code; zone/state/office
 * HQs have no code and fall back to the name.
 */
export function hqSearchUrl(host, { code, name }) {
  const query = code || String(name || '').replace(/\s*-\s*/g, ' - ');
  // A code also substring-matches other units' names, so ask for enough
  // results that pickHq can find the exact code.
  return host + '/Api/v1/Entities/Search?EntityName=' + encodeURIComponent(query) + '&PageIndex=1&PageSize=50';
}

/** The search result for this HQ: an exact code match, else (no code) an exact name match or the first result. */
export function pickHq(results, { code, name }) {
  if (!results?.length) return null;
  const same = (a, b) => String(a || '').toUpperCase() === String(b || '').toUpperCase();
  if (code) return results.find((r) => same(r.Code, code)) || null;
  return results.find((r) => same(r.Name, name)) || results[0];
}

export function fetchHqDetailsSummary(hqRef, host, token, cb) {
  var hq = {};
  $.ajax({
    type: 'GET',
    url: hqSearchUrl(host, hqRef),
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + token);
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      var v = textStatus == 'success' ? pickHq(response.responseJSON?.Results, hqRef) : null;
      if (!v) {
        cb(null); // main.js rejects on a falsy result, so the popup shows an error
        return;
      }
      // Beacon HQ ids are entity ids, so the entity's Id drives the lookups below.
      hq.Entity = v;
      hq.HeadquartersStatusId = v.HeadquartersStatusTypeId;
      hq.HeadquartersStatus = HQ_STATUS_NAMES[v.HeadquartersStatusTypeId] || '';
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