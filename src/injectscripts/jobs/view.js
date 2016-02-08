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



document.title = "#"+jobId;


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

  var address = masterViewModel.geocodedAddress();
  if( typeof address == 'undefined' ){
    setTimeout( checkAddressHistory , 500 );
    return;
  }
  //console.log('address: %o',address);

  var now = new Date();
  var end = new Date();
  end.setYear(end.getFullYear()-1);

  var timeFrameEnd   = now.toLocaleString();
  var timeFrameStart  = end.toLocaleString();
  //console.log('timeFrameEnd: %s, timeFrameStart: %s',timeFrameEnd,timeFrameStart);

  $.ajax({
    type: 'GET' ,
    url: '/Api/v1/Jobs/Search' ,
    data: {
      'Q' : ( address.Street+', '+address.Locality ).substring( 0 , 30 ) ,
      'StartDate' : timeFrameStart ,
      'EndDate' : timeFrameEnd ,
      'ViewModelType' : 2 ,
      'PageIndex' : 1 ,
      'PageSize' : 100 ,
      'SortField' : 'JobReceived' ,
      'SortOrder' : 'desc' ,
      'LighthouseFunction' : 'checkAddressHistory'
    } ,
    cache: false ,
    dataType: 'json' ,
    complete: function(response, textStatus){
      console.log( 'response' , response );
      console.log( 'textStatus' , textStatus );
      var content = '<em>No Previous Reports found for this address, or street</em>';
      switch( textStatus ){
        case 'success' :
        if( response.responseJSON.Results.length ){
          var history_rows = {
            'exact' : new Array() ,
            'partial' : new Array() ,
            'neighbour' : new Array() ,
            'street' : new Array()
          };
          var re_StreetNumber_Parts = /^(?:(\d+)\D)?(\d+)\D*/;
          var jobAddress_StreetNumber_tmp = re_StreetNumber_Parts.exec( address.StreetNumber );
          var jobAddress_StreetNumber_Max = parseInt( jobAddress_StreetNumber_tmp[2] , 10 );
          var jobAddress_StreetNumber_Min = parseInt( jobAddress_StreetNumber_tmp[( typeof jobAddress_StreetNumber_tmp[1] == 'undefined' ? 2 : 1 )] , 10 );
          $.each( response.responseJSON.Results , function( k , v ){
            console.log( k , v );
            if( v.Id == jobId ){
              console.log( 'Current Job Match' );
              return true;
            }
            //No street number so its the same road
              if (v.Address.StreetNumber == null) {
                history_rows.street.push( checkAddressHistory_constructRow( v, false, k) );
                return true;
              }
              // Construct Row
              if( v.Address.PrettyAddress == address.PrettyAddress ){
                console.log( 'Perfect Address Match' );
                history_rows.exact.push( checkAddressHistory_constructRow( v , true, k) );
                return true;
              }
              // Not an exact address match, so include the address in the result row
              if( v.Address.StreetNumber.replace(/\D+/g,'') == address.StreetNumber.replace(/\D+/g,'') ){
                console.log( 'Partial Address Match - Possible Townhouses/Apartments' );
                history_rows.partial.push( checkAddressHistory_constructRow( v, false, k) );
                return true;
              }
              var rowAddress_StreetNumber_tmp = re_StreetNumber_Parts.exec( v.Address.StreetNumber );
              var rowAddress_StreetNumber_Max = parseInt( rowAddress_StreetNumber_tmp[2] , 10 );
              var rowAddress_StreetNumber_Min = parseInt( rowAddress_StreetNumber_tmp[( typeof rowAddress_StreetNumber_tmp[1] == 'undefined' ? 2 : 1 )] , 10 );
              if( Math.abs( jobAddress_StreetNumber_Min - rowAddress_StreetNumber_Max ) == 2 || Math.abs( jobAddress_StreetNumber_Max - rowAddress_StreetNumber_Min ) == 2 ){
                console.log( 'Immediate Neighour' );
                history_rows.neighbour.push( checkAddressHistory_constructRow( v, false, k) );
                return true;
              }
              console.log( 'Street Address Match' );
              history_rows.street.push( checkAddressHistory_constructRow( v, false, k) );
            });
content = '<table>'+
'<thead>'+
'<tr><th>Job #</th><th>Address</th><th rowspan="2">Details</th></tr>'+
'<tr><th>Status</th><th>Date</th></tr>'+
'</thead>'+
'<tbody>';
$.each(history_rows,function(k,v){
  var section_heading = false;
  var section_always = false;
  switch(k){
    case 'exact' :
    section_heading = 'Exact Address';
    section_always = true;
    break;
    case 'partial' :
    section_heading = 'Townhouse, Apartment or Battleaxe';
    break;
    case 'neighbour' :
    section_heading = 'Neighbouring Address';
    break;
    case 'street' :
    section_heading = 'Same Street';
    break;
  }
  if( ( v.length || section_always ) && section_heading ){
    content += '<tr class="job-view-history-section job-view-history-'+k+'"><th colspan="3">'+section_heading+'</th></tr>';
  }
  if( v.length ){
    content += v.join('');
  }else if( section_always ){
    content += '<tr class="job-view-history-none"><td colspan="3"><em>No Previous Reports</em></td></tr>';
  }
});
content += '</tbody>'+
'</table>';
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
      // Insert content into DOM element
      $('#job_view_history div.form-group')
      .html(content);

    }
  });
}
setTimeout( checkAddressHistory , 1000 );

function checkAddressHistory_constructRow( v , sameAddress, oddEvenCount ){

  var options = {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "numeric",
    hour12: false
  };

  //Trim job ID

  var RowisEven = !!(oddEvenCount && !(oddEvenCount%2))
  if (RowisEven) {RowColor = 'evenRow'} else {RowColor = 'oddRow'};


v.Address.Street = v.Address.Street.replace("ROAD","RD");
v.Address.Street = v.Address.Street.replace("STREET","ST");
v.Address.Street = v.Address.Street.replace("AVENUE","AVE");




  var thedate = new Date(new Date(v.JobReceived).getTime() + (new Date(v.JobReceived).getTimezoneOffset() * 60000));
  var address = ( v.Address.StreetNumber != null ? (sameAddress == false ? v.Address.StreetNumber+' '+v.Address.Street : 'Same Address' ) : v.Address.Street );

  return '<tr class="job-view-history '+RowColor+' job-view-history-status-'+v.JobStatusType.Name.toLowerCase()+'">'+
  '<th><a href="/Jobs/'+v.Id+'">'+v.Identifier+'</a></th>'+
  '<td>'+address+'</td>'+
  '<td rowspan="2" valign="top">'+( v.SituationOnScene == null ? 'View job for more detail' : ( v.SituationOnScene.length > 80 ? v.SituationOnScene.substring(0,78)+"..." : v.SituationOnScene ) )+'</td>'+
  '</tr>'+
  '<tr class="job-view-history '+RowColor+' job-view-history-status-'+v.JobStatusType.Name.toLowerCase()+'">'+
  '<td>'+v.JobStatusType.Name+'</td>'+
  '<td title="'+thedate.toLocaleTimeString("en-au", options)+'">'+moment(thedate).fromNow()+'</td>'+
  '</tr>';
}
