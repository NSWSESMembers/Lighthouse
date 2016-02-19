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
});

function whenWeAreReady(varToCheck,cb) { //when external vars have loaded
	var waiting = setInterval(function() {
		if (typeof varToCheck != "undefined") {
      clearInterval(waiting); //stop timer
      cb(); //call back
  }
}, 200);
}


