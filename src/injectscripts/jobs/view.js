console.log("Running content scriptz");

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

//rotate page title
var setPageTitle_delay = 500;
function setPageTitle(){
  if( typeof masterViewModel.entityAssignedTo.peek() == 'undefined' || typeof masterViewModel.jobType.peek() == 'undefined' ){
    console.info( 'setPageTitle - delaying' );
    setPageTitle_delay += 500;
    setTimeout( setPageTitle , 500 );
    return;
  }else{
    console.log( 'setPageTitle - running (total delay: %ds)' , setPageTitle_delay );
  }
  document.title = masterViewModel.entityAssignedTo.peek().Code + " | " + masterViewModel.jobType.peek().Name +" | #"+jobId + " | ";
  $.marqueeTitle({
    dir: "left",
    speed: 100
  });
}
setTimeout( setPageTitle , setPageTitle_delay );

(function ($) {
    var shift = {
        "left": function (a) {
            a.push(a.shift());
        },
        "right": function (a) {
            a.unshift(a.pop());
        }
    };
    $.marqueeTitle = function (options) {
        var opts = $.extend({},
        {
            text: "",
            dir: "left",
            speed: 200
        }, options),
            t = (opts.text || document.title).split("");
        if (!t) {
            return;
        }
        t.push(" ");
        setInterval(function () {
            var f = shift[opts.dir];
            if (f) {
                f(t);
                document.title = t.join("");
            }
        }, opts.speed);
    };
}(jQuery));



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

//take the clicked list option and set the complete action the value of this.
document.getElementById("CompleteTeamQuickTextBox").onchange = function() {
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



function checkAddressHistory(){
  var address = masterViewModel.enteredAddress.peek();
  if( typeof address == 'undefined' ){
    setTimeout( checkAddressHistory , 500 );
    return;
  }
  //console.log('address: %s',address);
  var now = new Date();
  var tmp = /^(\d{2})\/(\d{2})\/(\d{4}),\s+(\d{2}:\d{2}:\d{2})$/.exec(now.toLocaleString());
  var timeFrameEnd   = tmp[3]+'-'+tmp[2]+'-'+tmp[1]+'T'+tmp[4];
  now.setYear(now.getFullYear()-1);
  tmp = /^(\d{2})\/(\d{2})\/(\d{4}),\s+(\d{2}:\d{2}:\d{2})$/.exec(now.toLocaleString());
  var timeFrameStart = tmp[3]+'-'+tmp[2]+'-'+tmp[1]+'T'+tmp[4];
  //console.log('timeFrameEnd: %s, timeFrameStart: %s',timeFrameEnd,timeFrameStart);

  $.ajax({
    type: 'GET' ,
    url: '/Api/v1/Jobs/Search' ,
    data: {
      'Q' : address.substring( 0 , 30 ) ,
      'StartDate' : timeFrameStart ,
      'EndDate' : timeFrameEnd ,
      'ViewModelType' : 2 ,
      'PageIndex' : 1 ,
      'PageSize' : 100 ,
      'SortField' : 'JobReceived' ,
      'SortOrder' : 'desc'
    } ,
    cache: false ,
    dataType: 'json' ,
    complete: function(response, textStatus){
      console.log( 'response' , response );
      console.log( 'textStatus' , textStatus );
      var content = '<em>No Previous Reports found for this address</em>';
      switch( textStatus ){
        case 'success' :
          if( response.responseJSON.Results.length ){
            var history_rows = new Array();
            $.each( response.responseJSON.Results , function( k , v ){
              //console.log( k , v );
              if( v.Address.PrettyAddress != address ){
                //console.log( 'Imperfect Address Match' , v.Address.PrettyAddress , address );
                return true;
              }else if( v.Id == jobId ){
                //console.log( 'Current Job Match' );
                return true;
              }
              //console.log( 'History Hit' );
              var newRow = '<tr class="job-history-status-'+v.JobStatusType.Name.toLowerCase()+'">'+
                             '<th><a href="/Jobs/'+v.Id+'">'+v.Identifier+'</a></th>'+
                             '<td>'+v.JobStatusType.Name+'</td>'+
                             '<td>'+v.JobReceived+'</td>'+
                             '<td>'+v.SituationOnScene+'</td>'+
                           '</tr>';
              history_rows.push( newRow );
            });
            if( history_rows.length ){
              content = '<table>'+
                          '<thead>'+
                            '<tr>'+
                              '<th>Job #</th><th>Status</th><th>Date</th><th>Details</th>'+
                            '</tr>'+
                          '</thead>'+
                          '<tbody>'+
                            history_rows.join('')+
                          '</tbody>'+
                        '</table>';
            }
          }else{
            console.log( 'Address Search - No History' );
          }
          break;
        case 'error' :
          content = '<em>Unable to Perform Address Search</em>';
          break;
        case 'nocontent' :
          content = '<em>Address Search returned Unexpected Data</em>';
          break;
        case 'timeout' :
          content = '<em>Address Search Timed Out</em>';
          break;
        case 'abort' :
          content = '<em>Address Search Aborted</em>';
          break;
        case 'parsererror' :
          content = '<em>Address Search returned Unexpected Data</em>';
          break;
      }
      $('fieldset.col-md-12 legend , fieldset.col-md-4 legend').each(function(k,v){
        var $v = $(v);
        var $p = $v.closest('fieldset');
        var section_title = $v.text().trim();
        if( section_title.indexOf( 'Notes' ) === 0 || section_title.indexOf( 'Messages' ) === 0 ){
          $p.before('<fieldset id="job_view_history" class="col-md-12">'+
                      '<legend>Job History for Address (12 Months)</legend>'+
                      '<div class="form-group col-xs-12">'+
                        content+
                      '</div>'+
                    '</fieldset>');
          return;
        }
      });

    }
  });
}
setTimeout( checkAddressHistory , 1000 );
