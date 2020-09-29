var LighthouseJob = require('../lib/shared_job_code.js');
var LighthouseUnit = require('../lib/shared_unit_code.js');
var LighthouseJson = require('../lib/shared_json_code.js');
var LighthouseTeam = require('../lib/shared_team_code.js');
var LighthouseChrome = require('../lib/shared_chrome_code.js');
var clusterCodes = require('../../lib/clusters.js');

require('bootstrap');
require('@fortawesome/fontawesome-free');

var moment = require('moment');
var $ = require('jquery');
global.jQuery = $;

var timeoverride = null;

var params = getSearchParameters();

var apiHost = params.host
var token = ''
var tokenexp = ''
var allTeams = []
var firstRun = true

var setColWidth = 4
var setDefaultAdd = true

//allow pretty popovers with inline style
$.fn.tooltip.Constructor.Default.whiteList['*'].push('style')


// inject css c/o browserify-css
require('../styles/teamsummary.css');

// window.onerror = function(message, url, lineNumber) {
//   document.getElementById("loading").innerHTML = "Error loading page<br>"+message;
//   return true;
// };

//on DOM load
document.addEventListener('DOMContentLoaded', function() {

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
  display = document.querySelector('#time');
  startTimer(180, display);

  RunForestRun(mp)
  $('body').addClass('fade-in');

});


$(document).on('change', 'input[name=slide]:radio', function() {
  timeoverride = (this.value == "reset" ? null : this.value);
  RunForestRun();
});

//refresh button
$(document).ready(function() {

  //Dynamic popovers are a bitch. This will remmove any/all on body click
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

  validateTokenExpiration();
  setInterval(validateTokenExpiration, 3e5);

  if (chrome.manifest.name.includes("Development")) {
    $('body').addClass("watermark");
  }


  document.getElementById("refresh").onclick = function() {
    RunForestRun();
  }
  $(document).on('click', "#unselectAllfilters", function() {
    $("#teamFilterList").find("li").removeClass('active');
    allTeams.forEach(function(team) {
      team.needsToBeHidden = true
    })
  })
  $(document).on('click', "#selectAllfilters", function() {
    $("#teamFilterList").find("li").addClass('active');
    allTeams.forEach(function(team) {
      team.needsToBeHidden = false
    })
  })
  $(document).on('click', "#selectAllActivatedfilters", function() {
    $("#teamFilterList").find('li[data-status="Activated"]').addClass('active');
    $("#teamFilterList").find('li:not([data-status="Activated"])').removeClass('active');

    allTeams.forEach(function(team) {
      if (team.rawObject.TeamStatusType.Name == "Activated") {
        team.needsToBeHidden = false
      } else {
        team.needsToBeHidden = true
      }
    })
  })

  $(document).on('click', ".teamFilters", function() {
    showSearchFilters();
  })

  $(document).on('click', "#filtersSave", function() {

    setColWidth = parseInt($('#gridWidth')[0].value)

    setDefaultAdd = $('#autoShowNewTeams').is(':checked')

    allTeams.forEach(function(eachTeam) {
      if (typeof eachTeam.needsToBeHidden != 'undefined') {
        eachTeam.hidden = eachTeam.needsToBeHidden
        delete eachTeam.needsToBeHidden
      }
    })
    $('#filtermodal').modal('hide');
    RunForestRun();
  })

  $('#filtermodal').on('hidden.bs.modal', function() {
    allTeams.forEach(function(eachTeam) {
      if (typeof eachTeam.needsToBeHidden != 'undefined') {
        delete eachTeam.needsToBeHidden
      }
    })
  });


});

