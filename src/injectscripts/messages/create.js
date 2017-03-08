var DOM = require('jsx-dom-factory');
var ReturnTeamsActiveAtLHQ = require('../../../lib/getteams.js');



console.log("inject running");

$(document).ready(function() {

    if (localStorage.getItem("LighthouseMessagesEnabled") == "true" || localStorage.getItem("LighthouseMessagesEnabled") == null) {
        whenWeAreReady(msgsystem, function() {

            msgsystem.selectedHeadquarters.subscribe(function(status) {
                console.log("Picked something")
                if (status !== null) {
                    LoadTeams()
                } else {
                    console.log("Not a HQ. Cleaning up")
                    $('#HQTeamsSet').hide()

                }
            });

            //Home HQ - with a wait to catch possible race condition where the page is still loading
            whenWeAreReady(user, function() {
                var waiting = setInterval(function() {
                    if (msgsystem.loadingContacts.peek() === false) { //check if the core js is still searching for something
                        clearInterval(waiting); //stop timer
                        console.log("Setting Selected HQ to user HQ");
                        msgsystem.setSelectedHeadquarters(user.hq);
                    } else {
                        console.log("still loading")
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
                        console.log("group")

                        thisItem.type = "group";
                        thisItem.OwnerId = item.ContactGroup.Entity.Id;
                        thisItem.Id = item.ContactGroup.Id;

                    } else if (item.ContactGroup === null) {
                        if (item.Contact.PersonId === null) {
                            console.log("entity")

                            thisItem.type = "entity";
                            thisItem.OwnerId = item.Contact.EntityId;
                            thisItem.Id = item.Contact.Id;
                        } else {
                            console.log("person")
                            thisItem.type = "person";
                            thisItem.OwnerId = item.Contact.PersonId;
                            thisItem.Id = item.Contact.Id;
                        }
                    }
                    console.log(thisItem)

                    theCollection.push(thisItem);
                });
                //Collection Save code
                CollectionParent.name = SaveName;
                CollectionParent.description = SaveName;
                CollectionParent.items = theCollection;
                currentCollections = JSON.parse(localStorage.getItem("lighthouseContactCollections"));
                if (currentCollections === null) {
                    currentCollections = [];
                }
                var newcurrentCollections = []
                $.each(currentCollections, function(k, v) {
                    if (v.name != CollectionParent.name) //catch the dupes
                    {
                        newcurrentCollections.push(v) //delete the duplicate
                    }
                })
                currentCollections = newcurrentCollections;
                currentCollections.push(CollectionParent);
                localStorage.setItem("lighthouseContactCollections", JSON.stringify(currentCollections));
                LoadAllCollections();
            }
        }
    })


    //Load all the Collections on page load

    LoadAllCollections();

    DoTour()



});


function LoadTeams() {
    $('#lighthouseteams').empty() //empty to prevent dupes

    var spinner = $(<i style="width:100%; margin-top:4px; margin-left:auto; margin-right:auto" class="fa fa-refresh fa-spin fa-2x fa-fw"></i>)

    spinner.appendTo($('#lighthouseteams'));
    $('#teamshq').text("Active Teams (With Members) At " + msgsystem.selectedHeadquarters.peek().Name)
    $('#HQTeamsSet').show()
    ReturnTeamsActiveAtLHQ(msgsystem.selectedHeadquarters.peek(), null, function(response) {
        console.log(response);
        $('#teamscount').text(response.responseJSON.Results.length)
        if (response.responseJSON.Results.length) {
            $('#lighthouseteams').empty() //empty to prevent dupes

            $.each(response.responseJSON.Results, function(k, v) {
                if (v.Members.length > 0) //only show teams with members
                {
                    var TL = ""
                    $.each(v.Members, function(kk, vv) {
                        if (vv.TeamLeader == true) {
                            TL = vv.Person.FirstName + " " + vv.Person.LastName
                        }
                    })
                    //length + "" to make it a string
                    var button = make_team_button(v.Callsign, TL, v.Members.length + "")
                    $(button).click(function() {
                        var spinner = $(<i style="margin-top:4px" class="fa fa-refresh fa-spin fa-2x fa-fw"></i>)

                        $(button).children().css('display','none')
                        spinner.appendTo(button);
                        console.log("clicked " + v.Callsign)
                        $.each(v.Members, function(kk, vv) {
                            $.ajax({
                                type: 'GET',
                                url: '/Api/v1/People/' + vv.Person.Id + '/Contacts',
                                data: {
                                    LighthouseFunction: 'LoadPerson'
                                },
                                cache: false,
                                dataType: 'json',
                                complete: function(response, textStatus) {
                                    if (textStatus == 'success') {
                                        console.log(response.responseJSON)
                                        if (response.responseJSON.Results.length) {
                                            $.each(response.responseJSON.Results, function(k, v) {
                                                if (v.ContactTypeId == 2) {
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
                                                }
                                            })
}
}
spinner.remove();
                                    //cb for when they are loaded
                                    $(button).children().css('display','')
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
    });
}


function LoadAllCollections() {

    $("#lighthousecollections").empty();

    //Load the saved Collections
    theLoadedCollection = JSON.parse(localStorage.getItem("lighthouseContactCollections"));
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
            $(button).appendTo('#lighthousecollections');
            button.style.width = button.offsetWidth + "px";
            button.style.height = button.offsetHeight + "px";
        });
}
}

function DeleteCollection(col) {
    theLoadedCollection = JSON.parse(localStorage.getItem("lighthouseContactCollections"));
    theLoadedCollection.forEach(function(item) {
        if (JSON.stringify(col) == JSON.stringify(item)) {
            console.log("This one")
            theLoadedCollection.splice(theLoadedCollection.indexOf(item), 1)
        } else {
            console.log("NOT This one")

        }
    })
    localStorage.setItem("lighthouseContactCollections", JSON.stringify(theLoadedCollection));
    LoadAllCollections();

}

function LoadCollection(col, cb) {
    console.log(col)
    $total = col.items.length;
    msgsystem.selectedRecipients.removeAll();
    col.items.forEach(function(itm) {
        switch (itm.type) {
            case "group":
            var groupOwner;
            $.ajax({
                type: 'GET',
                url: '/Api/v1/Entities/' + itm.OwnerId,
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
                            url: '/Api/v1/ContactGroups/headquarters/' + itm.OwnerId,
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
    url: '/Api/v1/People/' + itm.OwnerId + '/Contacts',
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
        }
    }
})
break;
case "entity":
$.ajax({
    type: 'GET',
    url: '/Api/v1/Contacts/Search',
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
        }
    }
})
break;
}
})
}

function make_collection_button(name, description, count) {
    return (
        <span class="label label tag-rebecca">
        <span><p  style="margin-bottom:5px"><i class="fa fa-object-group" aria-hidden="true" style="padding-right: 5px;"></i>{description}<span class="delbutton"><sup style="margin-left: 10px;margin-right: -5px;">X</sup></span></p></span>
        <span>{count} recipients</span>
        </span>
        )
}

function make_team_button(name, TL, counts) {
    return (
        <span class="label label tag-darkgoldenrod">
        <span><p  style="margin-bottom:5px">{name}</p></span>
        <span><p>{TL}<sup>TL</sup></p>{counts} Members</span>
        </span>
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

function DoTour() {
    require('bootstrap-tour')


    // Instance the tour
    var tour = new Tour({
        name: "LHTourMessages",
        smartPlacement: true,
        placement: "right",
        debug: true,
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
            element: "#lighthousecollections",
            title: "Lighthouse Collections",
            placement: "top",
            backdrop: false,
            content: "Lighthouse Collections allow you to save a group of message recipients for quick selection later. Collections can contain any combination of recipients (including groups from different units or regions) and are saved locally on your computer.",
        },
        {
            element: "#collectionsave",
            title: "Lighthouse Collections - Save",
            placement: "top",
            backdrop: false,
            onNext: function(tour) {
                $button = make_collection_button("Tour Example", "Tour Example", "13")
                $($button).attr("id", "tourbutton")
                $($button).appendTo('#lighthousecollections');
            },
            content: "Once you have selected some message recipients click 'Save As Collection' to save them for later. using a name that already exists will replace the old collection.",
        },
        {
            element: "#tourbutton",
            title: "Lighthouse Collections - Load",
            placement: "top",
            backdrop: false,
            onNext: function(tour) {
                $('#lighthousecollections').empty();
            },
            content: "This is a saved collection. Click it to load its contents into 'Selected Recipients'",
        },
        {
            element: "#recipientsdel",
            title: "Lighthouse Delete",
            placement: "auto",
            backdrop: false,
            content: "We have added a button to remove all the selected message recipients",
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
