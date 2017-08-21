var DOM = require('jsx-dom-factory');
var _ = require('underscore');
var $ = require('jquery');
global.jQuery = $;
var ElasticProgress = require('elastic-progress');

var LighthouseJob = require('../lib/shared_job_code.js');
var LighthouseUnit = require('../lib/shared_unit_code.js');
var LighthouseJson = require('../lib/shared_json_code.js');

// inject css c/o browserify-css
require('../styles/advexport.css');

var timeoverride = null;

window.onerror = function(message, url, lineNumber) {
  $('#loading')
  .html('Error loading page<br>' + message + ' Line ' + lineNumber)
  .show();
  return true;
};

var lighthouse_fieldArray = {
  'Job Details' : {
    'Identifier'                           : 'Id' ,
    'ICEMSIncidentIdentifier'              : 'ICEMS Id' ,
    'ReferringAgency'                      : 'ICEMS Originator' ,
    'JobReceived'                          : 'Received' ,
    'JobAcknowledged'                      : 'Acknowledged' ,
    'JobCompleted'                         : 'Completed' ,
    'JobFinalised'                         : 'Finalised' ,
    'JobPriorityType.Name'                 : 'Priority' ,
    'JobType.Name'                         : 'Type' ,
    'JobStatusType.Name'                   : 'Status' ,
    'Reconnoitered'                        : 'Reconned' ,
    'SituationOnScene'                     : 'Situation On Scene' ,
    'Tags'                                 : 'Tags' ,
    'EntityAssignedTo.Code'                : 'HQ' ,
    'LGA'                                  : 'LGA' ,
    'EntityAssignedTo.ParentEntity.Code' : 'Region' ,
    'Event.Identifier'                   : 'Event'
  } ,
  'Address Details' : {
    'Address.Level'                 : 'Level' ,
    'Address.StreetNumber'          : 'Street Number' ,
    'Address.Street'                : 'Street Name' ,
    'Address.Locality'              : 'Locality' ,
    'Address.PostCode'              : 'Postcode' ,
    'Address.PrettyAddress'         : 'Pretty Address' ,
    'Address.AdditionalAddressInfo' : 'Additional Address Info' ,
    'Address.Latitude'              : 'Latitude' ,
    'Address.Longitude'             : 'Longitude' ,
    'PermissionToEnterPremises'     : 'Premises Access - Permission Given' ,
    'howToEnterPremises'            : 'Premises Access - Info'
  } ,
  'Caller / Resident Details' : {
    'CallerFirstName'    : 'Caller - First Name' ,
    'CallerLastName'     : 'Caller - Last Name' ,
    'CallerPhoneNumber'  : 'Caller - Phone Number' ,
    'ContactFirstName'   : 'Job Contact - First Name' ,
    'ContactLastName'    : 'Job Contact - Last Name' ,
    'ContactPhoneNumber' : 'Job Contact - Phone Number'
  }
};
var lighthouse_fieldDefaults = [
'Id' ,
'Received' ,
'Priority' ,
'Type' ,
'Status' ,
'Situation On Scene' ,
'Tags' ,
'HQ' ,
'Level' ,
'Street Number' ,
'Street Name' ,
'Locality' ,
'Postcode' ,
'Additional Address Info' ,
  /*
  'Premises Access - Permission Given' ,
  'Premises Access - Info' ,
  */
  'Caller - First Name' ,
  'Caller - Last Name' ,
  'Caller - Phone Number' ,
  'Job Contact - First Name' ,
  'Job Contact - Last Name' ,
  'Job Contact - Phone Number'
  ];



  $(document).ready(function() {

    var $fieldsetContainer = $('#advexport_fieldsets');
    $.each(lighthouse_fieldArray,function(k,v){
      var fieldset = (
        <fieldset>
        <legend>{k}</legend>
        {_.map(v,function(label,key){
          return (
            <label class="checkbox-inline">
            <input type="checkbox"
            name="advexportfields[]"
            value={key}
            checked={lighthouse_fieldDefaults.indexOf(label)>=0} />
            {label}
            </label>
            );
        })}
        </fieldset>
        );
      $fieldsetContainer.append(fieldset);
    });
    $('input[type="checkbox"][checked="false"]', $fieldsetContainer)
    .prop('checked', false);

    $('#goButton')
    .click(function(){
      var element = document.querySelector('.loadprogress');
      var mp = new ElasticProgress(element, {
        buttonSize: 60,
        fontFamily: 'Montserrat',
        colorBg:    '#edadab',
        colorFg:    '#d2322d',
        onClose:function(){
          $('#loading')
          .hide();
        }
      });
      RunForestRun(mp);
    });

  });


function getSearchParameters() {
  var prmstr = window.location.search.substr(1);
  return prmstr != null && prmstr != '' ? transformToAssocArray(prmstr) : {};
}

