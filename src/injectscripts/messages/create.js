var DOM = require('jsx-dom-factory');


console.log("inject running");

$(document).ready(function() {

    if (localStorage.getItem("LighthouseMessagesEnabled") == "true" || localStorage.getItem("LighthouseMessagesEnabled") == null) {

        whenWeAreReady(msgsystem, function() {

            //Home HQ - with a wait to catch possible race condition where the page is still loading
            whenWeAreReady(user, function() {
                var waiting = setInterval(function() {
                    if (msgsystem.loadingContacts.peek() == false) { //check if the core js is still searching for something
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
        if (localStorage.getItem("LighthouseMessagesEnabled") == "true" || localStorage.getItem("LighthouseMessagesEnabled") == null) //its true so uncheck it
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

    document.getElementById("collectionsave").onclick = function() {
        theSelected = msgsystem.selectedRecipients.peek();
        theCollection = [];
        CollectionParent = {};
        theSelected.forEach(function(item) {
            thisItem = {};
            if (item.Contact == null)
            {
                console.log(item.Recipient+" Is a group");
                thisItem.type = "group";
                thisItem.OwnerId = item.ContactGroup.Entity.Id;
                thisItem.Id = item.ContactGroup.Id;

            } else if (item.ContactGroup == null)
            {
                if (item.Contact.PersonId == null)
                {
                    console.log(item.Recipient+" Is a contact for a entity");
                    thisItem.type = "entity";
                    thisItem.OwnerId = item.Contact.EntityId;
                    thisItem.Id = item.Contact.Id;
                } else
                {
                    console.log(item.Recipient+" Is a contact for a person");
                    thisItem.type = "person";
                    thisItem.OwnerId = item.Contact.PersonId;
                    thisItem.Id = item.Contact.Id;
                }
            }
            theCollection.push(thisItem);
        });
var SaveName = prompt("Please enter a name for the collection", "");
if (SaveName == null) {
    SaveName = "lighthouse collection";
}
CollectionParent.name = SaveName;
CollectionParent.description = SaveName;
CollectionParent.items = theCollection;
console.log(CollectionParent);
currentCollections = JSON.parse(localStorage.getItem("lighthouseContactCollections"));
if (currentCollections == null)
{
    currentCollections = []
}
currentCollections.push(CollectionParent);
console.log(currentCollections);
localStorage.setItem("lighthouseContactCollections", JSON.stringify(currentCollections));
LoadAllCollections();

//console.log(theCollection);
}

LoadAllCollections();


});

function LoadAllCollections() {

    var myNode = document.getElementById("lighthousecollections");
        //Load the saved Collections
        theLoadedCollection = JSON.parse(localStorage.getItem("lighthouseContactCollections"));
        console.log(theLoadedCollection);
        if (theLoadedCollection) {
            document.getElementById("collectionscount").textContent = theLoadedCollection.length;
            theLoadedCollection.forEach(function(item) {

                var $button = make_collection_button(item.name,item.description)
                $($button).click(function() {
                    LoadCollection(item);
                })
                $($button).appendTo('#lighthousecollections');
            });
        }
    }

    function LoadCollection(col,cb) {


        console.log(col);
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
                        console.log(response);
                        switch(textStatus){
                            case 'success':
                            groupOwner = response.responseJSON.Name;
                            break;
                        }
                    }
                })
                $.ajax({
                    type: 'GET'
                    , url: '/Api/v1/ContactGroups/headquarters/'+itm.OwnerId
                    , cache: false
                    , dataType: 'json'
                    , complete: function(response, textStatus) {
                        switch(textStatus){
                            case 'success':
                            if(response.responseJSON.Results.length) {
                                $.each(response.responseJSON.Results, function(k, v) { 
                                    if (v.Id == itm.Id)
                                    {
                                        BuildNew = {};
                                        BuildNew.ContactGroup = v;
                                        BuildNew.Description = groupOwner;
                                        BuildNew.Recipient = v.Name;
                                        msgsystem.selectedRecipients.push(BuildNew)

                                    }
                                })
                            }
                            break;
                        }
                    }})
break;
case "person":
$.ajax({
    type: 'GET'
    , url: '/Api/v1/People/'+itm.OwnerId+'/Contacts'
    , cache: false
    , dataType: 'json'
    , complete: function(response, textStatus) {
        switch(textStatus){
            case 'success':
            if(response.responseJSON.Results.length) {
                console.log(response.responseJSON.Results);
                $.each(response.responseJSON.Results, function(k, v) { 
                    if (v.Id == itm.Id)
                    {
                        BuildNew = {};
                        BuildNew.Contact = v;
                        BuildNew.Description = v.FirstName+" "+v.LastName+ " ("+v.Description+")";
                        BuildNew.Recipient = v.Detail;
                        msgsystem.selectedRecipients.push(BuildNew)

                    }
                })
            }
            break;
        }
    }})
break;
case "entity":
$.ajax({
    type: 'GET'
    , url: '/Api/v1/Entities/'+itm.OwnerId+'/Contacts'
    , cache: false
    , dataType: 'json'
    , complete: function(response, textStatus) {
        switch(textStatus){
            case 'success':
            if(response.responseJSON.Results.length) {
                console.log(response.responseJSON.Results);
                $.each(response.responseJSON.Results, function(k, v) { 
                    if (v.Id == itm.Id)
                    {
                        BuildNew = {};
                        BuildNew.Contact = v;
                        BuildNew.Description = v.EntityName+ " ("+v.Description+")";
                        BuildNew.Recipient = v.Detail;
                        msgsystem.selectedRecipients.push(BuildNew)

                    }
                })
            }
            break;
        }
    }})
break;
}
})
}

function make_collection_button(name, description) {
    return (
        <span class="label label tag">
        <span>{description}</span>
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


