import BeaconClient from '../shared/BeaconClient.js';
require('./lib/shared_chrome_code.js'); // side-effect
var BeaconToken = require('./lib/shared_token_code.js');
var clusterCodes = require('../lib/clusters.js');
import '../../styles/pages/teamsummary.css';


var moment = require('moment');
var $ = require('jquery');
require('bootstrap'); // for jq plugins: modal, tooltip
var ko;

global.jQuery = $;

var timeoverride = null;

var params = getSearchParameters();

var apiHost = params.host

var pageToken = ''
var myViewModel;



function MyViewModel() {

  //used to force things that show time since to redraw evey run
  this.dummyRecountMoments = ko.observable();

  this.source = params.source
  this.bannerTitle = ko.observable('Loading...')
  this.filterStartTime = ko.observable('Loading...')
  this.filterEndTime = ko.observable('Loading...')

  this.setColWidth = ko.observable(3)
  this.setDefaultAdd = ko.observable(true)
  this.setShowTeamSummary = ko.observable(true)
  this.setShowTeamMembers = ko.observable(true)
  this.setShowTeamLocation = ko.observable(true)

  this.setShowTeamMemberChanges = ko.observable(true)
  this.setShowTeamResources = ko.observable(true)


  this.teams = ko.observableArray()

  this.boxFlexWidth = ko.computed(() => {
    return `col-${12 / this.setColWidth()}`
  })

  this.membersShown = ko.computed(() => {
    let activeMembers = 0
    this.teams().forEach((t) => {
      if (!t.hidden()) {
        activeMembers = activeMembers + t.teamMemberCount()
      }
    })
    return activeMembers
  })
  this.membersShown.extend({
    rateLimit: 500
  });

  this.teamsShown = ko.computed(() => {
    let teamsShown = 0
    this.teams().forEach((t) => {
      if (!t.hidden()) {
        teamsShown = teamsShown + 1
      }
    })
    return teamsShown
  })
  this.teamsShown.extend({
    rateLimit: 500
  });

  this.teamsHidden = ko.computed(() => {
    let teamsHidden = 0
    this.teams().forEach(function(t) {
      if (t.hidden()) {
        teamsHidden = teamsHidden + 1
      }
    })
    return teamsHidden
  })
  this.teamsHidden.extend({
    rateLimit: 500
  });

  this.rows = ko.computed({
    read: () => {
      let filteredTeams = ko.utils.arrayFilter(this.teams(), (t) => {
        return !t.hidden()
      })

      let result = [],
        row,
        colLength = parseInt(this.setColWidth(), 10);

      //loop through items and push each item to a row array that gets pushed to the final result
      for (var i = 0, j = filteredTeams.length; i < j; i++) {
        if (i % colLength === 0) {
          if (row) {
            result.push(row);
          }
          row = [];
        }
        row.push(filteredTeams[i]);
      }

      //push the final row
      if (row) {
        result.push(row);
      }
      return result;
    },
    deferEvaluation: true
  });

  this.rows.extend({
    rateLimit: 200
  });

};

