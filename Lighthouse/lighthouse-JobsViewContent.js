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
                    var quickText = ["", "Tree removed and scene made safe.", "Roof repaired and scene made safe.", "Damage repaired and scene made safe.", "Job was referred to contractors who have completed the task.", "Council have removed the tree from the road, scene made safe."]
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