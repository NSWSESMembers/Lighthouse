var DOM = require('jsx-dom-factory');
var ReturnTeamsActiveAtLHQ = require('../../../lib/getteams.js');
var ReturnNitcAtLHQ = require('../../../lib/getnitc.js');

var SharedCollection = {}
var DownloadedObject = {}

console.log("inject running");

$(document).ready(function() {


    $( "body" ).append(make_collection_import_modal())

    $( "body" ).append(make_collection_share_modal())

    var query = window.location.search.substring(1);
    var qs = parse_query_string(query);

    $.each(qs, function(value, key){
        switch (value)
        {
            case "importcollection":
            $('#LHImportCollectionErrorText').hide()
            DownloadedObject = {}
            $('#LHCodeBox').val(key)
            $('#LGCollectionImportGroup').find('span').remove()
            $('#LHCodeBox').show()
            $('#LHImportCollectionCode').text('Download Collection')
            $('#LHCollectionImportModal').modal();


            window.history.pushState("object or string", "Title", window.location.pathname );


            break
        }

    })

    $('#LHGenerateShareCollectionLink').click(function() {
        var spinner = $(<i style="width:100%; margin-top:12px; margin-left:auto; margin-right:auto; margin-bottom:12px" class="fa fa-refresh fa-spin fa-3x fa-fw"></i>)
        $('#LHGenerateShareCollectionCodeBox').css('display','table');
        $('#LHGenerateShareCollectionCode').css('display','none')
        $('#LHGenerateShareCollectionCodeBox').find('div').append(spinner)


        $.ajax({
            type: 'POST',
            url: "https://tdykes.com/lighthouse/collection.php",
            data: {
                function: 'set',
                LighthouseFunction: 'CollectionLoadCollection',
                source: location.hostname,
                object: JSON.stringify(SharedCollection)
            },
            cache: false,
            dataType: 'json',
            complete: function(response, textStatus) {
                console.log(response)
                if (response.responseJSON.result == 'OK')
                {

                    $('#LHGenerateShareCollectionCodeURLBox').css('display','table');
                    $('#LHGenerateShareCollectionCode').css('display','')
                    $('#LHGenerateShareCollectionCodeURL').css('display','')

                    spinner.remove()
                    $('#LHGenerateShareCollectionCode').text(response.responseJSON.code)
                    $('#LHGenerateShareCollectionCodeURL').text(window.location.href+"?importcollection="+response.responseJSON.code)

                }
            }
        })
})

$('#LHImportCollectionCode').click(function() {
    if ($('#LHImportCollectionCode').text() == "Download Collection")
    {
        var code = $('#LHCodeBox').val()

        var spinner = $(<i style="width:100%; margin-top:4px; margin-left:auto; margin-right:auto" class="fa fa-refresh fa-spin fa-2x fa-fw"></i>)

        $('#LHImportCollectionErrorText').text('')
        $('#LHImportCollectionErrorText').show()
        $('#LHImportCollectionErrorText').append(spinner)


        console.log(code)
        $.ajax({
            type: 'POST',
            url: "https://tdykes.com/lighthouse/collection.php",
            data: {
                function: 'get',
                LighthouseFunction: 'CollectionLoadCollection',
                source: location.hostname,
                code: code
            },
            cache: false,
            dataType: 'json',
            complete: function(response, textStatus) {
                console.log(response)
                spinner.remove()
                if (response.responseJSON.result == 'OK')
                {
                    var object = JSON.parse(JSON.parse(response.responseJSON.object))
                    DownloadedObject = object
                    //$('#LHCodeBox').val(object.name)
                    $('#LHCodeBox').hide()
                    $('#LHImportCollectionErrorText').hide()
                    var button = make_collection_button(object.name, object.description, object.items.length + "")
                    $(button).css('margin-top','15px')
                    $(button).css('margin-bottom','25px')
                    $(button).find('span.delbutton').hide()
                    $(button).find('span.sharebutton').hide()
                    $('#LGCollectionImportGroup').append(button)
                    $('#LHImportCollectionCode').text('Accept & Save')
                    console.log(DownloadedObject)

                    //$('#LHGenerateShareCollectionCodeBox').css('display','table');
                    //$('#LHGenerateShareCollectionCode').text(response.responseJSON.code)
                } else if (response.responseJSON.result == 'NOTFOUND') {
                    $('#LHImportCollectionErrorText').show()
                    $('#LHImportCollectionErrorText').text('Code not found')
                    console.log(response.responseJSON.result)
                } else if (response.responseJSON.result == 'MISSMATCH') {
                    $('#LHImportCollectionErrorText').show()
                    $('#LHImportCollectionErrorText').text('Requested collection is not for '+location.hostname+' it is for '+response.responseJSON.source) 
                }
            }
        })
} else if ($('#LHImportCollectionCode').text() == "Accept & Save") {
    $('#LHCollectionImportModal').modal('hide');
    console.log(DownloadedObject)
    window.postMessage({ type: 'SAVE_COLLECTION', newdata:JSON.stringify(DownloadedObject), name: 'lighthouseMessageCollections'}, '*');
}

})

$('#LHGenerateShareCollectionCode').click(function(e) {
  //  
  copyToClipboard($('#LHGenerateShareCollectionCode').text())
  $('#clicktocopy').text('Copied to clipboard')
  e.stopPropagation();
})

$('#LHGenerateShareCollectionCodeURL').click(function(e) {
  //  
  copyToClipboard($('#LHGenerateShareCollectionCodeURL').text())
  $('#clicktocopyURL').text('Copied to clipboard')
  e.stopPropagation();
})

$('#LHCodeBox').keypress(function(e){
  if(e.keyCode==13)
      $('#LHImportCollectionCode').click();
});


$('#LHCollectionImport').click(function() {
    $('#LHImportCollectionErrorText').hide()
    DownloadedObject = {}
    $('#LHCodeBox').val('')
    $('#LGCollectionImportGroup').find('span').remove()
    $('#LHCodeBox').show()
    $('#LHImportCollectionCode').text('Download Collection')
    $('#LHCollectionImportModal').modal();
})

if (localStorage.getItem("LighthouseMessagesEnabled") == "true" || localStorage.getItem("LighthouseMessagesEnabled") == null) {
    whenWeAreReady(msgsystem, function() {

        msgsystem.selectedHeadquarters.subscribe(function(status) {
            if (status !== null) {
                LoadTeams()
                LoadNitc()

            } else {
                $('#HQTeamsSet').hide()
                $('#HQNitcSet').hide()

            }
        });

            //Home HQ - with a wait to catch possible race condition where the page is still loading
            whenWeAreReady(user, function() {
                var waiting = setInterval(function() {
                    if (msgsystem.loadingContacts.peek() === false && typeof user.hq != "undefined") { //check if the core js is still searching for something
                        clearInterval(waiting); //stop timer
                        console.log("Setting Selected HQ to user HQ");
                        msgsystem.setSelectedHeadquarters(user.hq);
                        $('#contact').val(user.hq.Name)
                    } else {
                        console.log("messages is still loading")
                    }
                }, 200);
            });

        });
        //auto select ones that have the world default in them
        msgsystem.loadingContacts.subscribe(function(status) {
            if (status == false) {
                msgsystem.availableContactGroups.peek().forEach(function(item) {
                    if (item.Name.indexOf("(default)") > -1) {
                        msgsystem.addContactGroup(item);
                    }
                })

                msgsystem.availableContacts.peek().forEach(function(item) {
                    if (item.Description.indexOf("(default)") > -1) {
                        msgsystem.addContact(item);
                    }
                })

            }
        })

    } else {
        console.log("Not running due to preference setting")
    }

    //Operational = true
    msgsystem.operational(true);

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

    $("#collectionsave").click(function() {
        if (msgsystem.selectedRecipients.peek().length > 0) {
            var SaveName = prompt("Please enter a name for the collection. If the name already exists it will be overwritten.", "");
            if (SaveName !== null && SaveName != "") {


                var theSelected = msgsystem.selectedRecipients.peek();
                var theCollection = [];
                var CollectionParent = {};
                theSelected.forEach(function(item) {
                    var thisItem = {};
                    if (item.Contact === null) {
                        thisItem.type = "group";
                        thisItem.OwnerId = item.ContactGroup.Entity.Id;
                        thisItem.Id = item.ContactGroup.Id;

                    } else if (item.ContactGroup === null) {
                        if (item.Contact.PersonId === null) {
                            thisItem.type = "entity";
                            thisItem.OwnerId = item.Contact.EntityId;
                            thisItem.Id = item.Contact.Id;
                        } else {
                            thisItem.type = "person";
                            thisItem.OwnerId = item.Contact.PersonId;
                            thisItem.Id = item.Contact.Id;
                        }
                    }

                    theCollection.push(thisItem);
                });
                //Collection Save code
                CollectionParent.name = SaveName;
                CollectionParent.description = SaveName;
                CollectionParent.items = theCollection;

                window.postMessage({ type: 'SAVE_COLLECTION', newdata:JSON.stringify(CollectionParent), name: 'lighthouseMessageCollections'}, '*');


            }
        }
    })


    //Load all the Collections on page load

    LoadAllCollections();

    DoTour()



});