var TeamHistory = function({
  parent,
  rawObject,
  name,
  description,
  timeStamp
}) {
  this.parent = parent
  this.rawObject = rawObject
  this.name = name
  this.description = description
  this.timeStamp = timeStamp

  this.timeStampPretty = ko.computed(() => {
    return moment(this.timeStamp).format('MMM D HH.mm')
  })

  this.type = () => {
    let jobNumber = this.name.match(/(\d{4}-\d{4})/g)
    if (jobNumber) {
      return 'job'
    } else {
      return 'other'
    }
  }

  this.trimmedDesc = ko.computed(() => {
    let trimmedDesc = this.description
    if (trimmedDesc && trimmedDesc.match(/(.+)(?:by.*$)/)) {
      trimmedDesc = trimmedDesc.match(/(.+)(?:by.*$)/)[1]
    }

    if (this.name.match(/^Team set as.*/)) {
      trimmedDesc = ''
    }

    return trimmedDesc
  })

  this.trimmedName = ko.computed(() => {
    let trimmedName = this.name
    if (this.name.match(/(\d{4}-\d{4})/g)) {
      trimmedName = trimmedName.replace(this.parent.callsign(), '')
    }
    return trimmedName
  })

  this.jobPop = function(data, event) {
    event.stopPropagation()

    $("*").each(function() {
      // Bootstrap sets a data field with key `bs.popover` on elements that have a popover.
      // Note that there is no corresponding **HTML attribute** on the elements so we cannot
      // perform a search by attribute.
      var popover = $.data(this, "bs.popover");
      if (popover)
        $(this).popover('hide');
    });


    let jobNumber = data.name.match(/(\d{4}-\d{4})/g)

    function jobAddress(cb) {

      BeaconClient.job.get(jobNumber[0].replace('-', ''), 1, params.host, params.userId, pageToken, function(data) {
        // Job Tags
        var tagArray = [];
        $.each(data.Tags, function(tagIdx, tagObj) {
          tagArray.push(tagObj.Name);
        });
        var tagString = (tagArray.length ? tagArray.join(', ') : ('No Tags'));

        var bgcolor = 'none'
        var txtcolor = 'black'

        switch (data.JobPriorityType.Description) {
          case "Life Threatening":
            bgcolor = "red"
            txtcolor = 'white'
            break
          case "Priority Response":
            bgcolor = "rgb(255, 165, 0)"
            txtcolor = 'white'
            break
          case "Immediate Response":
            bgcolor = "rgb(79, 146, 255)"
            txtcolor = 'white'
            break
        }

        let details =
          `<div id='jobPopUp' style="margin-top:-5px;"><div id='jobType' style="margin:auto;text-align:center;font-weight: bold;background-color:${bgcolor};color:${txtcolor}">${data.Identifier}<br>${data.JobType.Name} - ${data.JobStatusType.Name}</div>\
        <div id='jobPriority' style="margin:auto;text-align:center;background-color:${bgcolor};color:${txtcolor}"><span id='lhqStatus'>${data.JobPriorityType.Description}</span></div>\
        <div style="display:block;text-align: center;font-weight:bold;margin-top:10px">${data.Address.PrettyAddress}</div>\
        <div id='JobDetails' style="padding-top:10px;width:100%;margin:auto">\
        <div id='JobSoS' style="display:block;text-align:center">${(data.SituationOnScene != null) ? data.SituationOnScene : "<i>No situation on scene available.</i>" }</div>
        <div id='JobTags' style="display:block;text-align:center;padding-top:10px">${tagString}</div>
        <span style="font-weight:bold;font-size:smaller;display:block;text-align:center">\
        <div style="display:block;text-align:center;padding-top:10px"><a href=${params.source}/Jobs/${data.Id} target='_blank'>View Job Details</a></div>
        <hr style="height: 1px;margin-top:5px;margin-bottom:5px">\
        Job recieved at ${moment(data.JobReceived).format('HH:mm:ss DD/MM/YYYY')}<br>
        ${(data.EntityAssignedTo.ParentEntity ? (data.EntityAssignedTo.Code+" - "+data.EntityAssignedTo.ParentEntity.Code) : data.EntityAssignedTo.Code)}
        </span></div>`;
        cb(details)

      })
    }

    var el = $(event.target);

    // add initial popovers with LOADING text
    el.popover({
      content: `<div id='jobPopUp' style="margin-top:-5px">\
          <span style="font-weight:bold;font-size:smaller;display:block;text-align:center">\
          Loading...
          </span>
          </div>`,
      html: true,
      placement: "auto",
      container: 'body',
      trigger: 'manual'
    });

    // show this LOADING popover
    el.popover('show');
    // requesting data from unsing url from data-poload attribute
    jobAddress(function(d) {
      // set new content to popover
      el.data('bs.popover').config.content = d;
      // reshow popover with new content
      el.popover('show');
    });
  }.bind(this);


}

var TeamMember = function({
  rawObject,
  id,
  memberId,
  personId,
  firstName,
  lastName,
  isTeamLeader,
  timeOn
}) {
  this.rawObject = rawObject
  this.id = id
  this.memberId = memberId
  this.personId = personId
  this.firstName = firstName
  this.lastName = lastName
  this.isTeamLeader = ko.observable(isTeamLeader)
  this.timeOn = ko.observable(timeOn)

  this.fullName = ko.computed(() => {
    return `${this.firstName} ${this.lastName}`
  })

  this.timeOnSince = ko.computed(() => {
    //force a recount when the timer runs
    myViewModel.dummyRecountMoments();
    return moment().diff(this.timeOn(), 'hours')
  })

}

