var DOM = require('jsx-dom-factory');


console.log("inject running");

$(document).ready(function() {

    if (localStorage.getItem("LighthouseMessagesEnabled") == "true" || localStorage.getItem("LighthouseMessagesEnabled") == null) {

        whenWeAreReady(msgsystem, function() {

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
        if (msgsystem.selectedRecipients.peek().length > 0)
        {
            var SaveName = prompt("Please enter a name for the collection", "");
            if (SaveName !== null) {


                theSelected = msgsystem.selectedRecipients.peek();
                theCollection = [];
                CollectionParent = {};
                theSelected.forEach(function(item) {
                    thisItem = {};
                    if (item.Contact === null)
                    {
                        thisItem.type = "group";
                        thisItem.OwnerId = item.ContactGroup.Entity.Id;
                        thisItem.Id = item.ContactGroup.Id;

                    } else if (item.ContactGroup === null)
                    {
                        if (item.Contact.PersonId === null)
                        {
                            thisItem.type = "entity";
                            thisItem.OwnerId = item.Contact.EntityId;
                            thisItem.Id = item.Contact.Id;
                        } else
                        {
                            thisItem.type = "person";
                            thisItem.OwnerId = item.Contact.PersonId;
                            thisItem.Id = item.Contact.Id;
                        }
                    }
                    theCollection.push(thisItem);
                });

                //Collection Save Stuff
                CollectionParent.name = SaveName;
                CollectionParent.description = SaveName;
                CollectionParent.items = theCollection;
                console.log(CollectionParent);
                currentCollections = JSON.parse(localStorage.getItem("lighthouseContactCollections"));
                if (currentCollections === null)
                {
                    currentCollections = [];
                }
                currentCollections.push(CollectionParent);
                localStorage.setItem("lighthouseContactCollections", JSON.stringify(currentCollections));
                LoadAllCollections();
            }
            
            //console.log(theCollection);
            
        }
    })


//Load all the Collections on page load

LoadAllCollections();


});

function LoadAllCollections() {

    $("#lighthousecollections").empty();

        //Load the saved Collections
        theLoadedCollection = JSON.parse(localStorage.getItem("lighthouseContactCollections"));
        console.log(theLoadedCollection);
        if (theLoadedCollection) {
            $("#collectionscount").textContent = theLoadedCollection.length;
            theLoadedCollection.forEach(function(item) {
                var $button = make_collection_button(item.name,item.description,item.items.length+"")
                var $spinner = (<i style="margin-top:4px" class="fa fa-refresh fa-spin fa-2x fa-fw"></i>)

                $($button).click(function() {
                    var nodes = $button.childNodes;
                    for(i=0; i<nodes.length; i++) {
                        nodes[i].style.display="none";
                    }
                    $($spinner).appendTo($button);
                    LoadCollection(item, function() {
                        console.log("collection load complete")
                        $button.removeChild($spinner);
                        //cb for when they are loaded
                        var nodes = $button.childNodes;
                        for(i=0; i<nodes.length; i++) {
                            nodes[i].removeAttribute("style");
                        }

                    });
                })
                $($button).find('span.delbutton').click(function() {
                    event.stopImmediatePropagation();
                    var r = confirm("Are you sure you want to delete this collection?");
                    if (r == true) {
                        DeleteCollection(item);
                    }
                })
                $($button).appendTo('#lighthousecollections');
                $button.style.width = $button.offsetWidth+"px";
                $button.style.height = $button.offsetHeight+"px";
            });
}
}

function DeleteCollection(col) {
    theLoadedCollection = JSON.parse(localStorage.getItem("lighthouseContactCollections"));
    theLoadedCollection.forEach(function(item)
    {
        if (JSON.stringify(col) == JSON.stringify(item))
        {
            console.log("This one")
            theLoadedCollection.splice(theLoadedCollection.indexOf(item),1)
        } else {
            console.log("NOT This one")

        }
    })
    localStorage.setItem("lighthouseContactCollections", JSON.stringify(theLoadedCollection));
    LoadAllCollections();

}

function LoadCollection(col,cb) {
    $total = col.items.length;
    msgsystem.selectedRecipients.destroyAll();
    col.items.forEach(function(itm) {
        switch (itm.type) {
            case "group":
            var groupOwner;
            $.ajax({
                type: 'GET'
                , url: '/Api/v1/Entities/'+itm.OwnerId
                , cache: false
                , dataType: 'json'
                , complete: function(response, textStatus) {
                    switch(textStatus){
                        case 'success':
                        groupOwner = response.responseJSON.Name;
                        $.ajax({
                            type: 'GET'
                            , url: '/Api/v1/ContactGroups/headquarters/'+itm.OwnerId
                            , cache: false
                            , dataType: 'json'
                            , complete: function(response, textStatus) {
                                if(textStatus == 'success')
                                {
                                    if(response.responseJSON.Results.length) {
                                        $.each(response.responseJSON.Results, function(k, v) { 
                                            if (v.Id == itm.Id)
                                            {
                                                build_recipient(v,groupOwner,v.Name)
                                                $total = $total - 1;
                                                if ($total == 0 )
                                                {
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
    type: 'GET'
    , url: '/Api/v1/People/'+itm.OwnerId+'/Contacts'
    , cache: false
    , dataType: 'json'
    , complete: function(response, textStatus) {
        if(textStatus == 'success')
        {
            if(response.responseJSON.Results.length) {
                $.each(response.responseJSON.Results, function(k, v) { 
                    if (v.Id == itm.Id)
                    {
                        build_recipient(v,v.FirstName+" "+v.LastName+ " ("+v.Description+")",v.Detail)
                        $total = $total - 1;
                        if ($total == 0 )
                        {
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
console.log("entity")
$.ajax({
    type: 'GET'
    , url: '/Api/v1/Entities/'+itm.OwnerId+'/Contacts'
    , cache: false
    , dataType: 'json'
    , complete: function(response, textStatus) {
        if(textStatus == 'success'){
            if(response.responseJSON.Results.length) {
                $.each(response.responseJSON.Results, function(k, v) { 
                    if (v.Id == itm.Id)
                    {
                        build_recipient(v,v.EntityName+ " ("+v.Description+")",v.Detail)
                        $total = $total - 1;
                        if ($total == 0 )
                        {
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

function build_recipient (contact,description,recipient) {
    BuildNew = {};
    BuildNew.Contact = contact;
    BuildNew.Description = description;
    BuildNew.Recipient = recipient;
    msgsystem.selectedRecipients.push(BuildNew)
}

function make_collection_button(name, description,count) {
    return (
        <span class="label label tag-rebecca">
        <span><p  style="margin-bottom:5px"><i class="fa fa-users" aria-hidden="true" style="padding-right: 5px;"></i>{description}<span class="delbutton"><sup style="margin-left: 10px;margin-right: -5px;">X</sup></span></p></span>
        <span>{count} recipients</span>
        </span>
        )
}

function whenWeAreReady(varToCheck,cb) { //when external vars have loaded
	var waiting = setInterval(function() {
		if (typeof varToCheck != "undefined") {
      clearInterval(waiting); //stop timer
      cb(); //call back
  }
}, 200);
}