function LoadNitc() {

    FetchNITC(5)

    function FetchNITC(size) {

        $('#nitcFooter').remove() // remove the footer if exists

         $('#lighthousenitc').empty() //empty to prevent dupes

         var spinner = $(<i style="width:100%; margin-top:4px; margin-left:auto; margin-right:auto" class="fa fa-refresh fa-spin fa-2x fa-fw"></i>)

         spinner.appendTo($('#lighthousenitc'));
         $('#nitchq').text("NITC Events (with Participants) at " + msgsystem.selectedHeadquarters.peek().Name + " (±30 Days)")
         $('#HQNitcSet').show()

         ReturnNitcAtLHQ(msgsystem.selectedHeadquarters.peek(),size,function(response) {
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
                                        LighthouseFunction: 'LoadPerson'
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
                                                        BuildNew.Recipient = v.Detail;
                                                        msgsystem.selectedRecipients.push(BuildNew)
                                                        console.log(total)
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
    $('#teamshq').text("Active Teams (with Members) at " + msgsystem.selectedHeadquarters.peek().Name)
    $('#HQTeamsSet').show()
    ReturnTeamsActiveAtLHQ(msgsystem.selectedHeadquarters.peek(), null, function(response) {
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
                                    LighthouseFunction: 'LoadPerson'
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
                                                    BuildNew.Recipient = v.Detail;
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


function LoadAllCollections() {

  window.addEventListener("message", function(event) {
    // We only accept messages from content scrip
    if (event.source !== window)
      return;
  if (event.data.type) {
      if (event.data.type === "RETURN_COLLECTION" && event.data.name == "lighthouseMessageCollections") {
        try {
          var items = JSON.parse(event.data.dataresult)
      } catch (e)
      {
          var items = []
      }
      ProcessData(items)
  }
}
})
  window.postMessage({ type: 'FETCH_COLLECTION',name: 'lighthouseMessageCollections' }, '*');

  //Quick little code to move local storage to chrome storage
  currentCollections = JSON.parse(localStorage.getItem("lighthouseContactCollections"));
  if (currentCollections !== null) {
    $.each(currentCollections, function(k, v) {
        console.log('pushing local to sync storage')
        console.log(v)
        window.postMessage({ type: 'SAVE_COLLECTION', newdata:JSON.stringify(v), name: 'lighthouseMessageCollections'}, '*');

    })
    console.log('removing localstorage')
    localStorage.removeItem("lighthouseContactCollections")
}

  function ProcessData(theLoadedCollection) { //Load the saved Collections
    $("#lighthousecollections").empty();

    //Load the saved Collections

    if (theLoadedCollection) {

        $("#collectionscount").text(theLoadedCollection.length);
        theLoadedCollection.forEach(function(item) {

            var button = make_collection_button(item.name, item.description, item.items.length + "")
            var spinner = $(<i style="margin-top:4px" class="fa fa-refresh fa-spin fa-2x fa-fw"></i>)

            //click fuction for a collection box
            $(button).click(function() {
                $(button).children().css('display','none')

                spinner.appendTo(button);
                console.log("loading collection")
                LoadCollection(item, function() {
                    console.log("collection load complete")
                    spinner.remove();
                    //cb for when they are loaded
                    $(button).children().css('display','')
                });
            })
            $(button).find('span.delbutton').click(function() {
                event.stopImmediatePropagation();
                var r = confirm("Are you sure you want to delete this collection?");
                if (r == true) {
                    DeleteCollection(item);
                }
            })
            $(button).find('span.sharebutton').click(function() {
                event.stopImmediatePropagation();
                SharedCollection = item
                $('#clicktocopy').text('Click to copy to clipboard')
                $('#clicktocopyURL').text('Click to copy to clipboard')
                $('#LHGenerateShareCollectionCodeBox').css('display','none')
                $('#LHGenerateShareCollectionCodeURLBox').css('display','none')
                $('#LHGenerateShareCollectionCode').text('')

                $('#LHGenerateShareCollectionCodeURL').text('')
                $('#LHCollectionShareModal').modal()
            })
            $(button).appendTo('#lighthousecollections');
            console.log()
            button.style.width = (($(button).find('span.sharebutton')[0].offsetWidth)+($(button).find('span.delbutton')[0].offsetWidth)+button.offsetWidth) + "px"; //add the width of the X button to the width, to avoid overlap
            button.style.height = button.offsetHeight + "px";
        });
}
}
}

function DeleteCollection(col) {
    window.postMessage({ type: 'DELETE_COLLECTION', target:JSON.stringify(col), name:'lighthouseMessageCollections'}, '*');

    LoadAllCollections();

}

function LoadCollection(col, cb) {
    $total = col.items.length;
    msgsystem.selectedRecipients.removeAll();
    col.items.forEach(function(itm) {
        switch (itm.type) {
            case "group":
            var groupOwner;
            $.ajax({
                type: 'GET',
                url: urls.Base+'/Api/v1/Entities/' + itm.OwnerId,
                beforeSend: function(n) {
                    n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
                },
                data: {
                    LighthouseFunction: 'CollectionLoadCollection'
                },
                cache: false,
                dataType: 'json',
                complete: function(response, textStatus) {
                    switch (textStatus) {
                        case 'success':
                        groupOwner = response.responseJSON.Name;
                        $.ajax({
                            type: 'GET',
                            url: urls.Base+'/Api/v1/ContactGroups/headquarters/' + itm.OwnerId,
                            beforeSend: function(n) {
                                n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
                            },
                            data: {
                                LighthouseFunction: 'CollectionLoadHQ'
                            },
                            cache: false,
                            dataType: 'json',
                            complete: function(response, textStatus) {
                                if (textStatus == 'success') {
                                    if (response.responseJSON.Results.length) {
                                        $.each(response.responseJSON.Results, function(k, v) {
                                            if (v.Id == itm.Id) {

                                                BuildNew = {};
                                                BuildNew.Contact = null;
                                                BuildNew.ContactGroup = v
                                                BuildNew.ContactTypeId = null;
                                                BuildNew.Description = groupOwner;
                                                BuildNew.Recipient = v.Name;
                                                msgsystem.selectedRecipients.push(BuildNew)

                                                $total = $total - 1;
                                                if ($total == 0) {
                                                    cb();
                                                }
                                            }
                                        })
                                    }
                                } else { //fail safe
                                  $total = $total - 1;
                                  if ($total == 0) {
                                    cb();
                                }  
                            }
                        }
                    })
break;
}
}
})
break;
case "person":
$.ajax({
    type: 'GET',
    url: urls.Base+'/Api/v1/People/' + itm.OwnerId + '/Contacts',
    beforeSend: function(n) {
        n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
    },
    data: {
        LighthouseFunction: 'LoadPerson'
    },
    cache: false,
    dataType: 'json',
    complete: function(response, textStatus) {
        if (textStatus == 'success') {
            if (response.responseJSON.Results.length) {
                $.each(response.responseJSON.Results, function(k, v) {
                    if (v.Id == itm.Id) {
                        BuildNew = {};
                        BuildNew.Contact = v;
                        BuildNew.ContactGroup = null;
                        BuildNew.ContactTypeId = v.ContactTypeId;
                        BuildNew.Description = v.FirstName + " " + v.LastName + " (" + v.Description + ")";
                        BuildNew.Recipient = v.Detail;
                        msgsystem.selectedRecipients.push(BuildNew)


                        $total = $total - 1;
                        if ($total == 0) {
                            cb();
                        }

                    }
                })
            }
        } else { //fail safe
          $total = $total - 1;
          if ($total == 0) {
            cb();
        }  
    }
}
})
break;
case "entity":
$.ajax({
    type: 'GET',
    url: urls.Base+'/Api/v1/Contacts/Search',
    beforeSend: function(n) {
        n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
    },
    cache: false,
    dataType: 'json',
    data: {
        'PageIndex': 1,
        'PageSize': 1000,
        'HeadquarterIds[]': itm.OwnerId,
        'SortField': "createdon",
        'SortOrder': "asc",
        'LighthouseFunction': 'CollectionLoadEntity'
    },
    complete: function(response, textStatus) {
        if (textStatus == 'success') {
            if (response.responseJSON.Results.length) {
                $.each(response.responseJSON.Results, function(k, v) {
                    if (v.Id == itm.Id) {
                        BuildNew = {};
                        BuildNew.Contact = v;
                        BuildNew.ContactTypeId = v.ContactTypeId;
                        BuildNew.ContactGroup = null;
                        BuildNew.Description = v.EntityName + " (" + v.Description + ")";
                        BuildNew.Recipient = v.Detail;
                        msgsystem.selectedRecipients.push(BuildNew)

                        $total = $total - 1;
                        if ($total == 0) {
                            cb();
                        }

                    }
                })
            }
        } else { //fail safe
          $total = $total - 1;
          if ($total == 0) {
            cb();
        }  
    }
}
})
break;

default: //something bad. we should never end up here
$total = $total - 1;
if ($total == 0) {
    cb();
}

break;
}
})
}

function make_collection_button(name, description, count) {
    return (
        <span class="label label tag-rebecca">
        <span class="sharebutton"  style="float:left;margin-left: -6px;margin-top:-4px"><i class="fa fa-share fa1"></i></span>
        <span class="delbutton"  style="float:right;margin-right: -6px;margin-top:-4px"><i class="fa fa-times"></i></span>
        <span><p  style="margin-bottom:5px"><i class="fa fa-object-group" aria-hidden="true" style="padding-right: 5px;"></i>{name}</p></span>
        <span>{count} Recipients</span>
        </span>
        )
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

function make_collection_share_modal() {
    return (
        <div id="LHCollectionShareModal" class="modal fade" role="dialog">
        <div class="modal-dialog">

        <div class="modal-content">
        <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal">&times;</button>
        <h4 class="modal-title">Lighthouse Share Recipient Collection</h4>
        </div>
        <div class="modal-body">
        <h4>Generate a share code to quickly share this collection with others.</h4>
        <p/>
        <p>By Sharing this collection you will allow anyone with the share code to load and use a copy of this collection.</p>
        <p>The generated code will be valid for 24 hours and can be used as many times as needed. If you make further changes to the Collection after sharing you will need to re-share the collection.</p>
        <button type="button" class="btn btn-success" id="LHGenerateShareCollectionLink">Generate Code</button>
        <div id='LHGenerateShareCollectionCodeBox' style="display: none;margin:auto;">
        <div style="margin-top:20px;border-style: dashed;border-width: 2px;">
        <p style="font-family: 'Courier New';text-align: center;font-size: -webkit-xxx-large;margin: 15px 15px;" id="LHGenerateShareCollectionCode"></p>
        </div>
        <p id="clicktocopy" style="text-align: center;">Click to copy to clipboard</p>
        </div>
        <div id='LHGenerateShareCollectionCodeURLBox' style="display: none;margin:auto;">
        <div style="margin-top:20px;border-style: dashed;border-width: 2px;">
        <p style="font-family: 'Courier New';text-align: center;font-size: small;margin: 15px 15px;" id="LHGenerateShareCollectionCodeURL"></p>
        </div>
        <p id="clicktocopyURL" style="text-align: center;">Click to copy to clipboard</p>
        </div>
        </div>
        <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
        </div>
        </div>
        </div>
        </div>
        )
}

function make_collection_import_modal() {
    return (
        <div id="LHCollectionImportModal" class="modal fade" role="dialog">
        <div class="modal-dialog modal-sm">
        <div class="modal-content">
        <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal">&times;</button>
        <h4 class="modal-title">Lighthouse Import Recipient Collection</h4>
        </div>
        <div class="modal-body">
        <h4>Import a shared collection.</h4>
        <p/>
        <p>Input the share code to download a copy of a shared collection and save it into your own collections.</p>
        <div class='row' style="margin-top:20px">
        <div class="col-lg-3 center-block" style="width:100%">
        <div class="input-group" style="width:50%; margin: 0 auto">
        <div  id="LGCollectionImportGroup" style="display:flex;justify-content: center">
        <input type="text" maxlength="4" class="form-control" id="LHCodeBox" style="text-transform:uppercase;text-align:center;font-size: -webkit-xxx-large;height: 80px;margin-bottom:10px"/>
        </div>
        <p id="LHImportCollectionErrorText" style="text-align:center;display:hidden;color:red"></p>
        <button id="LHImportCollectionCode" style="margin: 0 auto;display:block" class="btn btn-primary" type="button">Download Collection</button>
        </div>
        </div>
        </div>
        <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
        </div>
        </div>
        </div>
        </div>
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

function DoTour() {
    require('bootstrap-tour')


    // Instance the tour
    var tour = new Tour({
        name: "LHTourMessages",
        smartPlacement: true,
        placement: "right",
        debug: false,
        steps: [{
            element: "",
            placement: "top",
            orphan: true,
            backdrop: true,
            title: "Lighthouse Welcome",
            content: "Lighthouse has made some changes to this page. would you like a tour?"
        },
        {
            element: "#lighthouseEnabled",
            title: "Lighthouse Load",
            placement: "bottom",
            backdrop: false,
            content: "Lighthouse can prefill the Available Contacts from you unit. Ticking this box enables this behavour. It will also select 'Operational' - 'Yes' by default",
        },
        {
            element: "#lighthouseteams",
            title: "Active Teams",
            placement: "auto",
            backdrop: false,
            onShown: function(tour) {
                $('#HQTeamsSet').show();
            },
            content: "All active teams at the selected HQ will be shown here. Click the team to SMS the members. Team leader of the clicked team will have (TL) in his name in the Selected Receipients box.",
        },
        {
            element: "#lighthousenitc",
            title: "NITC Events",
            placement: "auto",
            backdrop: false,
            onShown: function(tour) {
                $('#HQNitcSet').show();
            },
            content: "NITC attached to the selected HQ will be shown here. Click the event to SMS the participants.",
        },
        {
            element: "#lighthousecollections",
            title: "Lighthouse Collections",
            placement: "top",
            backdrop: false,
            content: "Lighthouse Collections allow you to save a group of message recipients for quick selection later. Collections can contain any combination of recipients (including groups from different units or regions) and are synced between chrome profiles.",
        },
        {
            element: "#collectionsave",
            title: "Lighthouse Collections - Save",
            placement: "top",
            backdrop: false,
            onNext: function(tour) {
                button = make_collection_button("Example", "Tour Example", "13")
                $(button).appendTo('#lighthousecollections');
                button.style.width = (($(button).find('span.sharebutton')[0].offsetWidth)+($(button).find('span.delbutton')[0].offsetWidth)+button.offsetWidth) + "px"; //add the width of the X button to the width, to avoid overlap
                button.style.height = button.offsetHeight + "px";
                $(button).attr("id", "tourbutton")
                $(button).find('span.sharebutton').attr("id", "sharebutton")
                $(button).find('span.delbutton').attr("id", "delbutton")
                
            },
            content: "Once you have selected some message recipients click 'Save Current As Collection' to save them for later. using a name that already exists will replace the old collection.",
        },
        {
            element: "#tourbutton",
            title: "Lighthouse Collections - Load",
            placement: "top",
            backdrop: false,
            content: "This is a saved collection. Click it to load its contents into 'Selected Recipients'",
        },
        {
            element: "#sharebutton",
            title: "Lighthouse Collections - Share",
            placement: "top",
            backdrop: false,
            content: "Click share icon to share the collection with other lighthouse users",
        },
        {
            element: "#delbutton",
            title: "Lighthouse Collections - Delete",
            placement: "top",
            backdrop: false,
            onNext: function(tour) {
                LoadAllCollections();
                $('#tourbutton').remove()

            },
            content: "Click the 'X' to delete this collection",
        },
        {
            element: "",
            placement: "top",
            orphan: true,
            backdrop: true,
            title: "Questions?",
            content: "If you have any questions please seek help from the 'About Lighthout' button under the lighthouse menu on the top menu"
        }
        ]
    })

    /// Initialize the tour
    tour.init();

    // Start the tour
    tour.start();
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
