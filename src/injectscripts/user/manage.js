/* global _, $, vm */
vm.pagedList.subscribe(lighthouseKeeper);

function lighthouseKeeper() {
  whenPageIsReady(function () {
    //check theres stuff in it because windows is weird
    console.log('Adding tool text');

    //Mouseover for permission spans to give a basic descrition.

    var $targetElementsSelected = $(
      'div[data-bind="foreach: RolesForAuthorizationZone"] span',
    );

    var $targetElements = $(
      'span[data-bind="style: {\'opacity\': $root.canManageUserRoles($parent) ? 1 : 0.5}, click: $root.addRole.bind($data, $parent)"]',
    );

    var role_Dictionary = {
      'Accreditation Management':
        'Vertical Rescue, Community First Responder, General Land Rescue and Flood Rescue Level 3 accreditation management. Refer to SOP beacon HQ Availability and Accreditation.',
      'Ontactgroups Management':
        'Creation and editing of contact groups. Refer to SOP beacon Contact Groups.',
      'Deployment Management':
        'Creating and editing of deployments and redeployments. Refer to SOP beacon Deployments.',
      'Event Management':
        'Creating, editing and closing Events, which capture jobs for reporting. Refer to SOP Event Creation.',
      'Externalpeople Management':
        'Creating, editing and removing external people i.e. RFS, Police Liaison, who are required to be tasked to teams in assistance of the NSW SES. Refer to SOP External People Management.',
      'Headquarters Management':
        'Management of HQ Status - Monitoring or Not Monitoring. Refer to SOP beacon HQ Availability and Accreditation.',
      'Job Creator': 'Creation of Jobs. Refer to beacon User Guide.',
      'Job Management':
        'Acknowledge, reject, recce’d, complete and finalise jobs. Refer to SOP Job Completion and Finalisation.',
      'Message Management': 'Viewing the message register.',
      'Notification Management':
        'Viewing notification log, register and managing escalations.',
      'Opslog Management':
        'Viewing and entering an Ops Log. Refer to beacon User Guide.',
      'Provider Management':
        'Adding and entering providers i.e. Arborists, councils into the OMS. Refer to SOP Providers and Approved Suppliers.',
      'Reports Management': 'Generating read only reports.',
      'Rescue Creator': 'Creating Rescue Jobs.',
      'Resource Management':
        'Managing critical resources, including adding and editing them',
      'Restricted Opslog Management':
        'Ability to restrict Ops logs I.e. due to privacy, sensitive information.',
      'Sector Management': 'Creating sectors for tasking.',
      'Send Message':
        'Sending Messages i.e. sms or email to members or established contact groups.',
      'Tasking Management':
        'Ability to task teams, sectors, and categorise jobs in the tasking screen.',
      'Team Management':
        'Creation, editing, standing up and down, activating teams etc. Refer to SOG beacon Teams.',
      'Teamjobs Management':
        'Managing jobs that are already tasked, including prioirtising and team completion. Refer to SOP Job Completion & Finalisation and SOG beacon Priority Response and Tasking Categories.',
      'User Creator':
        'Create Users for beacon, Refer to SOP beacon User Permissions.',
      'User Management':
        'Manage Users i.e. reset password refer to SOP beacon User Permissions.',
      'People Management': 'Manage People i.e. external, add create delete.',
      'Icems Management': 'Manage ICEMS response, send IAR and other messages.',
    };

    $targetElements.each(function (_v) {
      var $t = $(this);

      //Dictionary
      _.each(role_Dictionary, function (clearText, abbrText) {
        if (abbrText == $t.text()) {
          $t.attr('title', clearText);
        }
      });
    });

    $targetElementsSelected.each(function (_v) {
      var $t = $(this);
      // ICEMS Dictionary
      _.each(role_Dictionary, function (clearText, abbrText) {
        if (abbrText == $t.text()) {
          $t.attr('title', clearText);
        }
      });
    });
  });
}

function whenPageIsReady(cb) {
  //when external vars have loaded
  var waiting = setInterval(function () {
    //run every 1sec until we have loaded the page (dont hate me Sam)
    if ((typeof vm != 'undefined') & (vm.pagedList.peek().length > 0)) {
      console.log('vm is ready');
      clearInterval(waiting); //stop timer
      cb(); //call back
    }
  }, 200);
}
