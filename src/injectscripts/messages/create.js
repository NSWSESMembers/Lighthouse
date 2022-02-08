var DOM = require('jsx-dom-factory');
var ReturnTeamsActiveAtLHQ = require('../../../lib/getteams.js');
var ReturnNitcAtLHQ = require('../../../lib/getnitc.js');

var SharedCollection = {}
var DownloadedObject = {}

console.log("inject running");

$(document).ready(function() {



    var query = window.location.search.substring(1);
    var qs = parse_query_string(query);

    $.each(qs, function(key, value){

        switch (key)
        {
          case "jobId":
          $.ajax({
              type: 'GET',
              url: urls.Base+'/Api/v1/Jobs/Search?Identifier=' + unescape(value),
              beforeSend: function(n) {
                  n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
              },
              data: {
                  LighthouseFunction: 'LoadJob',
              },
              cache: false,
              dataType: 'json',
              complete: function(response, textStatus) {
                if (textStatus == 'success') {
                  if (response.responseJSON.Results.length) {
                  msgsystem.job(response.responseJSON.Results[0])
                }
                }
              }
              })
          break
            case "lhquickrecipient":
            var people = JSON.parse(unescape(value))
            $.each(people, function(key, val) {
                $.ajax({
                    type: 'GET',
                    url: urls.Base+'/Api/v1/People/' + val + '/Contacts',
                    beforeSend: function(n) {
                        n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
                    },
                    data: {
                        LighthouseFunction: 'LoadPerson',
                        userId: user.Id
                    },
                    cache: false,
                    dataType: 'json',
                    complete: function(response, textStatus) {
                        if (textStatus == 'success') {
                            var wasAdded = false
                            if (response.responseJSON.Results.length) {
                                $.each(response.responseJSON.Results, function(k, v) {
                                    if (v.ContactTypeId == 2) {
                                        var BuildNew = {};
                                        BuildNew.Contact = v
                                        BuildNew.ContactGroup = null
                                        BuildNew.ContactTypeId = v.ContactTypeId
                                        BuildNew.Description = v.FirstName + " " + v.LastName;
                                        BuildNew.Detail = v.Detail;
                                        msgsystem.selectedRecipients.push(BuildNew)
                                    }
                                })
                                  }
                                }
                              }
                            })
                            })
                            $([document.documentElement, document.body]).animate({
                              scrollTop: $('textarea[data-bind="value: messageText"]')[0].scrollIntoView()
                            }, 2000);
            break
        }

    })

$('#LHCodeBox').keypress(function(e){
  if(e.keyCode==13)
      $('#LHImportCollectionCode').click();
});


if (localStorage.getItem("LighthouseMessagesEnabled") == "true" || localStorage.getItem("LighthouseMessagesEnabled") == null) {
    whenWeAreReady(msgsystem, function() {
        msgsystem.searchHeadquarters.subscribe(function(hqSet) {

            if (hqSet != null && hqSet != '') {
                LoadTeams()
                LoadNitc()

            } else { //normally after a message sent
                $('#HQTeamsSet').hide()
                $('#HQNitcSet').hide()

                $('#searchHQ').val('')

            }
        });

            //Home HQ - with a wait to catch possible race condition where the page is still loading
            whenWeAreReady(user, function() {
                var waiting = setInterval(function() {
                    if (msgsystem.loadingRecipients.peek() === false && typeof user.hq != "undefined") { //check if the core js is still searching for something
                        clearInterval(waiting); //stop timer
                        console.log("Setting Selected HQ to user HQ");
                        msgsystem.searchHeadquarters(user.hq);
                        $('#searchHQ').val(user.hq.Name)
                    } else {
                        console.log("messages is still loading")
                    }
                }, 200);
            });

        });
        //auto select ones that have the world default in them
        msgsystem.loadingRecipients.subscribe(function(status) {
            if (status == false) {
                msgsystem.availableRecipients.peek().forEach(function(item) {
                    if (item.Description.indexOf("(default)") > -1) {
                        msgsystem.addContactGroup(item);
                    }
                })
            }
        })

    } else {
        console.log("Not running due to preference setting")
    }

    msgsystem.replyToAddress.subscribe(function(r) {
      if (localStorage.getItem("LighthouseReplyRemember") == "true" || localStorage.getItem("LighthouseReplyRemember") == null) {
        if (r != null && r != '') {
          localStorage.setItem("LighthouseReplyDetail", r);
        }
      }
    })

    if (localStorage.getItem("LighthouseReplyRemember") == "true" || localStorage.getItem("LighthouseReplyRemember") == null) {
      if (localStorage.getItem("LighthouseReplyDetail") != null && localStorage.getItem("LighthouseReplyDetail") != '') {
        msgsystem.replyToAddress(localStorage.getItem("LighthouseReplyDetail"))
        $('#replyAddress').value = localStorage.getItem("LighthouseReplyDetail")
      }
    }

    //Operational = true
    msgsystem.operational(true);

    $('#lighthouseReplyRemember').click(function() {
        if (localStorage.getItem("LighthouseReplyRemember") == "true" || localStorage.getItem("LighthouseReplyRemember") === null) //its true so uncheck it
        {
            $(this).toggleClass("fa-check-square-o fa-square-o")
            localStorage.setItem("LighthouseReplyRemember", false);
        } else //its false so uncheck it
        {
            $(this).toggleClass("fa-square-o fa-check-square-o")
            localStorage.setItem("LighthouseReplyRemember", true);
            //save the current Value
            if (msgsystem.replyToAddress.peek() != null && msgsystem.replyToAddress.peek() != '') {
                localStorage.setItem("LighthouseReplyDetail", msgsystem.replyToAddress.peek());
            }
        }
    });

    $('#lighthouseEnabled').click(function() {
        if (localStorage.getItem("LighthouseMessagesEnabled") == "true" || localStorage.getItem("LighthouseMessagesEnabled") === null) //its true so uncheck it
        {
            $(this).toggleClass("fa-check-square-o fa-square-o")
            localStorage.setItem("LighthouseMessagesEnabled", false);
            location.reload();

        } else //its false so uncheck it
        {
            $(this).toggleClass("fa-square-o fa-check-square-o")
            localStorage.setItem("LighthouseMessagesEnabled", true);
            location.reload();


        }
    });

    $("#recipientsdel").click(function() {
        msgsystem.selectedRecipients.removeAll();
    })

});