var Team = function({
  rawObject,
  id,
  callsign,
  type,
  sector,
  status,
  statusTime,
  activeJobs,
  teamResources,
}) {
  this.rawObject = rawObject
  this.id = id
  this.hidden = ko.observable(true)
  // this.hidden.extend({
  //   rateLimit: 100
  // });

  this.callsign = ko.observable(callsign)
  this.type = type

  this.sector = ko.observable(sector)
  this.status = ko.observable(status)

  this.statusTime = ko.observable(statusTime)
  this.activeJobs = ko.observable(activeJobs)

  this.teamLocation = ko.observable()

  this.loadingHistory = ko.observable(true)

  this.teamMembers = ko.observableArray()
  this.teamMembers.extend({
    rateLimit: 200
  });

  this.teamMembers.subscribe(() => {
    activateToolTips()
  })

  this.teamResources = ko.observable(teamResources)
  this.teamHistory = ko.observableArray()
  this.teamMembers.extend({
    rateLimit: 200
  });

  this.hidden.subscribe((newValue) => {
    if (newValue == false) {
      positionFooter()
      this.fetchHistory()
    }
  })

  this.activeMembers = ko.computed(() => {
    return this.teamMembers.length
  })

  this.fetchHistory = () => {
    this.loadingHistory(true)
    let locationFound = false
    let locationMethod = ''
    let timeStampAgo = ''

    //All this code only works because you cant change the order of the history
    //if history order ever changes the push/unshift logic will need to be smarter

    BeaconClient.team.getHistory(this.id, params.host, params.userId, pageToken, (history) => {

      this.teamHistory().forEach((t, index) => {
        let found = false
        $.each(history.Results, function() {
          if (`${this.Name}-${this.Description}-${this.TimeStamp}` == `${t.name}-${t.description}-${t.timeStamp}`) {
            found = true
          }
        });
        if (!found) {
          this.teamHistory.splice(index, 1);
        }
      })

      //work backwards so that unshifting is possible
      history.Results.reverse().forEach((historyItem) => {

        //if (!locationFound) {
          let jobNumber = historyItem.Name.match(/.*(Offsite|Onsite|Enroute|Complete) on job (\d{4}-\d{4})/)
          if (jobNumber) {
            if (jobNumber[1] == 'Onsite') {
              locationMethod = jobNumber[1]
              locationFound = jobNumber[2]
              timeStampAgo =  moment(historyItem.TimeStamp).fromNow()
            } else if (jobNumber[1] == 'Enroute') {
              locationMethod = jobNumber[1]
              locationFound = jobNumber[2]
              timeStampAgo =  moment(historyItem.TimeStamp).fromNow()
            } else if (jobNumber[1] == 'Complete') {
              locationMethod = jobNumber[1]
              locationFound = jobNumber[2]
              timeStampAgo =  moment(historyItem.TimeStamp).fromNow()
            } else if (jobNumber[1] == 'Offsite') {
              locationMethod = jobNumber[1]
              locationFound = jobNumber[2]
              timeStampAgo =  moment(historyItem.TimeStamp).fromNow()
            }
          }
        //}

        let existingHistory = false //would be undef otherwise

        existingHistory = this.teamHistory().find((r) => {
          if (`${r.name}-${r.description}-${r.timeStamp}` === `${historyItem.Name}-${historyItem.Description}-${historyItem.TimeStamp}`) {
            return true
          }
        })
        if (!existingHistory) { //if its a new history item

          let theNewHistory = new TeamHistory({
            parent: this,
            rawObject: historyItem,
            name: historyItem.Name,
            description: historyItem.Description,
            timeStamp: historyItem.TimeStamp,
          })
          //unshift so new things go at the begining
          this.teamHistory.unshift(theNewHistory)

        } else { //old history
          existingHistory.parent = this
          existingHistory.rawObject = historyItem
          existingHistory.name = historyItem.Name
          existingHistory.description = historyItem.Description
          existingHistory.timeStamp = historyItem.TimeStamp
        }
      })
      this.loadingHistory(false)

      if (locationFound) {
        let teamLocation = this.teamLocation
        BeaconClient.job.get(locationFound.replace('-', ''), 1, params.host, params.userId, pageToken, function(job) {
          teamLocation(`${locationMethod} ${locationFound} (${timeStampAgo})<br>${job.Address.PrettyAddress.replace(', NSW','')}`)
        })
      }

    })
  }

  this.filteredTeamHistory = ko.computed({
    read: () => {
      var newHistoryArray = []

      let limit = this.teamHistory().length > 5 ? 5 : this.teamHistory().length

      //filter to hide history events we dont care for.
      let historyItems = this.teamHistory().filter((h) => {
        if (myViewModel.setShowTeamMemberChanges() == true) {
          return true
        } else {
          if (h.name.match(/(.+)\s(added|removed) (to|from) team/) !== null) {
            return false
          }
          return true
        }
      })
      let index = 0
      while (newHistoryArray.length < limit) {

        let keepLooping = true
        let loopCount = 0
        let teamMembersAddedOrRemoved = []
        let addingOrRemoving = ''
        let verb = ''
        while (keepLooping) {

          let theMatch = null
          if (typeof historyItems[index + loopCount] !== 'undefined') {
            if (typeof historyItems[index + loopCount].name !== 'undefined') {
              theMatch = historyItems[index + loopCount].name.match(/(.+)\s(added|removed) (to|from) team/)
            }
          }
          if (theMatch) {
            if (addingOrRemoving == '') { //if we are not already looking for a sequential match, set it
              addingOrRemoving = theMatch[2]
              verb = theMatch[3] //verb would be addded or removed from team
            }
            if (addingOrRemoving == theMatch[2]) {
              //nested so we dont go out of bounds
              //ensure the time stamp is the same
              if (historyItems[index].timeStamp === historyItems[index + loopCount].timeStamp) {
                teamMembersAddedOrRemoved.push(theMatch[1])
                loopCount++
              } else { //same verb but different time stamp
                keepLooping = false
              }
            } else {
              keepLooping = false
            }
          } else {
            keepLooping = false
          }
        }
        if (teamMembersAddedOrRemoved.length > 1) {

          var tmpMultiHistory = new TeamHistory({
            parent: null,
            rawObject: null,
            name: `Members ${addingOrRemoving} ${verb} team`,
            description: teamMembersAddedOrRemoved.join(', '),
            timeStamp: historyItems[index].timeStamp,
          })
          newHistoryArray.push(tmpMultiHistory) //add the grouped DOM
          if (typeof historyItems[index + loopCount] !== 'undefined') { //is there another DOM left to add or did we run out of team history
            newHistoryArray.push(historyItems[index + loopCount]) //add the dom that wasnt the group
          }
          index = index + loopCount //reset the index to true index + number of history items walked over
        } else {
          //not a rollup so just add it
          if (typeof historyItems[index] !== 'undefined') { //are we at the end
            newHistoryArray.push(historyItems[index])
          }
        }
        //if we are at the end otherwise go again
        if (historyItems.length == index) {
          break
        } else {
          index++
        }
      }
      return newHistoryArray
    },
    deferEvaluation: true
  })

  this.filteredTeamHistory.extend({
    rateLimit: 50
  });

  this.statusStyle = ko.computed(() => {
    switch (this.status()) { //color the callsign by team status
      case 'Activated': //active
        return "team-active";
      case 'Standby': //standby
        return "team-standby";
      case 'Rest': //rest
        return "team-rest";
      case 'On Alert': //alert
        return "team-alert";
      default:
        return "team";
    }
  });

  this.teamMemberCount = ko.computed(() => {
    return this.teamMembers().length
  })
  this.teamMemberCount.extend({
    rateLimit: 200
  });

  this.teamMemberPersonIds = ko.computed(() => {
    return escape(JSON.stringify(this.teamMembers().map((t) => {
      return t.personId
    })))
  })
  this.teamMemberPersonIds.extend({
    rateLimit: 200
  });


  this.statusTimePretty = ko.computed(() => {
    return moment(this.statusTime()).format('MMM D HH.mm')
  })

  this.statusTimeSince = ko.computed(() => {
    //force a recount when the timer runs
    myViewModel.dummyRecountMoments();

    return moment().diff(this.statusTime(), 'hours')
  })


  this.toggleHide = function(team) {
    team.hidden() ? team.hidden(false) : team.hidden(true)
  }.bind(this);


}



