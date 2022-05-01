var LighthouseJob = require('./lib/shared_job_code.js');
var LighthouseUnit = require('./lib/shared_unit_code.js');
var LighthouseJson = require('./lib/shared_json_code.js');
var LighthouseTeam = require('./lib/shared_team_code.js');
var LighthouseChrome = require('./lib/shared_chrome_code.js');
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
  var self = this;

  //used to force things that show time since to redraw evey run
  self.dummyRecountMoments = ko.observable();

  self.source = params.source
  self.bannerTitle = ko.observable('Loading...')
  self.filterStartTime = ko.observable('Loading...')
  self.filterEndTime = ko.observable('Loading...')

  self.setColWidth = ko.observable(3)
  self.setDefaultAdd = ko.observable(true)
  self.setShowTeamMemberChanges = ko.observable(true)
  self.setShowTeamResources = ko.observable(true)


  self.teams = ko.observableArray()

  self.boxFlexWidth = ko.computed(function() {
    return `col-${12 / self.setColWidth()}`
  })

  self.membersShown = ko.computed(function() {
    let activeMembers = 0
    self.teams().forEach(function(t) {
      if (!t.hidden()) {
        activeMembers = activeMembers + t.teamMemberCount()
      }
    })
    return activeMembers
  })
  self.membersShown.extend({
    rateLimit: 500
  });

  self.teamsShown = ko.computed(function() {
    let teamsShown = 0
    self.teams().forEach(function(t) {
      if (!t.hidden()) {
        teamsShown = teamsShown + 1
      }
    })
    return teamsShown
  })
  self.teamsShown.extend({
    rateLimit: 500
  });

  self.teamsHidden = ko.computed(function() {
    let teamsHidden = 0
    self.teams().forEach(function(t) {
      if (t.hidden()) {
        teamsHidden = teamsHidden + 1
      }
    })
    return teamsHidden
  })
  self.teamsHidden.extend({
    rateLimit: 500
  });

  self.rows = ko.computed({
    read: function() {
      let filteredTeams = ko.utils.arrayFilter(self.teams(), function(t) {
        return !t.hidden()
      })

      let result = [],
        row,
        colLength = parseInt(self.setColWidth(), 10);

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

  self.rows.extend({
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
  var self = this;

  self.parent = parent
  self.rawObject = rawObject
  self.name = name
  self.description = description
  self.timeStamp = timeStamp

  self.timeStampPretty = ko.computed(function() {
    return moment(self.timeStamp).format('MMM D HH.mm')
  })

  self.type = function() {
    let jobNumber = self.name.match(/(\d{4}-\d{4})/g)
    if (jobNumber) {
      return 'job'
    } else {
      return 'other'
    }
  }

  self.trimmedDesc = ko.computed(function() {
    let trimmedDesc = self.description
    if (trimmedDesc && trimmedDesc.match(/(.+)(?:by.*$)/)) {
      trimmedDesc = trimmedDesc.match(/(.+)(?:by.*$)/)[1]
    }

    if (self.name.match(/^Team set as.*/)) {
      trimmedDesc = ''
    }

    return trimmedDesc
  })

  self.trimmedName = ko.computed(function() {
    let trimmedName = self.name
    if (self.name.match(/(\d{4}-\d{4})/g)) {
      trimmedName = trimmedName.replace(self.parent.callsign(), '')
    }
    return trimmedName
  })

  self.jobPop = function(data, event) {
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

      let address = ''
      LighthouseJob.get_job(jobNumber[0].replace('-', ''), 1, params.host, params.userId, pageToken, function(data) {
        // Job Tags
        var tagArray = new Array();
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

        details =
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
  var self = this;

  self.rawObject = rawObject
  self.id = id
  self.memberId = memberId
  self.personId = personId
  self.firstName = firstName
  self.lastName = lastName
  self.isTeamLeader = ko.observable(isTeamLeader)
  self.timeOn = ko.observable(timeOn)

  self.fullName = ko.computed(function() {
    return `${self.firstName} ${self.lastName}`
  })

  self.timeOnSince = ko.computed(function() {
    //force a recount when the timer runs
    myViewModel.dummyRecountMoments();
    return moment().diff(self.timeOn(), 'hours')
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

  var self = this;

  self.rawObject = rawObject
  self.id = id
  self.hidden = ko.observable(true)
  // self.hidden.extend({
  //   rateLimit: 100
  // });

  self.callsign = ko.observable(callsign)
  self.type = type

  self.sector = ko.observable(sector)
  self.status = ko.observable(status)

  self.statusTime = ko.observable(statusTime)
  self.activeJobs = ko.observable(activeJobs)

  self.teamLocation = ko.observable()

  self.loadingHistory = ko.observable(true)

  self.teamMembers = ko.observableArray()
  self.teamMembers.extend({
    rateLimit: 200
  });

  self.teamMembers.subscribe(function(newValue) {
    activateToolTips()
  })

  self.teamResources = ko.observable(teamResources)
  self.teamHistory = ko.observableArray()
  self.teamMembers.extend({
    rateLimit: 200
  });

  self.hidden.subscribe(function(newValue) {
    if (newValue == false) {
      positionFooter()
      self.fetchHistory()
    }
  })

  self.activeMembers = ko.computed(function() {
    return self.teamMembers.length
  })

  self.fetchHistory = function() {
    self.loadingHistory(true)
    let locationFound = false
    let locationMethod = ''
    let timeStampAgo = ''

    //All this code only works because you cant change the order of the history
    //if history order ever changes the push/unshift logic will need to be smarter

    LighthouseTeam.get_history(self.id, params.host, params.userId, pageToken, function(history) {

      self.teamHistory().forEach(function(t, index) {
        let found = false
        $.each(history.Results, function(i, el) {
          if (`${this.Name}-${this.Description}-${this.TimeStamp}` == `${t.name}-${t.description}-${t.timeStamp}`) {
            found = true
          }
        });
        if (!found) {
          self.teamHistory.splice(index, 1);
        }
      })

      //work backwards so that unshifting is possible
      history.Results.reverse().forEach(function(historyItem) {

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

        existingHistory = self.teamHistory().find(function(r, i) {
          if (`${r.name}-${r.description}-${r.timeStamp}` === `${historyItem.Name}-${historyItem.Description}-${historyItem.TimeStamp}`) {
            return true
          }
        })
        if (!existingHistory) { //if its a new history item

          let theNewHistory = new TeamHistory({
            parent: self,
            rawObject: historyItem,
            name: historyItem.Name,
            description: historyItem.Description,
            timeStamp: historyItem.TimeStamp,
          })
          //unshift so new things go at the begining
          self.teamHistory.unshift(theNewHistory)

        } else { //old history
          existingHistory.parent = self
          existingHistory.rawObject = historyItem
          existingHistory.name = historyItem.Name
          existingHistory.description = historyItem.Description
          existingHistory.timeStamp = historyItem.TimeStamp
        }
      })
      self.loadingHistory(false)

      if (locationFound) {
        LighthouseJob.get_job(locationFound.replace('-', ''), 1, params.host, params.userId, pageToken, function(job) {
          self.teamLocation(`${locationMethod} ${locationFound} (${timeStampAgo})<br>${job.Address.PrettyAddress.replace(', NSW','')}`)
        })
      }

    })
  }

  self.filteredTeamHistory = ko.computed({
    read: function() {
      var newHistoryArray = []

      let limit = self.teamHistory().length > 5 ? 5 : self.teamHistory().length

      //filter to hide history events we dont care for.
      let historyItems = self.teamHistory().filter(function(h) {
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

  self.filteredTeamHistory.extend({
    rateLimit: 50
  });

  self.statusStyle = ko.computed(function() {
    switch (self.status()) { //color the callsign by team status
      case 'Activated': //active
        return "team-active";
        break;
      case 'Standby': //standby
        return "team-standby";
        break;
      case 'Rest': //rest
        return "team-rest";
        break;
      case 'On Alert': //alert
        return "team-alert";
        break;
      default:
        return "team";
        break;
    }
  });

  self.teamMemberCount = ko.computed(function() {
    return self.teamMembers().length
  })
  self.teamMemberCount.extend({
    rateLimit: 200
  });

  self.teamMemberPersonIds = ko.computed(function() {
    return escape(JSON.stringify(self.teamMembers().map(function(t) {
      return t.personId
    })))
  })
  self.teamMemberPersonIds.extend({
    rateLimit: 200
  });


  self.statusTimePretty = ko.computed(function() {
    return moment(self.statusTime()).format('MMM D HH.mm')
  })

  self.statusTimeSince = ko.computed(function() {
    //force a recount when the timer runs
    myViewModel.dummyRecountMoments();

    return moment().diff(self.statusTime(), 'hours')
  })


  self.toggleHide = function(team) {
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
      token,
      tokenexp
    }) {
      pageToken = token
      mp && mp.open();
      mp && mp.setValue(-1);

      if (timeoverride != null) { //we are using a time override

        var end = new Date();

        var start = new Date();
        start.setDate(start.getDate() - (timeoverride / 24));

        starttime = start.toISOString();
        endtime = end.toISOString();

        params.start = starttime;
        params.end = endtime;

      } else {
        params = getSearchParameters();
      }
      if (unit == null) {
        console.log("firstrun...will fetch vars");

        if (typeof params.hq != 'undefined') { //if not no hqs
          if (params.hq.split(",").length == 1) { //if only one HQ
            LighthouseUnit.get_unit_name(params.hq, apiHost, params.userId, token, function(result, error) {
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
              LighthouseUnit.get_unit_name(d, params.host, params.userId, token, function(result, error) {
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

  LighthouseTeam.get_teams(unit, host, start, end, userId, token, function(teams) {

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
        $.each(teams.Results, function(i, el) {
          if (this.Id == d.id) {
            found = true
          }
        });
        if (!found) {
          myViewModel.teams.splice(index, 1);
        }
      })

      teams.Results.forEach(function(d) {

        allTeamsPromises.push(new Promise(function(resolve, reject) {


          let existingTeam = false //would be undef otherwise
          let storedTeam = {};
          existingTeam = myViewModel.teams().find(function(r, i) {
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
            $.each(d.Members, function(i, el) {
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
            existingTeamMember = storedTeam.teamMembers().find(function(r, i) {
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
              if (zone.hasOwnProperty(res.zone)) {
                zone[res.zone].count += 1;
              } else {
                zone[res.zone] = {}
                zone[res.zone].count = 1
              }
              if (clusters.hasOwnProperty(res.cluster)) {
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


function secondsToHms(d) {
  d = Number(d);
  var h = Math.floor(d / 3600);
  var m = Math.floor(d % 3600 / 60);
  var s = Math.floor(d % 3600 % 60);
  return ((h > 0 ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s);
}

function positionFooter() {
  var footerHeight = 55,
    footerTop = 0,
    $footer = $(".footer");
  footerHeight = $footer.height();
  footerTop = ($(window).scrollTop() + $(window).height() - footerHeight) + "px";

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


function truncateString(str, length) {
  return str.length > length ? str.substring(0, length - 3) + '...' : str
}



var firstRun = true


var apiLoadingInterlock = false


var timeperiod;
var unit = null;



//allow pretty popovers with inline style
$.fn.tooltip.Constructor.Default.whiteList['*'].push('style')



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
    $('body').on('click', function(e) {
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
      myViewModel.teams().forEach(function(d, index) {
        d.hidden(true)
      })
    })
    $(document).on('click', "#selectAllfilters", function() {
      myViewModel.teams().forEach(function(d, index) {
        d.hidden(false)
      })
    })
    $(document).on('click', "#selectAllActivatedfilters", function() {
      myViewModel.teams().forEach(function(d, index) {
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

    $('#filtermodal').on('hidden.bs.modal', function() {});


  });

});