function LoadNitc() {

    FetchNITC(5)

    function FetchNITC(size) {

        $('#nitcFooter').remove() // remove the footer if exists

         $('#lighthousenitc').empty() //empty to prevent dupes

         var spinner = $(<i style="width:100%; margin-top:4px; margin-left:auto; margin-right:auto" class="fa fa-refresh fa-spin fa-2x fa-fw"></i>)

         spinner.appendTo($('#lighthousenitc'));
         $('#nitchq').text("NITC Events (with Participants) at " + msgsystem.searchHeadquarters.peek().Name + " (±30 Days)")
         $('#HQNitcSet').show()

         ReturnNitcAtLHQ(msgsystem.searchHeadquarters.peek(),size,function(response) {
            var numberOfevents = 0 //count number with participants
            if (response.responseJSON.Results.length) {
            $('#lighthousenitc').empty() //empty to prevent dupes and spinners
            $.each(response.responseJSON.Results, function(k, v) {
                if (v.Participants.length > 0)
                {
                    numberOfevents++
                    var members = $.map(v.Participants, function(obj){return obj.Person.FirstName +" "+ obj.Person.LastName}).join(', ')

                    var button = make_nitc_button(v.Name, moment(v.StartDate).format('HH:mm:ss DD/MM/YYYY'), v.Description+' - '+members, v.Participants.length + "")

                    $(button).click(function() {
                        var total = v.Participants.length

                            //Operational = false - probably
                            msgsystem.operational(false);

                            var spinner = $(<i style="margin-top:4px" class="fa fa-refresh fa-spin fa-2x fa-fw"></i>)

                            $(button).children().css('display','none')
                            spinner.appendTo(button);
                            console.log("clicked " + v.Id)
                            $.each(v.Participants, function(kk, vv) {
                                $.ajax({
                                    type: 'GET',
                                    url: urls.Base+'/Api/v1/People/' + vv.Person.Id + '/Contacts',
                                    beforeSend: function(n) {
                                        n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
                                    },
                                    data: {
                                        LighthouseFunction: 'LoadPerson',
                                        userId: user.Id
                                    },
                                    cache: false,
                                    dataType: 'json',
                                    complete: function(response, textStatus) {
                                        if (textStatus == 'success') {
                                            var wasAdded = false
                                            if (response.responseJSON.Results.length) {
                                                $.each(response.responseJSON.Results, function(k, v) {
                                                    if (v.ContactTypeId == 2) {
                                                        wasAdded = true
                                                        total--
                                                        var BuildNew = {};
                                                        BuildNew.Contact = v
                                                        BuildNew.ContactGroup = null
                                                        BuildNew.ContactTypeId = v.ContactTypeId
                                                        BuildNew.Description = v.FirstName + " " + v.LastName;
                                                        BuildNew.Detail = v.Detail;
                                                        msgsystem.selectedRecipients.push(BuildNew)
                                                        if (total == 0) //when they have all loaded, stop spinning.
                                                        {
                                                            spinner.remove();
                                                            //cb for when they are loaded
                                                            $(button).children().css('display','')
                                                        }


                                                    }
                                                })
                                                  if (wasAdded == false)
                                                    {
                                                      total--
                                                        if (total == 0) //when they have all loaded, stop spinning.
                                                        {
                                                            spinner.remove();
                                                            //cb for when they are loaded
                                                            $(button).children().css('display','')
                                                        }
                                                    }
                                                } else {
                                                    //no results for this guy. thats ok, skip it.

                                                    if ($total == 0) //when they have all loaded, stop spinning.
                                                    {
                                                      console.log('done loading team')
                                                      spinner.remove();
                                                      //cb for when they are loaded
                                                      $(button).children().css('display','')
                                                    }
                                                  }
                                                } else {
                                                  //bad answer from the server. thats ok, skip it.

                                                  if ($total == 0) //when they have all loaded, stop spinning.
                                                    {
                                                      console.log('done loading team')
                                                      spinner.remove();
                                                      //cb for when they are loaded
                                                      $(button).children().css('display','')
                                                    }
                                                  }
                                                }
                                              })
                                            })
                                          })
                                          $(button).appendTo('#lighthousenitc');
                                          button.style.width = button.offsetWidth + "px";
                                          button.style.height = button.offsetHeight + "px";
                                        }
                                      })
                                    } else {
                                      //nothing found
                                      $('#lighthousenitc').empty() //empty to prevent dupes

                                    }
                                    $('#nitccount').text(numberOfevents)
                                    if (response.responseJSON.TotalItems >  response.responseJSON.PageSize)
                                    {
                                      var loadall = make_nitc_load_all_button(response.responseJSON.TotalItems)
                                      $(loadall).find('#nitcloadall').click(function() {
                                        FetchNITC(response.responseJSON.TotalItems)
                                      })
                                      $(loadall).appendTo('#lighthousenitcpanel');
                                    }


                                  })
                                }

                              }


