/* global $, _ */

lighthouseKeeper()



function lighthouseKeeper(){

  console.log('Adding tool text')

  //Mouseover for permission spans to give a basic descrition.

  //hacky fix for windows.
  var $targetElements = $('[id^=roleEntity_] span');

  var role_Dictionary = {
    'Accreditation Management' : 'Vertical Rescue, Community First Responder, General Land Rescue and Flood Rescue Level 3 accreditation management. Refer to SOP beacon HQ Availability and Accreditation.',
    'Contactgroups Management' : 'Creation and editing of contact groups. Refer to SOP beacon Contact Groups.',
    'Deployment Management' : 'Creating and editing of deployments and redeployments. Refer to SOP beacon Deployments.',
    'Event Management' : 'Creating, editing and closing Events, which capture jobs for reporting. Refer to SOP Event Creation.',
    'External People Management' : 'Creating, editing and removing external people i.e. RFS, Police Liaison, who are required to be tasked to teams in assistance of the NSW SES. Refer to SOP External People Management.',
    'Headquarters Management' : 'Management of HQ Status - Monitoring or Not Monitoring. Refer to SOP beacon HQ Availability and Accreditation.',
    'Job Creator' : 'Creation of Jobs. Refer to beacon User Guide.',
    'Job Management' : 'Acknowledge, reject, recce’d, complete and finalise jobs. Refer to SOP Job Completion and Finalisation.',
    'Message Management' : 'Viewing the message register.',
    'Notification Management' : 'Viewing notification log, register and managing escalations.',
    'Opslog Management' : 'Viewing and entering an Ops Log. Refer to beacon User Guide.',
    'Provider Management' : 'Adding and entering providers i.e. Arborists, councils into the OMS. Refer to SOP Providers and Approved Suppliers.',
    'Reports Management' : 'Generating read only reports.',
    'Rescue Creator': 'Creating Rescue Jobs.',
    'Resource Management' : 'Managing critical resources, including adding and editing them',
    'Restricted Ops Log Management' : 'Ability to restrict Ops logs I.e. due to privacy, sensitive information.',
    'Sector Management' : 'Creating sectors for tasking.',
    'Send Message' : 'Sending Messages i.e. sms or email to members or established contact groups.',
    'Tasking Management' : 'Ability to task teams, sectors, and categorise jobs in the tasking screen.',
    'Team Management' : 'Creation, editing, standing up and down, activating teams etc. Refer to SOG beacon Teams.',
    'Team Jobs Management' : 'Managing jobs that are already tasked, including prioirtising and team completion. Refer to SOP Job Completion & Finalisation and SOG beacon Priority Response and Tasking Categories.',
    'User Creator' : 'Create Users for beacon, Refer to SOP beacon User Permissions.',
    'User Management' : 'Manage Users i.e. reset password refer to SOP beacon User Permissions.',
    'People Management' : 'Manage People i.e. external, add create delete.',
    'Icems Management' : 'Manage ICEMS response, send IAR and other messages.'
  };

  $targetElements.each(function(_v){

    var $t = $(this);

    // ICEMS Dictionary
    _.each(role_Dictionary, function(clearText, abbrText){
      if (abbrText == $t.text())
      {
        $t.attr('title',clearText)
      }
    });


  });
}
