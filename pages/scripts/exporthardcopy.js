var DOM = require('jsx-dom-factory');
var _ = require('underscore');
var $ = require('jquery');
global.jQuery = $;
var ElasticProgress = require('elastic-progress');

var LighthouseJob = require('../lib/shared_job_code.js');
var LighthouseUnit = require('../lib/shared_unit_code.js');
var LighthouseJson = require('../lib/shared_json_code.js');

// inject css c/o browserify-css
require('../styles/exporthardcopy.css');

var timeoverride = null;

window.onerror = function(message, url, lineNumber) {
  $('#loading')
    .html('Error loading page<br>' + message + ' Line ' + lineNumber)
    .show();
  return true;
};


var selectedcolumns = [
  'Identifier' ,  // Beacon Job ID
  'JobReceived' , // Job Recieved Date/Time

  'JobPriorityType.Name' , // Priority

  'Address.PrettyAddress' ,         // Address
  'Address.AdditionalAddressInfo' , // Additional Address Info

  'PermissionToEnterPremises' , // Permission to Enter
  'howToEnterPremises' ,        // How to Enter

  'SituationOnScene' , // Situation On Scene
  'Tags' ,             // Tags

  'CallerFirstName' ,   // Caller - First Name
  'CallerLastName' ,    // Caller - Last Name
  'CallerPhoneNumber' , // Caller - Phone Number
  'ContactFirstName' ,  // Job Contact - First Name
  'ContactLastName' ,   // Job Contact - Last Name
  'ContactPhoneNumber'  // Job Contact - Phone Number
];


var timeperiod;
var unit = [];

var params = getSearchParameters();


/*
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
*/
RunForestRun();


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


//Get times vars for the call
function RunForestRun(mp) {
  mp && mp.open();
  $('#loading')
    .show();
  HackTheMatrix(params.hq, params.host, mp);
}


var jobTemplate = '<table class="jobHardcopy">'+
                    '<tr><th class="lh_jhc_ref">Job Reference #++Identifier++++JobPriorityType.Name++</th></tr>'+
                    '<tr><td class="lh_jhc_recd">Job Reported: ++JobReceived++</td></tr>'+
                    '<tr><td colspan="2" class="lh_jhc_addr">++Address.PrettyAddress++</td></tr>'+
                    '<tr><td colspan="2" class="lh_jhc_addr_addl">++Address.AdditionalAddressInfo++</td></tr>'+
                    '<tr><td height="30">&nbsp;</td></tr>'+
                    '<tr><td class="lh_jhc_sos"><strong>Situation On Scene:</strong><br/>++SituationOnScene++</td></tr>'+
                    '<tr><td height="30">&nbsp;</td></tr>'+
                    '<tr><td class="lh_jhc_tags"><strong>Tags:</strong><br/>++Tags++</td></tr>'+
                    '<tr><td height="30">&nbsp;</td></tr>'+
                    '<tr><td class="lh_jhc_caller"><strong>Caller:</strong> ++CallerFirstName++ ++CallerLastName++ ++CallerPhoneNumber++</td></tr>'+
                    '<tr><td class="lh_jhc_contact"><strong>Job Contact:</strong> ++ContactFirstName++ ++ContactLastName++ ++ContactPhoneNumber++</td></tr>'+
                    '<tr><td class="lh_jhc_access"><strong>Property Access:</strong> ++PermissionToEnterPremises++++howToEnterPremises++</td></tr>'+
                    '<tr><td height="30">&nbsp;</td></tr>'+
                    '<tr><th class="lh_jhc_attend_head">Attendance Details</th></tr>'+
                    '<tr class="lh_jhc_form"><td>Team or Team Leader Name:</td></tr>'+
                    '<tr class="lh_jhc_form"><td>Date &amp; Time Of Arrival:</td></tr>'+
                    '<tr class="lh_jhc_form"><td>Date &amp; Time Of Departure:</td></tr>'+
                    '<tr class="lh_jhc_form"><td>Description of Situation:</td></tr>'+
                    '<tr class="lh_jhc_form"><td>&nbsp;</td></tr>'+
                    '<tr class="lh_jhc_form"><td>&nbsp;</td></tr>'+
                    '<tr class="lh_jhc_form"><td>Work Performed:</td></tr>'+
                    '<tr class="lh_jhc_form"><td>&nbsp;</td></tr>'+
                    '<tr class="lh_jhc_form"><td>&nbsp;</td></tr>'+
                    '<tr class="lh_jhc_form"><td>&nbsp;</td></tr>'+
                    '<tr class="lh_jhc_form"><td>Any Further Work Needed:</td></tr>'+
                    '<tr class="lh_jhc_form"><td>&nbsp;</td></tr>'+
                    '<tr class="lh_jhc_form"><td>&nbsp;</td></tr>'+
                      /*
                    '<tr>'+
                      '<td>'+
                        '<table class="jobHardcopy_tasker">'+
                          '<tr><td>++tasker++<br/>Email: ++tasker_email++<br/>Phone: ++tasker_phone++<br/>Fax: ++tasker_fax++</td></tr>'+
                          '<tr><td></td></tr>'+
                        '</table>'+
                      '</td>'+
                    '</tr>'+
                      */
                  '</table>'+
                  '<hr/>';

//make the call to beacon
function HackTheMatrix(id, host, progressBar) {
  console.log('HackTheMatrix( %s , %s , %o )',id, host, progressBar);
  var unit = [];
  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));

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


  LighthouseJob.get_json(unit, host, start, end, function(jobs) {

    $.each(jobs.Results , function(k,v){
      var thisJob = jobTemplate;
      _.each(selectedcolumns, function(key){
        // Raw Value
        var rawValue = key.split('.').reduce(function(obj,i) {return obj[i]}, v);
        // Special Cases
        switch(key){
          case 'JobReceived':
            var rawDate = new Date(v.JobReceived);
            rawDate = new Date(rawDate.getTime() + ( rawDate.getTimezoneOffset() * 60000 ));
            rawValue = (''+rawDate).split( ' GMT' )[0];
            break;
          case 'Tags':
            rawValue = v.Tags.map(function(v){return v.Name}).join(' , ');
            break;
          case 'JobPriorityType.Name':
            rawValue = ( rawValue == 'General' ? '' : ' ('+rawValue+')' );
            break;
          case 'PermissionToEnterPremises':
            rawValue = ( rawValue ? 'P' : '<strong>NO</strong> P' )+'ermission granted to access premises if resident is absent';
            break;
        }
        if( rawValue == null )
          rawValue = '';
        thisJob = thisJob.replace( '++' + key + '++' , rawValue );
      });
      thisJob = thisJob.replace( /\+\+[^\+]+\+\+/g , '<em>Unknown or Unavailable</em>' );
      $('#results').append(thisJob);
    });

    //progressBar && progressBar.setValue(1);
    //progressBar && progressBar.close();
    //downloadCSV("LighthouseExport.csv", beacon_jobs, selectedcolumns);

    //progressBar && progressBar.close();

    $('#loadinner p').text('Loaded');

    window.print();

  },function(val,total){
    progressBar && progressBar.setValue(val/total);
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