function LoadTeams() {
    $('#lighthouseteams').empty() //empty to prevent dupes

    var spinner = $(<i style="width:100%; margin-top:4px; margin-left:auto; margin-right:auto" class="fa fa-refresh fa-spin fa-2x fa-fw"></i>)

    spinner.appendTo($('#lighthouseteams'));
    $('#teamshq').text("Active Teams (with Members) at " + msgsystem.searchHeadquarters.peek().Name)
    $('#HQTeamsSet').show()
    ReturnTeamsActiveAtLHQ(msgsystem.searchHeadquarters.peek(), null, function(response) {
        var numberOfTeam = 0
        if (response.responseJSON.Results.length) {
            $('#lighthouseteams').empty() //empty to prevent dupes and spinners
            $.each(response.responseJSON.Results, function(k, v) {
                if (v.Members.length > 0) //only show teams with members
                {
                    var TL = ""
                    numberOfTeam++
                    $.each(v.Members, function(kk, vv) {
                        if (vv.TeamLeader == true) {
                            TL = vv.Person.FirstName + " " + vv.Person.LastName
                        }
                    })
                    //length + "" to make it a string
                    var members = $.map(v.Members, function(obj){return obj.Person.FirstName +" "+ obj.Person.LastName}).join(', ')

                    var button = make_team_button(v.Callsign, TL, members, v.Members.length + "")
                    $(button).click(function() {
                        var spinner = $(<i style="margin-top:4px" class="fa fa-refresh fa-spin fa-2x fa-fw"></i>)

                        $(button).children().css('display','none')
                        spinner.appendTo(button);
                        console.log("clicked " + v.Callsign)
                        var total = v.Members.length
                        $.each(v.Members, function(kk, vv) {
                            $.ajax({
                                type: 'GET',
                                url: urls.Base+'/Api/v1/People/' + vv.Person.Id + '/Contacts',
                                beforeSend: function(n) {
                                    n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
                                },
                                data: {
                                    LighthouseFunction: 'LoadPerson',
                                    userId: user.Id
                                },
                                cache: false,
                                dataType: 'json',
                                complete: function(response, textStatus) {
                                    if (textStatus == 'success') {
                                        if (response.responseJSON.Results.length) {
                                            var wasAdded = false
                                            $.each(response.responseJSON.Results, function(k, v) {
                                                if (v.ContactTypeId == 2) {
                                                    wasAdded = true
                                                    total--
                                                    var BuildNew = {};
                                                    BuildNew.Contact = v
                                                    BuildNew.ContactGroup = null
                                                    BuildNew.ContactTypeId = v.ContactTypeId
                                                    if (vv.TeamLeader) {
                                                        BuildNew.Description = v.FirstName + " " + v.LastName + " (TL)";

                                                    } else {
                                                        BuildNew.Description = v.FirstName + " " + v.LastName;

                                                    }
                                                    BuildNew.Detail = v.Detail;
                                                    msgsystem.selectedRecipients.push(BuildNew)
                                                    if (total == 0) //when they have all loaded, stop spinning.
                                                    {
                                                        spinner.remove();
                                                        //cb for when they are loaded
                                                        $(button).children().css('display','')
                                                    }
                                                }
                                            })
if (wasAdded == false)
{
    total--
                                                    if (total == 0) //when they have all loaded, stop spinning.
                                                    {
                                                        spinner.remove();
                                                            //cb for when they are loaded
                                                            $(button).children().css('display','')
                                                        }
                                                    }
                                                } else {
  //no results for this guy. thats ok, skip it.

    if (total == 0) //when they have all loaded, stop spinning.
    {
        console.log('done loading team')
        spinner.remove();
        //cb for when they are loaded
        $(button).children().css('display','')
    }
}
} else {
  total--
  //bad answer from the server. thats ok, skip it.

    if ($total == 0) //when they have all loaded, stop spinning.
    {
        console.log('done loading team')
        spinner.remove();
        //cb for when they are loaded
        $(button).children().css('display','')
    }
}
}
})
})
})

$(button).appendTo('#lighthouseteams');
button.style.width = button.offsetWidth + "px";
button.style.height = button.offsetHeight + "px";
}
})
} else {
            //nothing found
            $('#lighthouseteams').empty() //empty to prevent dupes

        }
        $('#teamscount').text(numberOfTeam)
    });
}