function showSearchFilters() {
  $('#filtermodal').modal('show');
}

function getSearchParameters() {
  var prmstr = window.location.search.substr(1);
  return prmstr != null && prmstr != "" ? transformToAssocArray(prmstr) : {};
}

function transformToAssocArray(prmstr) {
  var params = {};
  var prmarr = prmstr.split("&");
  for (var i = 0; i < prmarr.length; i++) {
    var tmparr = prmarr[i].split("=");
    params[tmparr[0]] = decodeURIComponent(tmparr[1]);
  }
  return params;
}

//update every X seconds
function startTimer(duration, display) {
  var timer = duration,
    minutes, seconds;
  setInterval(function() {
    minutes = parseInt(timer / 60, 10)
    seconds = parseInt(timer % 60, 10);

    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;

    display.textContent = minutes + ":" + seconds;

    if (--timer <= 0) { //when the timer is 0 run the code
      timer = duration;

      //update existing teams
      myViewModel.teams().forEach(function(t) {
        if (t.hidden() == false) {
          t.fetchHistory()
        }
      })

      //Get New Teams
      RunForestRun();
    }
  }, 1000);
}



//Get times vars for the call
function RunForestRun(mp) {
  if (!apiLoadingInterlock) {
    //prevent multiple overlapping runs
    apiLoadingInterlock = true

    BeaconToken.fetchBeaconToken(apiHost, params.source, function({
      token    }) {
      pageToken = token
      mp && mp.open();
      mp && mp.setValue(-1);

      if (timeoverride != null) { //we are using a time override

        var end = new Date();

        var start = new Date();
        start.setDate(start.getDate() - (timeoverride / 24));

        let starttime = start.toISOString();
        let endtime = end.toISOString();

        params.start = starttime;
        params.end = endtime;

      } else {
        params = getSearchParameters();
      }
      if (unit == null) {
        console.log("firstrun...will fetch vars");

        if (typeof params.hq != 'undefined') { //if not no hqs
          if (params.hq.split(",").length == 1) { //if only one HQ
            BeaconClient.unit.getName(params.hq, apiHost, params.userId, token, function(result, error) {
              if (typeof error == 'undefined') {
                mp && mp.setText(`Loaded unit ${result.Code}`)
                unit = result;
                HackTheMatrix(unit, apiHost, params.source, params.userId, token, mp);
              } else {
                mp.fail(error)
              }
            });
          } else {
            unit = [];
            console.log("passed array of units");
            var hqsGiven = params.hq.split(",");
            // unit = hqsGiven.map(function(hq){
            //   return({Id:hq})
            // })
            // HackTheMatrix(unit, apiHost, params.source, token, mp);
            mp && mp.setText(`Loading multiple unit details`)
            hqsGiven.forEach(function(d) {
              BeaconClient.unit.getName(d, params.host, params.userId, token, function(result, error) {
                mp && mp.setText(`Loaded unit ${result.Code}`)
                if (typeof error == 'undefined') {
                  unit.push(result);
                  if (unit.length == params.hq.split(",").length) {
                    HackTheMatrix(unit, apiHost, params.source, params.userId, token, mp);
                  }
                } else {
                  mp.fail(error)
                }
              });
            });
          }
        } else { //no hq was sent, get them all
          unit = [];
          HackTheMatrix(unit, apiHost, params.source, params.userId, token, mp);
        }
      } else {
        console.log("rerun...will NOT fetch vars");
        //$('#loadinginline').css('display', 'block');
        HackTheMatrix(unit, apiHost, params.source, params.userId, token);
      }
    })
  } else {
    console.log("interlock true, we are already running. preventing sequential run")
  }
}