function transformToAssocArray(prmstr) {
  var params = {};
  var prmarr = prmstr.split('&');
  for (var i = 0; i < prmarr.length; i++) {
    var tmparr = prmarr[i].split('=');
    params[tmparr[0]] = tmparr[1];
  }
  return params;
}

var timeperiod;
var unit = [];

var params = getSearchParameters();

//Get times vars for the call
function RunForestRun(mp) {
  mp && mp.open();
  $('#loading')
  .show();
  HackTheMatrix(params.hq, params.host, mp);
}

var selectedcolumns = [];

//make the call to beacon
function HackTheMatrix(id, host, progressBar) {
  console.log(id);
  var unit = [];
  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));
  var selectedcolumns = $('input[name="advexportfields[]"]:checked')
  .map(function(){return this.value;})
  .get();

  if(selectedcolumns.length == 0){
    console.log('No Fields Selected');
    return false;
  }else{
    console.log('selectedcolumns = %o' , selectedcolumns);
  }

  if (typeof id !== 'undefined') {
    id.split(',').forEach(function(d){
      var newObj = {'Id': d};
      unit.push(newObj);
    });
  }

  if(unit.length == 0){
    console.log('No Units Selected');
  }else{
    console.log(unit);
  }


  LighthouseJob.get_json(unit, host, start, end, params.token, function(jobs) {
    //console.log(jobs);
          // $(jobs.Results).each(function(j,k){
          //   console.log(k)
          //   console.log(k.Event)
          // })
var beacon_jobs = jobs.Results.map(function(d){
  var jobRow = [];

  _.each(selectedcolumns, function(key){
        // Raw Value
        try {
          var rawValue = key.split('.').reduce(function(obj,i) {return obj[i]}, d);
        } catch(err) {
          var rawValue = ''
        }
        // Special Cases
        //console.log(key)
        switch(key){
          case 'JobReceived':
          var rawdate = new Date(d.JobReceived);

          rawValue = rawdate;

          break;
          case 'Tags':
          rawValue = d.Tags.map(function(d){return d.Name}).join(',');
          break;


          case 'JobAcknowledged':
          _.each(d.JobStatusTypeHistory.reverse(), function(history){
            if (history.Name == 'Active')
            {
             var rawdate = new Date(history.Timelogged);
             rawValue = rawdate; 
             return false; 
           }
         }) 
          break;
          case 'JobCompleted':
          _.each(d.JobStatusTypeHistory, function(history){
            if (history.Name == 'Complete')
            {
             var rawdate = new Date(history.Timelogged);
             rawValue = rawdate; 
             return false; 
           }
         }) 
          break;
          case 'JobFinalised':
          _.each(d.JobStatusTypeHistory, function(history){
            if (history.Name == 'Finalised')
            {
             var rawdate = new Date(history.Timelogged);
             rawValue = rawdate; 
             return false; 
           }
         })    
          break;
        }
        if(rawValue == null || rawValue === ''){
          jobRow.push('');
          return; // Continue to next item
        }
        jobRow.push(rawValue);
      });

return jobRow;
});
progressBar.setValue(1);
progressBar.close();
downloadCSV("LighthouseExport.csv", beacon_jobs, selectedcolumns);

progressBar.close();

},function(val,total){
  progressBar.setValue(val/total);
});
}

function convertArrayOfObjectsToCSV(data, selectedcolumns) {  

  var result, ctr, keys, columnDelimiter, lineDelimiter, data;

  if (data == null || !data.length) {
    return null;
  }

  //console.log('data', data);

  var rows = [];
  var delimCellL = '"=""';
  var delimCellR = '"""';
  var delimCol   = delimCellR + ',' + delimCellL;
  var delimLine  = '\n';

  // Getting Column Headings
  var fieldKeys = fieldLabels = [];
  _.each(lighthouse_fieldArray, function(fields, section){
    _.each(fields, function(label, key){
      fieldKeys.push(key);
      fieldLabels.push(label);
    });
  });
  selectedcolumns.map(function(v, k){
    return fieldLabels[fieldKeys.indexOf(v)];
  })

  rows.push( delimCellL + selectedcolumns.join( delimCol ) + delimCellR );

  data.forEach(function(item){
    rows.push( delimCellL + item.join( delimCol ) + delimCellR );
  });

  return rows.join( delimLine );
}


function downloadCSV(file, dataIn, keyIn) {  
  var csv = convertArrayOfObjectsToCSV(dataIn, keyIn);
  if (csv == null)
    return;

  var saveData = (function () {
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    return function (data, fileName) {
      blob = new Blob([data], {type: "octet/stream"}),
      url = window.URL.createObjectURL(blob);
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    };
  }());


  saveData(csv, file);

}
