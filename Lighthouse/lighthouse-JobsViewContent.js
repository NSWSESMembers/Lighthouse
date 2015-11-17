console.log("Running content script");


//if ops logs update
masterViewModel.notesViewModel.opsLogEntries.subscribe(function(d) {

    cleanupBr();

});

//if messages update
masterViewModel.messagesViewModel.messages.subscribe(function(d) {

    cleanupBr();

});

//call on run
cleanupBr();


function cleanupBr() {

    //only run if messages and notes have loaded in (gets the shits overwise and wont load)
    if (masterViewModel.messagesViewModel.messages.peek().length !== 0 && masterViewModel.notesViewModel.opsLogEntries.peek().length !== 0) {

        var all = document.getElementById("editRfaForm").getElementsByTagName("*");


        for (var i = 0, max = all.length; i < max; i++) {

            //Do something with the element here
            all[i].innerHTML = (replaceAll(all[i].innerHTML, "&lt;br&gt;", "<br>"));
            //all[i].innerHTML = (replaceAll(all[i].innerHTML,"text: Text","html: Text"));

        }

        try //get rid of the loading image which some times gets suck. i assume a race condition it the cause
        {
            var progress = document.getElementById("editRfaForm").getElementsByClassName("col-xs-12 text-center");
            progress[0].parentNode.removeChild(progress[0]); //.style.visibility = 'hidden';
        } catch (err) {
            console.log(err.messages);

        }
    }


}


document.getElementById("FinaliseQuickTextBox").onchange = function() {
    console.log(this.value)

    var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");

    masterViewModel.finalisationText(this.value);

}


masterViewModel.completeTeamViewModel.primaryActivity.subscribe(function(newValue) {
    if (typeof newValue !== 'undefined') {
        if (newValue !== null) {

            console.log(newValue);

            switch (newValue.Name) {

                case "Storm":
                    removeOptions(document.getElementById("CompleteQuickTextBox"));
                    var quickText = ["", "No damage to property, scene safe. Resident to arrange for clean up.", "Tree removed and scene made safe.", "Roof repaired and scene made safe.", "Damage repaired and scene made safe.", "Job was referred to contractors who have completed the task.", "Council have removed the tree from the road, scene made safe.", "Branch/tree sectioned; resident/owner to organize removal"]
                    document.getElementById("CompleteQuickTextBox").removed
                    for (var i = 0; i < quickText.length; i++) {
                        var opt = document.createElement('option');
                        opt.text = quickText[i];
                        opt.value = quickText[i];
                        document.getElementById("CompleteQuickTextBox").add(opt);
                    }

                    break;

                case "Search":
                    removeOptions(document.getElementById("CompleteQuickTextBox"));
                    var quickText = ["", "All teams complete on search, person found safe and well.", "All teams complete on search, nothing found."]

                    for (var i = 0; i < quickText.length; i++) {
                        var opt = document.createElement('option');
                        opt.text = quickText[i];
                        opt.value = quickText[i];
                        document.getElementById("CompleteQuickTextBox").add(opt);
                    }

                    break;
            }


        }
    }


});

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace);
}

function removeOptions(selectbox) {
    var i;
    for (i = selectbox.options.length - 1; i >= 0; i--) {
        selectbox.remove(i);
    }
}

document.getElementById("CompleteQuickTextBox").onchange = function() {
    console.log(this.value)

    var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");

    masterViewModel.completeTeamViewModel.actionTaken(this.value);
}



// document.getElementById("lighthousecompleteandfinal").onclick = function() {
//     console.log("someone has their big boy pants on")


//     masterViewModel.JobManager.FinaliseJob(jobId,masterViewModel.completeTeamViewModel.actionTaken(),masterViewModel.completeTeamViewModel.timeComplete().format());


// }