//make the call to beacon
function HackTheMatrix(unit, host, source, userId, token, progressBar) {
  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));

  BeaconClient.team.teamSearch(unit, host, start, end, userId, token, function(teams) {

      let allTeamsPromises = []

      //TODO move to a promise system so that we know when we are done.

      var options = { //date display options
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "numeric",
        hour12: false,
      };

      //remove teams from the main array that are not longer returned from the api query
      myViewModel.teams().forEach(function(d, index) {
        let found = false
        $.each(teams.Results, function() {
          if (this.Id == d.id) {
            found = true
          }
        });
        if (!found) {
          myViewModel.teams.splice(index, 1);
        }
      })

      teams.Results.forEach(function(d) {

        allTeamsPromises.push(new Promise(function(resolve) {


          let existingTeam = false //would be undef otherwise
          let storedTeam = {};
          existingTeam = myViewModel.teams().find(function(r) {
            if (r.id === d.Id) {
              return true
            }
          })
          if (!existingTeam) { //if its a new team

            let theNewTeam = new Team({
              rawObject: d,
              id: d.Id,
              callsign: d.Callsign,
              type: d.TeamType.Name,
              sector: d.Sector && d.Sector.Name,
              status: d.TeamStatusType.Name,
              statusTime: d.TeamStatusStartDate,
              activeJobs: d.TaskedJobCount,
              teamResources: d.Resources.map(function(r) {
                return r.Name
              }).join(', '),
            })

            if (d.TeamType.Name === 'Field') { //default only show field teams
              if (myViewModel.setDefaultAdd()) {
                if (d.TeamStatusType.Name === "Activated") {
                  theNewTeam.hidden(false)
                } else {
                  theNewTeam.hidden(true)
                }
              } else {
                theNewTeam.hidden(true)
              }
            } else {
              theNewTeam.hidden(true)
            }

            if (theNewTeam.hidden() == false) {
              theNewTeam.fetchHistory()
            }

            storedTeam = theNewTeam

            myViewModel.teams.push(theNewTeam)


          } else { //existing team

            storedTeam = existingTeam
            let newTeam = d

            if (myViewModel.setDefaultAdd()) {
              if (existingTeam.status() !== "Activated" && newTeam.TeamStatusType.Name === "Activated") { //if the team is now activated and wasnt before
                existingTeam.hidden(false)
              }
            }

            //update everything and let it handle the differences
            existingTeam.rawObject = newTeam
            existingTeam
              .callsign(newTeam.Callsign)
              .sector(newTeam.Sector && newTeam.Sector.Name)
              .status(newTeam.TeamStatusType.Name)
              .statusTime(newTeam.TeamStatusStartDate)
              .activeJobs(newTeam.TaskedJobCount)
              .teamResources(d.Resources.map(function(r) {
                return r.Name
              }).join(', '));
          }

          //remove team members from the array that are not longer returned from the api query
          storedTeam.teamMembers().forEach(function(t, index) {
            let found = false
            $.each(d.Members, function() {
              if (this.Id == t.id) {
                found = true
              }
            });
            if (!found) {
              storedTeam.teamMembers.splice(index, 1);
            }
          })

          d.Members.forEach(function(teamMember) {
            let existingTeamMember = false //would be undef otherwise
            existingTeamMember = storedTeam.teamMembers().find(function(r) {
              if (r.id === teamMember.Id) {
                return true
              }
            })

            if (!existingTeamMember) { //if its a new team member
              let theNewTeamMember = new TeamMember({
                rawObject: teamMember,
                id: teamMember.Id,
                memberId: teamMember.Person.RegistrationNumber,
                personId: teamMember.Person.Id,
                firstName: teamMember.Person.FirstName,
                lastName: teamMember.Person.LastName,
                isTeamLeader: teamMember.TeamLeader,
                timeOn: teamMember.TimeOn
              })

              storedTeam.teamMembers.push(theNewTeamMember)

            } else { //is an existing member

              existingTeamMember.rawObject = teamMember

              existingTeamMember
                .isTeamLeader(teamMember.TeamLeader)
                .timeOn(teamMember.TimeOn)
            }
          })
          resolve()
        }))

      })


      Promise.all(allTeamsPromises).then(function() {
        console.log('all team stuff loaded')
        myViewModel.dummyRecountMoments.notifySubscribers(ko.observable());
        if (firstRun) {
          console.log('first run')
          firstRun = false;
          showSearchFilters();
        }

      })

      let bannerTitle;

      if (unit.length == 0) { //whole nsw state
        document.title = "NSW Team Summary";
        bannerTitle = "Team summary for NSW";
        myViewModel.bannerTitle(bannerTitle)
        renderPage()
      } else {
        if (Array.isArray(unit) == false) { //1 lga
          document.title = unit.Name + " Team Summary";
          bannerTitle = 'Team summary for ' + unit.Name;
          myViewModel.bannerTitle(bannerTitle)
          renderPage()
        };
        if (unit.length > 1) { //more than one

          let iPromise = []
          unit.forEach(function(unit) {
            progressBar && progressBar.setText(`Loading cluster name ${unit.Name}`)

            iPromise.push(new Promise(function(resolve, reject) {
              try {
                clusterCodes.returnCluster(unit.Name, function(cluster) {
                  if (typeof cluster !== 'undefined') {
                  resolve({
                    zone: unit.ParentEntity.Code,
                    cluster: cluster.clusterCode
                  })
                } else {
                  resolve({
                    zone: unit.ParentEntity.Code,
                    cluster: 'Unknown'
                  })
                }
                })
              } catch (e) {
                reject(e)
              }
            }))
          })

          Promise.all(iPromise).then(function(results) {
            let clusters = {}
            let zone = {}
            let groupName = `${results.length} units`
            results.forEach(function(res) {
              if (Object.prototype.hasOwnProperty.call(zone, res.zone)) {
                zone[res.zone].count += 1;
              } else {
                zone[res.zone] = {}
                zone[res.zone].count = 1
              }
              if (Object.prototype.hasOwnProperty.call(zone, res.cluster)) {
                clusters[res.cluster].count += 1;
              } else {
                clusters[res.cluster] = {}
                clusters[res.cluster].count = 1
              }
            })
            Object.keys(zone).forEach(function(key) {
              if (zone[key].count == unit.length) {
                groupName = key
              }
            })
            Object.keys(clusters).forEach(function(key) {
              if (clusters[key].count == unit.length) {
                groupName = key
              }
            })
            document.title = `${groupName} Team Summary`;
            bannerTitle = `Team summary for ${groupName}`;
            myViewModel.bannerTitle(bannerTitle)
            renderPage()
          })
        }
      }


      function renderPage() {
        myViewModel.filterStartTime(start.toLocaleTimeString("en-au", options))
        myViewModel.filterEndTime(end.toLocaleTimeString("en-au", options))
        //banner first
        //   const banner = $(`
        //    <div class="col-12 text-center">
        // 	     ${bannerTitle}<h4>${start.toLocaleTimeString("en-au", options)} to ${end.toLocaleTimeString("en-au", options)}</h4><h4 class="teamFilters">Displayed Members: ${membersActive} | Displayed Teams: ${teamsActive}  | Hidden Teams: ${teamsHidden}</h4>
        //    </div>
        // `)
        //   $('#pageHeader').children().remove()
        //   $('#pageHeader').append(banner)
        //
        //   $('#pageContent').children('.team-row').remove()
        //   $('#pageContent').append(`<div class="row display-flex team-row"></div>`)

        //progressBar && progressBar.setValue(1);
        progressBar && progressBar.close();
        //$('#loadinginline').css('display', 'none');
        apiLoadingInterlock = false
        positionFooter();
      }
    },
    function(val, total) {
      if (progressBar) { //if its a first load
        if (val == -1 && total == -1) {
          progressBar.fail();
        } else {
          //lets not do progress for now
          //progressBar.setValue(0.5 + ((val / total) - 0.1)) //start at 10%, dont top 100%
        }
      } else {
        if (val == -1 && total == -1) {
          alert('Error talking to beacon')
        }
      }
    },
    [1, 2, 3, 4] // StatusTypeId=3 - Activated
  );
}