function showSearchFilters() {
  $("#teamFilterList").empty()
  if (allTeams.length) {
    allTeams.forEach(function(eachTeam) {
      let team = eachTeam.rawObject
      let theRow = $(`<li class="list-group-item" data-status="${team.TeamStatusType.Name}">${team.Callsign.trim()} (${team.TeamType.Name} | ${team.TeamStatusType.Name})</li>`)
      if (eachTeam.hidden == false) {
        $(theRow).addClass('active');
      }
      $(theRow).click(function(e) {
        e.preventDefault()
        if ($(this).hasClass('active')) {
          //filter away this team
          $(this).removeClass('active');
          eachTeam.needsToBeHidden = true

        } else {
          //show it
          $(this).addClass('active');
          eachTeam.needsToBeHidden = false
        }
      })
      $('#teamFilterList').append(theRow)
    })
  } else {
    $('#teamFilterList').append('<i>No Teams</i>')
  }

  $('#gridWidth')[0].value = `${setColWidth}`

  if (setDefaultAdd) {
    $('#autoShowNewTeams').prop("checked", true)
  } else {
    $('#autoShowNewTeams').prop("checked", false)
  }

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

var timeperiod;
var unit = null;

function validateTokenExpiration() {
  getToken(function() {
    moment().isAfter(moment(tokenexp).subtract(5, "minutes")) && (console.log("token expiry triggered. time to renew."),
      $.ajax({
        type: 'GET',
        url: params.source + "/Authorization/RefreshToken",
        beforeSend: function(n) {
          n.setRequestHeader("Authorization", "Bearer " + token)
        },
        cache: false,
        dataType: 'json',
        complete: function(response, textStatus) {
          token = response.responseJSON.access_token
          tokenexp = response.responseJSON.expires_at
          chrome.storage.local.set({
            ['beaconAPIToken-' + apiHost]: JSON.stringify({
              token: token,
              expdate: tokenexp
            })
          }, function() {
            console.log('local data set - beaconAPIToken')
          })
          console.log("successful token renew.")
        }
      })
    )
  })
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

    if (--timer < 0) { //when the timer is 0 run the code
      timer = duration;
      RunForestRun();
    }
  }, 1000);
}



//Get times vars for the call
function RunForestRun(mp) {
  getToken(function() {
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
          mp && mp.setText(`Loading unit #${params.hq}`)
          LighthouseUnit.get_unit_name(params.hq, apiHost, token, function(result, error) {
            if (typeof error == 'undefined') {
              unit = result;
              HackTheMatrix(unit, apiHost, params.source, token, mp);
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
            LighthouseUnit.get_unit_name(d, params.host, token, function(result, error) {
              mp && mp.setText(`Loaded unit ${result.Code}`)
              if (typeof error == 'undefined') {
                unit.push(result);
                if (unit.length == params.hq.split(",").length) {
                  HackTheMatrix(unit, apiHost, params.source, token, mp);
                }
              } else {
                mp.fail(error)
              }
            });
          });
        }
      } else { //no hq was sent, get them all
        unit = [];
        HackTheMatrix(unit, apiHost, params.source, token, mp);
      }
    } else {
      console.log("rerun...will NOT fetch vars");
      $('#loadinginline').css('display', 'block');
      HackTheMatrix(unit, apiHost, params.source, token);
    }
  })
}

