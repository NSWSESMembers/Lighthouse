/* global $, _, ko, user, urls, lighthouseUrl */
// Shared "Recent myAvailability Activation Requests" fieldset for the Team
// Create and Team Edit pages.
//
// Lets someone expand a recent activation for the assigned-to unit and click
// a name from its responses straight into the team, instead of only having
// the typeahead search. Built with plain jQuery (no data-bind) since this
// fieldset is inserted at runtime - it was never part of the page's own
// Knockout template, and knockout-secure-binding's restricted parser makes
// wiring ad-hoc bindings onto injected DOM more trouble than it's worth here.
//
// Both pages expose the same Beacon team-form knockout viewmodel - the Team
// Create inject script calls it `teamViewModel`, the Team Edit inject script
// calls it `vm` - so the caller passes whichever one in.

// memberId here is a RegistrationNumber (mams's identifier), not Beacon's
// internal Person.Id, so lookup goes through PersonManager.SearchPeople.
// ViewModelType: 3 (Enum.PeopleViewModelType.Team.Id, same type
// loadPeople() requests) gets back a person shaped correctly to add
// straight to the team, no separate GetPersonById needed. Prefer an
// already-loaded person from teamViewModel.people() when there's a match
// (has isSelected wired up already); otherwise the search result needs
// isSelected manually attached as a ko.observable before addPersonToTeam
// can call person.isSelected(true) on it.
async function addTeamMemberById(teamViewModel, memberId) {
  var matched = _.find(teamViewModel.people(), function (p) { return String(p.RegistrationNumber) === String(memberId); });

  if (!matched) {
    try {
      var searchResponse = await teamViewModel.PersonManager.SearchPeople({ RegistrationNumber: String(memberId), ViewModelType: 2 });
      var data = searchResponse && searchResponse.Results && searchResponse.Results[0];
      if (!data) {
        console.log('lighthouse: could not find person for registration number ' + memberId + ' to add to team');
        return;
      }
      data.isSelected = ko.observable(false);
      matched = data;
    } catch (err) {
      console.log('lighthouse: error looking up person ' + memberId + ' to add to team - ' + (err && err.message));
      return;
    }
  }

  teamViewModel.addPersonToTeam(matched);
}

// The myavailability Lambdas only have data for production Beacon
// (apibeacon.ses.nsw.gov.au) - trainbeacon/devbeacon unit names don't exist
// in that database. Gate on urls.Base so we never send a real request
// outside prod. Same check as jobs/view.js's isProductionBeaconApi().
function isProductionBeaconApi() {
  return typeof urls !== 'undefined' && typeof urls.Base === 'string' &&
    urls.Base.indexOf('apibeacon.ses.nsw.gov.au') !== -1;
}

// Only these three categories make sense to add to a team - mirrors the
// judgement call jobs/view.js already makes for its "Create Team" button
// (Unavailable/Unset responses aren't offered as a one-click add).
var ACTIVATION_PEOPLE_CATEGORIES = [
  { key: 'ActivationAccepted', label: 'Accepted', cssClass: 'lighthouse-activation-people-activationaccepted' },
  { key: 'Available', label: 'Available', cssClass: 'lighthouse-activation-people-available' },
  { key: 'Conditional', label: 'Conditional', cssClass: 'lighthouse-activation-people-conditional' },
];

function fetchUnitActivations(unitName, cb) {
  $.ajax({
    url: 'https://lambda.lighthouse-extension.com/myavailability/unit-activations',
    method: 'GET',
    data: { unitName: unitName },
    beforeSend: function (xhr) { xhr.setRequestHeader('Authorization', 'Bearer ' + user.accessToken); },
    dataType: 'json',
    success: function (data) { cb(null, data); },
    error: function (xhr, status, error) { cb({ status: xhr.status, error: error }); },
  });
}

function fetchActivationResponses(activationId, cb) {
  $.ajax({
    url: 'https://lambda.lighthouse-extension.com/myavailability/incident',
    method: 'GET',
    data: { activationId: activationId },
    beforeSend: function (xhr) { xhr.setRequestHeader('Authorization', 'Bearer ' + user.accessToken); },
    dataType: 'json',
    success: function (data) { cb(null, data); },
    error: function (xhr, status, error) { cb({ status: xhr.status, error: error }); },
  });
}

