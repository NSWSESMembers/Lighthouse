console.log("inject running");


if (localStorage.getItem("LighthouseMessagesEnabled") == "true") {

	whenWeAreReady(msgsystem,function() {

	//Home HQ
	whenWeAreReady(user,function() {
		console.log("Setting Selected HQ to user HQ");
		msgsystem.setSelectedHeadquarters(user.hq);
	});

	//Operational = true
	msgsystem.operational(true);

});

function whenWeAreReady(varToCheck,cb) { //when external vars have loaded
	var waiting = setInterval(function() {
		if (typeof varToCheck != "undefined") {
			console.log("We are ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
  }
}, 200);
}


msgsystem.loadingContacts.subscribe(function(status) {
	if (status == false)
	{
		msgsystem.availableContactGroups.peek().forEach(function(item){
			if (item.Name.indexOf("(default)") > -1){
				msgsystem.addContactGroup(item);
			}
		})

		msgsystem.availableContacts.peek().forEach(function(item){
			if (item.Description.indexOf("(default)") > -1){
				msgsystem.addContact(item);
			}
		})

	}
})

}

$(document).ready(function() {
	$('#lighthouseEnabled').click(function() {
	if (localStorage.getItem("LighthouseMessagesEnabled") == "true") //its true so uncheck it
	{
		$(this).toggleClass("fa-check-square-o fa-square-o")
		localStorage.setItem("LighthouseMessagesEnabled", false);

	} else //its false so uncheck it
	{
		$(this).toggleClass("fa-square-o fa-check-square-o")
		localStorage.setItem("LighthouseMessagesEnabled", true);


	}
});
});