function activateToolTips() {
  $('[data-toggle="tooltip"]').tooltip()
}



function positionFooter() {
  var footerHeight = 55,
    $footer = $(".footer");
  footerHeight = $footer.height();

  if (($(document.body).height() + footerHeight) < $(window).height()) {
    $footer.css({
      position: "absolute"
    })
  } else {
    $footer.css({
      position: "static"
    })
  }
}


var firstRun = true


var apiLoadingInterlock = false


var unit = null;



//allow pretty popovers with inline style
//$.fn.tooltip.Constructor.Default.whiteList['*'].push('style')



// window.onerror = function(message, url, lineNumber) {
//   document.getElementById("loading").innerHTML = "Error loading page<br>"+message;
//   return true;
// };

//on DOM load
document.addEventListener('DOMContentLoaded', function() {

  require(["knockout", "knockout-secure-binding"], function (komod, ksb) {
    ko = komod;

    // Show all options, more restricted setup than the Knockout regular binding.
    var options = {
        attribute: "data-bind",      // ignore legacy data-bind values
        globals: window,
        bindings: ko.bindingHandlers, // still use default binding handlers
        noVirtualElements: false
    };

    ko.bindingProvider.instance = new ksb(options);
    window.ko = ko;
    ko.options.deferUpdates = true;
    myViewModel = new MyViewModel();


    ko.applyBindings(myViewModel);


    var mp = new Object();
    mp.setValue = function(value) { //value between 0 and 1
      if (value == -1) {
        $('#loadprogress').css('width', '100%');
        $('#loadprogress').text('Loading...')
        $('#loadprogress').addClass('progress-bar-striped bg-info');
      } else {
        $('#loadprogress').css('width', (Math.round(value * 100) + '%'));
        $('#loadprogress').text(Math.round(value * 100) + '%')
      }
    }
    mp.setText = function(text) {
      $('#loadprogress').text(text)
    }
    mp.open = function() {
      $('#loadprogress').css('width', 1 + '%');
      $('#loadprogress').removeClass('progress-bar-striped');
    }
    mp.fail = function(error) {
      $('#loadprogress').css('width', '100%');
      $('#loadprogress').addClass('progress-bar-striped bg-danger');
      $('#loadprogress').text('Error Loading - ' + error)
    }
    mp.close = function() {
      document.getElementById("loading").style.visibility = 'hidden';
      positionFooter();

      $(window)
        .scroll(positionFooter)
        .resize(positionFooter)

    }

    //run every X period of time the main loop.
    var display = document.querySelector('#time');
    startTimer(180, display);

    RunForestRun(mp)
    $('body').addClass('fade-in');


  });


  $(document).on('change', 'input[name=slide]:radio', function() {
    timeoverride = (this.value == "reset" ? null : this.value);
    RunForestRun();
  });

  $(document).ready(function() {



    //  Dynamic popovers are a bitch. This will remmove any/all on body click
    $('body').on('click', function() {
      $("*").each(function() {
        // Bootstrap sets a data field with key `bs.popover` on elements that have a popover.
        // Note that there is no corresponding **HTML attribute** on the elements so we cannot
        // perform a search by attribute.
        var popover = $.data(this, "bs.popover");
        if (popover)
          $(this).popover('hide');
      });
    })

    if (chrome.manifest.name.includes("Development")) {
      $('body').addClass("watermark");
    }


    document.getElementById("refresh").onclick = function() {
      //update existing teams
      myViewModel.teams().forEach(function(t) {
        if (t.hidden() == false) {
          t.fetchHistory()
        }
      })
      RunForestRun();
    }
    $(document).on('click', "#unselectAllfilters", function() {
      myViewModel.teams().forEach(function(d) {
        d.hidden(true)
      })
    })
    $(document).on('click', "#selectAllfilters", function() {
      myViewModel.teams().forEach(function(d) {
        d.hidden(false)
      })
    })
    $(document).on('click', "#selectAllActivatedfilters", function() {
      myViewModel.teams().forEach(function(d) {
        d.hidden(true)
        if (d.status() == "Activated") {
          d.hidden(false)
        }
      })
    })

    $(document).on('click', ".teamFilters", function() {
      showSearchFilters();
    })

    $(document).on('click', "#filtersSave", function() {
      $('#filtermodal').modal('hide');
    })

    $('#filtermodal').on('hidden.bs.modal', () => {
      // do nothing
    });


  });

});