function formatActivationTime(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// entityAssignedTo().Name is just the town/suburb (e.g. "Parramatta") -
// mams's Unit.name includes the " Unit" suffix (e.g. "Parramatta Unit"), so
// the lookup has to add it back. Guarded in case an entity name ever
// already ends with "Unit" (e.g. some other suffix pattern), so this never
// sends a double "Unit Unit".
function toMamsUnitName(entityName) {
  return /\bunit$/i.test(entityName.trim()) ? entityName.trim() : entityName.trim() + ' Unit';
}

function isMemberAlreadyInTeam(teamViewModel, memberId) {
  return _.some(teamViewModel.members.peek(), function (m) {
    return m.Person && String(m.Person.RegistrationNumber) === String(memberId);
  });
}

function renderActivationPeople(teamViewModel, $panel, activationId) {
  $panel.html('<div class="lighthouse-activation-people-loading">Loading responses&hellip;</div>');

  fetchActivationResponses(activationId, function (err, summary) {
    if (err || !summary) {
      $panel.html('<div class="lighthouse-activation-people-error">Could not load responses.</div>');
      return;
    }

    var categories = summary.categories || {};
    var $groups = $('<div class="lighthouse-activation-people-groups"></div>');

    $.each(ACTIVATION_PEOPLE_CATEGORIES, function (i, cat) {
      var data = categories[cat.key];
      if (!data || !data.Names || !data.Names.length) return;

      var $group = $('<div class="lighthouse-activation-people-group"></div>');
      $group.append(
        $('<div class="lighthouse-activation-people-group-label ' + cat.cssClass + '"></div>')
          .text(cat.label + ' (' + data.Count + ')')
      );

      var $names = $('<ul class="lighthouse-activation-people-names"></ul>');
      $.each(data.Names, function (j, person) {
        var alreadyIn = isMemberAlreadyInTeam(teamViewModel, person.MemberId);
        var $li = $('<li class="lighthouse-activation-person"></li>')
          .attr('data-member-id', person.MemberId)
          .toggleClass('lighthouse-activation-person-added', alreadyIn)
          .text(person.Name);
        $names.append($li);
      });
      $group.append($names);
      $groups.append($group);
    });

    if (!$groups.children().length) {
      $groups = $('<div class="lighthouse-activation-people-empty">No accepted, available or conditional responses yet.</div>');
    }

    $panel.empty().append($groups);
  });
}

function renderActivations(teamViewModel, $list, activations) {
  $list.empty();

  if (!activations || !activations.length) {
    $list.append('<div class="lighthouse-recent-activations-empty">No recent activations for this unit.</div>');
    return;
  }

  $.each(activations, function (i, activation) {
    var $row = $('<div class="lighthouse-recent-activation"></div>');
    var $header = $('<div class="lighthouse-recent-activation-header"></div>');

    $header.append('<span class="lighthouse-recent-activation-toggle-icon fa fa-caret-right"></span>');
    $header.append($('<span class="lighthouse-recent-activation-title"></span>').text(activation.title));
    $header.append($('<span class="lighthouse-recent-activation-time"></span>').text(formatActivationTime(activation.start)));
    if (activation.closedAt) {
      $header.append('<em class="fa fa-lock lighthouse-recent-activation-closed-icon" title="Activation closed"></em>');
    }

    var $panel = $('<div class="lighthouse-recent-activation-panel"></div>').hide();
    var loaded = false;

    $header.on('click', function () {
      var willOpen = !$panel.is(':visible');
      $header.find('.lighthouse-recent-activation-toggle-icon')
        .toggleClass('fa-caret-right', !willOpen)
        .toggleClass('fa-caret-down', willOpen);
      $panel.slideToggle(150);
      if (willOpen && !loaded) {
        loaded = true;
        renderActivationPeople(teamViewModel, $panel, activation.activationId);
      }
    });

    $row.append($header).append($panel);
    $list.append($row);
  });
}

// jobs/view.js's picker modal builds its logo <img> before lighthouseUrl
// (set async via postMessage from the content script) is guaranteed to
// exist yet, then fills the src in once it's ready - same reasoning here.
function whenLighthouseIsReady(cb) {
  if (typeof lighthouseUrl !== 'undefined') {
    cb();
  } else {
    var waiting = setInterval(function () {
      if (typeof lighthouseUrl !== 'undefined') {
        clearInterval(waiting);
        cb();
      }
    }, 200);
  }
}

function initRecentActivationsFieldset(teamViewModel) {
  var isProd = isProductionBeaconApi();

  var $existingFieldset = $('#teamMemberSearch').closest('fieldset');
  if (!$existingFieldset.length) return;

  // Delegated (person rows are added long after this fires, inside an async
  // panel render) - clicking adds via the same addTeamMemberById() the
  // ?lhmembers= prefill path also uses, then checks teamViewModel.members
  // afterwards to confirm it actually landed (addTeamMemberById swallows its
  // own errors - logs and returns - so this is the only way to tell success
  // from a silent lookup failure without changing that function).
  $(document).off('click.lighthouseActivationPerson').on('click.lighthouseActivationPerson', '.lighthouse-activation-person', async function () {
    var $person = $(this);
    if ($person.hasClass('lighthouse-activation-person-added') || $person.hasClass('lighthouse-activation-person-adding')) return;

    var memberId = $person.attr('data-member-id');
    $person.addClass('lighthouse-activation-person-adding');

    await addTeamMemberById(teamViewModel, memberId);

    $person.removeClass('lighthouse-activation-person-adding');
    if (isMemberAlreadyInTeam(teamViewModel, memberId)) {
      $person.addClass('lighthouse-activation-person-added');
    } else {
      $person.addClass('lighthouse-activation-person-error').attr('title', 'Could not add this person - see console for details');
    }
  });

  var $fieldset = $(
    '<fieldset id="lighthouseRecentActivationsFieldset">' +
      '<legend>' +
        '<img id="lighthouseRecentActivationsLogo" style="width:14px;vertical-align:middle;margin-right:5px" />' +
        'Recent myAvailability Activation Requests' +
      '</legend>' +
      '<div class="form-group"><div class="col-xs-12">' +
        (isProd ?
          '<div class="lighthouse-recent-activations-bar">' +
            '<button type="button" class="btn btn-sm btn-primary lighthouse-recent-activations-refresh">' +
              '<span class="fa fa-refresh"></span> <span class="lighthouse-recent-activations-refresh-label">Load activation requests</span>' +
            '</button>' +
          '</div>' : '') +
        '<div class="lighthouse-recent-activations-list">' +
          '<div class="lighthouse-recent-activations-empty">' +
            (isProd ? 'Load the recent myAvailability activation requests for the team’s assigned unit, then expand one to add its responders straight into the team.' :
              'myAvailability activation requests are only available on production Beacon (this is train/dev).') +
          '</div>' +
        '</div>' +
      '</div></div>' +
    '</fieldset>'
  );
  $existingFieldset.before($fieldset);

  whenLighthouseIsReady(function () {
    $fieldset.find('#lighthouseRecentActivationsLogo').attr('src', lighthouseUrl + 'icons/lh-black.png');
  });

  if (!isProd) return; // placeholder only - no mams data outside prod

  var $list = $fieldset.find('.lighthouse-recent-activations-list');
  var $refreshBtn = $fieldset.find('.lighthouse-recent-activations-refresh');
  var $refreshLabel = $refreshBtn.find('.lighthouse-recent-activations-refresh-label');

  // Before the first load the button is a primary call-to-action sitting
  // above the list ("Load activations"); after the first load it shrinks to
  // a plain "Refresh" and tucks up next to the legend, out of the way.
  function markLoaded() {
    if ($refreshBtn.closest('legend').length) return;
    $refreshBtn.removeClass('btn-primary btn-sm').addClass('btn-default btn-xs');
    $refreshLabel.text('Refresh');
    $fieldset.find('legend').append($refreshBtn);
    $fieldset.find('.lighthouse-recent-activations-bar').remove();
  }

  function loadForEntity(entity) {
    // Not every entityAssignedTo is an SES Unit (e.g. a Region or State HQ
    // isn't a row in mams's Unit table) - a 404 here just means "nothing to
    // show for this assignment", not a real failure.
    if (!entity || !entity.Name) {
      $list.html('<div class="lighthouse-recent-activations-empty">Select an Assigned To HQ to see its recent activations.</div>');
      return;
    }

    $list.html('<div class="lighthouse-recent-activations-loading">Loading recent activations&hellip;</div>');

    fetchUnitActivations(toMamsUnitName(entity.Name), function (err, data) {
      if (err) {
        if (err.status === 404) {
          $list.html('<div class="lighthouse-recent-activations-empty">No recent activations for ' + _.escape(entity.Name) + '.</div>');
        } else if (err.status === 409) {
          $list.html('<div class="lighthouse-recent-activations-empty">More than one unit is named ' + _.escape(entity.Name) + ' - can\'t show activations for it.</div>');
        } else {
          $list.html('<div class="lighthouse-recent-activations-error">Could not load recent activations.</div>');
        }
        return;
      }
      renderActivations(teamViewModel, $list, data.activations);
    });
  }

  // Deliberately not auto-loaded on page open - only fetches once a human
  // has clicked Refresh at least once. After that first manual load,
  // though, changing the Assigned To HQ re-fetches automatically so the
  // list doesn't keep showing activations for a unit that's no longer
  // selected.
  var hasLoadedOnce = false;

  $refreshBtn.on('click', function () {
    hasLoadedOnce = true;
    markLoaded();
    loadForEntity(teamViewModel.entityAssignedTo.peek());
  });

  teamViewModel.entityAssignedTo.subscribe(function (entity) {
    if (!hasLoadedOnce) return;
    loadForEntity(entity);
  });
}

module.exports = {
  initRecentActivationsFieldset: initRecentActivationsFieldset,
  addTeamMemberById: addTeamMemberById,
};