function make_team_button(name, TL, members, counts) {
    return (
        <span class="label tag-darkgreen" title={members}>
        <span><p  style="margin-bottom:5px">{name}</p></span>
        <span><p style="margin-bottom:5px;font-size:12px">{TL}<sup>TL</sup></p></span>
        <span><p style="margin-bottom:0px;font-size:11px;margin-top: 4px">{counts} Members</p></span>
        </span>
        )
}

function make_nitc_button(name, tags, description, counts) {
    return (
        <span class="label tag-darkgoldenrod" title={description}>
        <span><p  style="margin-bottom:5px">{name}</p></span>
        <span><p style="margin-bottom:5px;font-size:12px">{tags}</p></span>
        <span><p style="margin-bottom:0px;font-size:11px;margin-top: 4px">{counts} Participants</p></span>
        </span>
        )
}

function make_nitc_load_all_button(total) {
    return (
        <div class="panel-footer" id="nitcFooter">
        <button id="nitcloadall" class="btn btn-default">Load All ({total+""})</button>
        </div>
        )
}


function whenWeAreReady(varToCheck, cb) { //when external vars have loaded
    var waiting = setInterval(function() {
        if (typeof varToCheck != "undefined") {
            clearInterval(waiting); //stop timer
            cb(); //call back
        }
    }, 200);
}

function copyToClipboard(text) {
  var $temp = $("<input>");
  $("body").append($temp);
  $temp.val(text).select();
  document.execCommand("copy");
  $temp.remove();
}

function parse_query_string(query) {
  var vars = query.split("&");
  var query_string = {};
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    // If first entry with this name
    if (typeof query_string[pair[0]] === "undefined") {
      query_string[pair[0]] = decodeURIComponent(pair[1]);
      // If second entry with this name
  } else if (typeof query_string[pair[0]] === "string") {
      var arr = [query_string[pair[0]], decodeURIComponent(pair[1])];
      query_string[pair[0]] = arr;
      // If third or later entry with this name
  } else {
      query_string[pair[0]].push(decodeURIComponent(pair[1]));
  }
}
return query_string;
}
