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
console.log("BR cleanup called")
  //only run if messages and notes have loaded in (causes problems overwise and won't load)
  var selector = '.job-details-page div[data-bind="foreach: opsLogEntries"] div[data-bind="text: Text"]';

  $(selector).each(function() {
    var text = $(this).html();
    var replaced = text.replace(/&lt;br&gt;/g, '<br />');
    $(this).html(replaced);
  });

  try { //get rid of the loading image which some times gets suck. i assume a race condition it the cause
    var progress = document.getElementById("editRfaForm").getElementsByClassName("col-xs-12 text-center");
    progress[0].parentNode.removeChild(progress[0]);
  } catch (err) {
    console.log(err.messages);
  }
}


document.getElementById("FinaliseQuickTextBox").onchange = function() {
  console.log(this.value);
  var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");
  masterViewModel.finalisationText(this.value);
}

document.getElementById("CompleteQuickTextBox").onchange = function() {
  console.log(this.value);
  var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");
  masterViewModel.finalisationText(this.value);
}


masterViewModel.completeTeamViewModel.primaryActivity.subscribe(function(newValue) {
  if (typeof newValue !== 'undefined') {
    if (newValue !== null) {
      switch (newValue.Name) {
        case "Storm":
          removeOptions(document.getElementById("CompleteTeamQuickTextBox"));
          var quickText = ["", "No damage to property, scene safe. Resident to arrange for clean up.", "Tree removed and scene made safe.", "Roof repaired and scene made safe.", "Damage repaired and scene made safe.", "Job was referred to contractors who have completed the task.", "Council have removed the tree from the road, scene made safe.", "Branch/tree sectioned; resident/owner to organize removal"]
          document.getElementById("CompleteTeamQuickTextBox").removed
          for (var i = 0; i < quickText.length; i++) {
            var opt = document.createElement('option');
            opt.text = quickText[i];
            opt.value = quickText[i];
            document.getElementById("CompleteTeamQuickTextBox").add(opt);
          }
          break;
        case "Search":
            removeOptions(document.getElementById("CompleteTeamQuickTextBox"));
            var quickText = ["", "All teams complete on search, person found safe and well.", "All teams complete on search, nothing found."]
            for (var i = 0; i < quickText.length; i++) {
              var opt = document.createElement('option');
              opt.text = quickText[i];
              opt.value = quickText[i];
              document.getElementById("CompleteTeamQuickTextBox").add(opt);
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

document.getElementById("CompleteTeamQuickTextBox").onchange = function() {
  console.log(this.value)

  var block = document.getElementById("finaliseJobModal").getElementsByClassName("form-control");

  masterViewModel.completeTeamViewModel.actionTaken(this.value);
}


$(document).ready(function() {
  document.getElementById("stormtree").onclick = function() {
    taskFill("Storm","Tree Operations/Removal")
  };
  document.getElementById("stormproperty").onclick = function() {
    taskFill("Storm","Property Protection")
  };
  document.getElementById("stormsafety").onclick = function() {
    taskFill("Storm","Public Safety")
  };
  document.getElementById("stormaccess").onclick = function() {
    taskFill("Storm","Road/Access Clearance")
  };
  document.getElementById("stormrecon").onclick = function() {
    taskFill("Storm","Reconnaissance")
  };
  document.getElementById("rcrcalloff").onclick = function() {
    taskFill("RoadCrashRescue","Call Off")
  };
  document.getElementById("rcrcallextricate").onclick = function() {
    taskFill("RoadCrashRescue","Extrication ")
  };
});

function taskFill(parent, child) {
  masterViewModel.completeTeamViewModel.availablePrimaryActivities.peek().forEach(function(d){
    if (d.Name == parent) {
      masterViewModel.completeTeamViewModel.primaryActivity(d);
      masterViewModel.completeTeamViewModel.availablePrimaryTasks.subscribe(function(d) {
        d.forEach(function(d) {
          if (d.Name == child) {
              masterViewModel.completeTeamViewModel.primaryTask(d)
          }
        });
      })
    }
  });
}

var $lighthouse_mapblock;

$(document).ready(function(){

  $lighthouse_mapblock = $('<div id="lighthouse_mapblock"><div>Click to zoom or move map</div></div>');
  $lighthouse_mapblock
    .on('click',function(e){
      var $t = $(this);
      $t.hide();
      e.stopPropagation();
    });
  $('#map')
    .append($lighthouse_mapblock)
    .on('mouseleave',function(e){
      $lighthouse_mapblock.show();
    });

});
