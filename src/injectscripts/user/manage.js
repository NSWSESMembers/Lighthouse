
vm.pagedList.subscribe(lighthouseKeeper)

function lighthouseKeeper(){


  $('div.admin-page.ops-log-page.full-height > div.col-lg-10.col-md-9 > div.widget > div.widget-content.clearfix > table > tbody > tr:nth-child(4) > td > div:nth-child(1) > div:nth-child(1)').append('<small>Test</small>')

  //Mouseover for permission spans to give a basic descrition.

  var $targetElementsSelected = $('div[data-bind="foreach: RolesForAuthorizationZone"] span');

  var $targetElements = $('span[data-bind="style: {\'opacity\': $root.canManageUserRoles($parent) ? 1 : 0.5}, click: $root.addRole.bind($data, $parent)"]')

  var role_Dictionary = {
    'accreditation-management' : 'Vertical Rescue, Community First Responder, General Land Rescue and Flood Rescue Level 3 accreditation management. Refer to SOP beacon HQ Availability and Accreditation.',
    'contactgroups-management' : 'Creation and editing of contact groups. Refer to SOP beacon Contact Groups.',
    'deployment-management' : 'Creating and editing of deployments and redeployments. Refer to SOP beacon Deployments.',
    'event-management' : 'Creating, editing and closing Events, which capture jobs for reporting. Refer to SOP Event Creation.',
    'externalpeople-management' : 'Creating, editing and removing external people i.e. RFS, Police Liaison, who are required to be tasked to teams in assistance of the NSW SES. Refer to SOP External People Management.',
    'headquarters-management' : 'Management of HQ Status - Monitoring or Not Monitoring. Refer to SOP beacon HQ Availability and Accreditation.',
    'job-creator' : 'Creation of Jobs. Refer to beacon User Guide.',
    'job-management' : 'Acknowledge, reject, recce’d, complete and finalise jobs. Refer to SOP Job Completion and Finalisation.',
    'message-management' : 'Viewing the message register.',
    'notification-management' : 'Viewing notification log, register and managing escalations.',
    'opslog-management' : 'Viewing and entering an Ops Log. Refer to beacon User Guide.',
    'provider-management' : 'Adding and entering providers i.e. Arborists, councils into the OMS. Refer to SOP Providers and Approved Suppliers.',
    'reports-management' : 'Generating read only reports.',
    'rescue-creator': 'Creating Rescue Jobs.',
    'resource-management' : 'Managing critical resources, including adding and editing them',
    'restricted opslog-management' : 'Ability to restrict Ops logs I.e. due to privacy, sensitive information.',
    'sector-management' : 'Creating sectors for tasking.',
    'send-message' : 'Sending Messages i.e. sms or email to members or established contact groups.',
    'tasking-management' : 'Ability to task teams, sectors, and categorise jobs in the tasking screen.',
    'team-management' : 'Creation, editing, standing up and down, activating teams etc. Refer to SOG beacon Teams.',
    'teamjobs-management' : 'Managing jobs that are already tasked, including prioirtising and team completion. Refer to SOP Job Completion & Finalisation and SOG beacon Priority Response and Tasking Categories.',
    'user-creator' : 'Create Users for beacon, Refer to SOP beacon User Permissions.',
    'user-management' : 'Manage Users i.e. reset password refer to SOP beacon User Permissions.',
    'people-management' : 'Manage People i.e. external, add create delete.',
    'icems-management' : 'Manage ICEMS response, send IAR and other messages.'
  };

  $targetElements.each(function(v){


    var $t = $(this);
    var contentOrig = $t.html();

    // ICEMS Dictionary
    _.each(role_Dictionary, function(clearText, abbrText){
      if (abbrText == $t.text())
      {
        $t.attr('title',clearText)
      }
    });


  });

  $targetElementsSelected.each(function(v){


    var $t = $(this);
    var contentOrig = $t.html();

    // ICEMS Dictionary
    _.each(role_Dictionary, function(clearText, abbrText){
      if (abbrText == $t.text())
      {
        $t.attr('title',clearText)
      }
    });


  });

}


function whenPageIsReady(cb) { //when external vars have loaded
var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
  if (typeof vm != "undefined" & vm.availableRoleGroups != "undefined") {
    console.log("vm is ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
  }, 200);
}