//make the call to beacon
function HackTheMatrix(unit, host, source, token, progressBar) {

  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));
  var membersActive = 0;
  var teamsActive = 0;
  var teamsHidden = 0;

  LighthouseTeam.get_teams(unit, host, start, end, token, function(teams) {

      var options = { //date display options
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "numeric",
        hour12: false,
      };

      //remove teams from the main array that are not longer returned from the api query
      allTeams.forEach(function(d, index) {
        let found = false
        $.each(teams.Results, function(i, el) {
          if (this.Id == d.Id) {
            found = true
          }
        });
        if (!found) {
          allTeams.splice(index, 1);
        }
      })

      teams.Results.forEach(function(d) {
        let foundIndex = null;
        let isOld = false //would be undef otherwise
        isOld = allTeams.find(function(r, i) {
          if (r.Id === d.Id) {
            foundIndex = i
            return true
          }
        })
        if (!isOld) { //if its a new team
          let newTeam = {}
          newTeam.Id = d.Id
          newTeam.hidden = true //default hidden unless below

          if (d.TeamType.Name === 'Field') { //default only show field teams
          if (setDefaultAdd) {
            if (d.TeamStatusType.Name === "Activated") {
              newTeam.hidden = false
            } else {
              newTeam.hidden = true
            }
          }
        }


          newTeam.rawObject = d
          allTeams.push(newTeam)
        } else { //existing team

          if (setDefaultAdd) {
            if (allTeams[foundIndex].rawObject.TeamStatusType.Name !== "Activated" && d.TeamStatusType.Name === "Activated") { //if the team is now activated and wasnt before
              allTeams[foundIndex].hidden = false
            }
          }

          allTeams[foundIndex].rawObject = d
        }

      })

      allTeams.sort(function(a, b) {
        if (b.TaskedJobCount < a.TaskedJobCount) {
          return -1;
        }
        if (b.TaskedJobCount > a.TaskedJobCount) {
          return 1;
        }
        return 0;
      })

      if (firstRun) {
        firstRun = false;
        showSearchFilters();
      }

      $("#resultstable tbody tr").each(function() {
        this.parentNode.removeChild(this);
      });

      const columnMax = 3;
      let theCards = [];
      let thisRow = [];

      allTeams.forEach(function(eachTeam) {
        progressBar && progressBar.setText(`Loading team ${eachTeam.CallSign}`)

        if (eachTeam.hidden == false) {
          let teamId = eachTeam.Id
          let team = eachTeam.rawObject


          teamsActive++;

          // let rawTeamStartDate = new Date(team.TeamStatusStartDate);
          // let teamdate = new Date(rawTeamStartDate.getTime());
          let teamStatusTime = moment(team.TeamStatusStartDate).format('MMM D HH.mm')
          let teamStatusClass = ''
          switch (team.TeamStatusType.Id) { //color the callsign by team status
            case 3: //active
              teamStatusClass = "team-active";
              break;
            case 1: //standby
              teamStatusClass = "team-standby";
              break;
            case 4: //rest
              teamStatusClass = "team-rest";
              break;
            case 2: //alert
              teamStatusClass = "team-alert";
              break;
            default:
              teamStatusClass = "team";
              break;
          }


          let teamMembers = []
          let teamMemberIds = []

          if (team.Members.length == 0) {
            teamMembers.push($('<i>No Team Members Allocated</i>'))
          } else {
            team.Members.forEach(function(d2) { //for each member in the team
              const memberRunTime = moment().diff(d2.TimeOn, 'hours')
              teamMemberIds.push(d2.Person.Id)
              membersActive++; //count them

              const tmpDom = $(`<span class="team-member" data-toggle="tooltip" title="${d2.Person.FirstName} has been active for ${memberRunTime} Hrs">${d2.Person.FirstName} ${d2.Person.LastName}</span>`)

              if (d2.TeamLeader == true) { //bold if team leader
                tmpDom.addClass('team-leader')
              }

              if (memberRunTime >= 10 & memberRunTime <= 12) {
                tmpDom.addClass('team-stat-warning')
              } else if (memberRunTime > 12) {
                tmpDom.addClass('team-stat-hazard')
              }

              teamMembers.push(tmpDom)
            });
          }

          let teamResources = []
          if (team.Resources.length == 0) {
            teamResources.push('<i>No Resources Allocated</i>')
          } else {
            team.Resources.forEach(function(r) { //for each member in the team
              teamResources.push(`${r.Name}`)
            });
          }
          let colCount = 12 / setColWidth

          const thisBox = $(`
          <div class="col-${colCount} col-team">
              <div class="team ${teamStatusClass}">
                   <div class="row">
                         <div class="team-callsign text-center col-12"><a href="${source}/Teams/${team.Id}/Edit" target="_blank">${team.Callsign.trim()}</a></div>
                   </div>
                   <div class="team-status-summary row">
                         <div class="team-status text-left col-5">${team.TeamType.Name == "Operations" ? "Ops" : team.TeamType.Name} | ${team.TeamStatusType.Name}</div>
                         <div class="team-buttons text-left col-2">
                         ${teamMemberIds.length ? `<a href="${source}/Messages/Create?lhquickrecipient=${escape(JSON.stringify(teamMemberIds))}" target="_blank">` : ''}<i data-toggle="tooltip" title="SMS all team members" class="fas fa-envelope ${teamMemberIds.length ? '' : 'fa-disabled'}"></i>${teamMemberIds.length ? `</a>` : ''}
                         </div>
                         <div class="team-time col-5 text-right"><i class="far fa-clock"></i> ${teamStatusTime}</div>
                   </div>
                   <div class="team-summary row">
                         <div class="team-job-count-active col-6 text-left">Active Jobs: <i class="fas fa-spinner fa-spin"></i></div>
                         <div class="team-job-count-completed col-6 text-right">Active For: <i class="fas fa-spinner fa-spin"></i></div>
                   </div>
                   ${team.Sector ? `
                     <div class="sector-summary row">
                      <div class="col-12 text-center">${team.Sector.Name} Sector</div>
                     </div>
                     ` : ''}
                   <div class="row team-resources">
                   <div class="col-12 text-center">${teamResources.join(', ')}</div>
                   </div>
                   <div class="row team-members">
                         <div class="col-12 text-center"></div>
                   </div>
                   <div class="row team-history">
                   <div class="container"></div>
                   </div>
                   <div class="row team-history-view">
                   <div class="col-12 text-center"><a href="${source}/Teams/History/${teamId}" target="_blank">View full team history</a></div>
                   </div>
                   </div>
               </div>
            </div>
          `)

          thisBox.find('.team-members > .text-center').append(teamMembers)

          var latest = null;
          var oldesttime = null;
          var completed = 0;

          progressBar && progressBar.setText(`Loading team ${team.Callsign} history`)

          LighthouseTeam.get_history(teamId, host, token, function(e) {
            let historyItems = []
            e.Results.forEach(function(f) {
              const timeStamp = moment(f.TimeStamp).format('MMM D HH.mm')
              let jobNumber = f.Name.match(/(\d{4}-\d{4})/g)
              let holdMyDOM = {}
              holdMyDOM.name = f.Name
              holdMyDOM.description = f.Description
              let trimmedDesc = f.Description
              //trim off the 'by person name'
              if (trimmedDesc && trimmedDesc.match(/(.+)(?:by.*$)/)) {
                trimmedDesc = trimmedDesc.match(/(.+)(?:by.*$)/)[1]
              }
              console.log(trimmedDesc.replace(team.Callsign,'Team'))

              if (f.Name.match(/^Team set as.*/)) {
                trimmedDesc = ''
              }

              if (jobNumber) { //if its about a job
                holdMyDOM.timeStamp = timeStamp
                holdMyDOM.dom = $(`<div class="row team-history-row"><div class="team-history col-8 history-job"><strong class="history-job-number">${f.Name.replace(team.Callsign,'')}</strong></a><small>${f.Description != '' && f.Description != null ? '<br>'+ truncateString(f.Description, 200) : ''}</small></div><div class="team-job col-4 text-center">${timeStamp}</div></div>`)
              } else {
                holdMyDOM.timeStamp = timeStamp
                holdMyDOM.dom = $(`<div class="row team-history-row"><div class="team-history col-8"><strong>${f.Name}</strong><small>${trimmedDesc != '' && trimmedDesc != null  ? '<br>'+trimmedDesc : ''}</small></div><div class="team-job col-4 text-center">${timeStamp}</div></div>`)
              }

              function jobAddress(cb) {
                let address = ''
                LighthouseJob.get_job(jobNumber[0].replace('-', ''), 1, host, token, function(data) {
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
                    `<div id='jobPopUp' style="margin-top:-5px"><div id='jobType' style="margin:auto;text-align:center;font-weight: bold;background-color:${bgcolor};color:${txtcolor}">${data.JobType.Name} - ${data.JobStatusType.Name}</div>\
                  <div id='jobPriority' style="margin:auto;text-align:center;background-color:${bgcolor};color:${txtcolor}"><span id='lhqStatus'>${data.JobPriorityType.Description}</span></div>\
                  <div style="display:block;text-align: center;font-weight:bold;margin-top:10px">${data.Address.PrettyAddress}</div>\
                  <div id='JobDetails' style="padding-top:10px;width:100%;margin:auto">\
                  <div id='JobSoS' style="display:block;text-align:center">${(data.SituationOnScene != null) ? data.SituationOnScene : "<i>No situation on scene available.</i>" }</div>
                  <div id='JobTags' style="display:block;text-align:center;padding-top:10px">${tagString}</div>
                  <span style="font-weight:bold;font-size:smaller;display:block;text-align:center">\
                  <div style="display:block;text-align:center;padding-top:10px"><a href=${source}/Jobs/${data.Id} target='_blank'>View Job Details</a></div>
                  <hr style="height: 1px;margin-top:5px;margin-bottom:5px">\
                  Job recieved at ${moment(data.JobReceived).format('HH:mm:ss DD/MM/YYYY')}<br>
                  ${(data.EntityAssignedTo.ParentEntity ? (data.EntityAssignedTo.Code+" - "+data.EntityAssignedTo.ParentEntity.Code) : data.EntityAssignedTo.Code)}
                  </span></div>`;
                  cb(details)

                })
              }

              holdMyDOM.dom.find('.history-job').click(function(e) {
                var el = $(this);

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
              });

              historyItems.push(holdMyDOM)

            })

            //20 on the page we fetch so limit 20 without other code changes
            let limit = historyItems.length > 5 ? 5 : historyItems.length
            let index = 0
            //while we are under the limit or break at end of array
            //we roll up add/remove so we cant just count items
            while ($(thisBox).find('.team-history > .container > .row').length < limit) {

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
                let multiTeamDom = $(`<div class="row team-history-row"><div class="team-history col-8"><strong>Members ${addingOrRemoving} ${verb} team</strong><small><br>${teamMembersAddedOrRemoved.join(', ')}</small></div><div class="team-job col-4 text-center">${historyItems[index].timeStamp}</div></div>`)
                $(thisBox).find('.team-history > .container').append(multiTeamDom) //add the grouped DOM
                if (typeof historyItems[index + loopCount] !== 'undefined') { //is there another DOM left to add or did we run out of team history
                  $(thisBox).find('.team-history > .container').append(historyItems[index + loopCount].dom) //add the dom that wasnt the group
                }

                index = index + loopCount //reset the index to true index + number of history items walked over
              } else {
                //not a rollup so just add it
                if (typeof historyItems[index] !== 'undefined') { //are we at the end
                  $(thisBox).find('.team-history > .container').append(historyItems[index].dom)
                }
              }
              //if we are at the end otherwise go again
              if (historyItems.length == index) {
                break
              } else {
                index++
              }
            }


            //activate all pops
            $('[data-toggle="tooltip"]').tooltip()

          })

          $(thisBox).find('.team-job-count-active')[0].innerHTML = `Active Jobs: ${team.TaskedJobCount}`
          $(thisBox).find('.team-job-count-completed')[0].innerHTML = `${team.TeamStatusType.Name} For: ${moment().diff(team.TeamStatusStartDate, 'hours')} Hrs`

          if (team.TeamStatusType.Name == 'Activated') {
            if (team.TaskedJobCount == 0) {
              $(thisBox).find('.team-job-count-active').addClass('team-stat-hazard')
            } else if (team.TaskedJobCount == 1) {
              $(thisBox).find('.team-job-count-active').addClass('team-stat-warning')
            }

            if (moment().diff(team.TeamStatusStartDate, 'hours') > 10 & moment().diff(team.TeamStatusStartDate, 'hours') < 12) {
              $(thisBox).find('.team-job-count-completed').addClass('team-stat-warning')
            } else if (moment().diff(team.TeamStatusStartDate, 'hours') > 12) {
              $(thisBox).find('.team-job-count-completed').addClass('team-stat-hazard')

            }


          }



          theCards.push(thisBox)

        } else {
          teamsHidden++;
        }
      })

      let bannerTitle;

      if (unit.length == 0) { //whole nsw state
        document.title = "NSW Team Summary";
        bannerTitle = "<h2>Team summary for NSW</h2>";
        renderPage()
      } else {
        if (Array.isArray(unit) == false) { //1 lga
          document.title = unit.Name + " Team Summary";
          bannerTitle = '<h2>Team summary for ' + unit.Name + "</h2>";
          renderPage()
        };
        if (unit.length > 1) { //more than one

          let iPromise = []
          unit.forEach(function(unit) {
            progressBar && progressBar.setText(`Loading cluster name ${unit.Name}`)

            iPromise.push(new Promise(function(resolve, reject) {
              try {
                clusterCodes.returnCluster(unit.Name, function(cluster) {
                  resolve({
                    zone: unit.ParentEntity.Code,
                    cluster: cluster.clusterCode
                  })
                })
              } catch (e) {
                reject(e)
              }
            }))
          })

          Promise.all(iPromise).then(function(results) {
            let clusters = {}
            let zone = {}
            let groupName = ''
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
            bannerTitle = `<h2>Team summary for ${groupName}</h2>`;
            renderPage()
          })
        }
      }


      function renderPage() {
        //banner first
        const banner = $(`
			   <div class="col-12 text-center">
				     ${bannerTitle}<h4>${start.toLocaleTimeString("en-au", options)} to ${end.toLocaleTimeString("en-au", options)}</h4><h4 class="teamFilters">Displayed Members: ${membersActive} | Displayed Teams: ${teamsActive}  | Hidden Teams: ${teamsHidden}</h4>
			   </div>
      `)
        $('#pageHeader').children().remove()
        $('#pageHeader').append(banner)

        $('#pageContent').children('.team-row').remove()
        $('#pageContent').append(`<div class="row display-flex team-row"></div>`)

        for (index = 0, len = theCards.length; index < len; ++index) {
          if (index % setColWidth == 0) {
            $('#pageContent').append(`<div class="row team-row"></div>`)
          }
          $('#pageContent').find('.team-row:last-child').append(theCards[index])
        }

        //progressBar && progressBar.setValue(1);
        progressBar && progressBar.close();
        $('#loadinginline').css('display', 'none');
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
      }
    },
    [1, 2, 3, 4] // StatusTypeId=3 - Activated
  );
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

// wait for token to have loaded
function getToken(cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
    chrome.storage.local.get('beaconAPIToken-' + apiHost, function(data) {
      var tokenJSON = JSON.parse(data['beaconAPIToken-' + apiHost])
      if (typeof tokenJSON.token !== "undefined" && typeof tokenJSON.expdate !== "undefined" && tokenJSON.token != '' && tokenJSON.expdate != '') {
        token = tokenJSON.token
        tokenexp = tokenJSON.expdate
        console.log("api key has been found");
        clearInterval(waiting); //stop timer
        cb(); //call back
      }
    })
  }, 200);
}

function truncateString(str, length) {
     return str.length > length ? str.substring(0, length - 3) + '...' : str
  }
