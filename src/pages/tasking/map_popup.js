export function buildJobPopupKO() {
<<<<<<< Updated upstream
    return `
=======
  return `
>>>>>>> Stashed changes
  <div class="job-popup" data-bind="with: job, draggableRow: { data: job, kind: 'job' }" draggable="true">
    <!-- Header -->
    <div id="jobIdentifier"
         class="fw-bold text-center"
         style="color:white;background: black"
         data-bind="text: identifier"></div>
    <div id="jobType"
         class="fw-bold text-center"
         style="color:white;"
         data-bind="style: { backgroundColor: bannerBGColour},
                    text: typeName() + ' - ' + statusName()"></div>

    <div id="jobPriority"
         class="text-center"
         style="color:white;"
         data-bind="style: { backgroundColor: bannerBGColour}">
      <span id="priAndCat"
            data-bind="text: priorityName +' '+categoriesName"></span>
    </div>
<<<<<<< Updated upstream

=======
<!-- Assign to Team Dropdown -->
    <div class="text-center mt-2">
      <div class="dropdown d-inline-block">
        <button class="btn btn-sm btn-primary dropdown-toggle" type="button" id="assignTeamBtn"
                data-bs-toggle="dropdown" aria-expanded="false">
          Assign to Team
        </button>
        <ul class="dropdown-menu dropdown-menu-end p-2" aria-labelledby="assignTeamBtn" style="min-width: 260px;">
          <li class="mb-2">
            <input type="text"
                   class="form-control form-control-sm"
                   placeholder="Filter teams…"
                   data-bind="textInput: $root.vm.popupTeamFilter, valueUpdate: 'afterkeydown'">
          </li>
          <li><hr class="dropdown-divider"></li>
          <li>
            <div style="max-height: 220px; overflow: auto;"
                 data-bind="foreach: $root.vm.popupFilteredTeams">
              <button type="button" class="dropdown-item"
                      data-bind="text: callsign, click: $root.vm.assignJobToPopup"></button>
            </div>
          </li>
        </ul>
      </div>
    </div>
>>>>>>> Stashed changes
    <!-- Address -->
    <div class="text-center fw-bold mt-2"
         data-bind="text: (address.prettyAddress && address.prettyAddress()) || (address.short && address.short()) || ''"></div>

    <div id="JobDetails" style="padding-top:10px;width:100%;margin:auto">
      <!-- SoS -->
      <div id="JobSoS" class="text-center" data-bind="visible: !!situationOnScene(), text: situationOnScene"></div>
      <div class="text-center" data-bind="visible: !situationOnScene()"><i>No situation on scene available.</i></div>

      <!-- Tags -->
      <div id="JobTags" class="text-center pt-2" data-bind="text: tagsCsv()"></div>

      <!-- Taskings: loading / table / empty -->
      <div class="text-center p-2" data-bind="visible: taskingLoading()">
        <div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>
        <span class="ms-1">Loading taskings…</span>
      </div>

      <div data-bind="visible: !taskingLoading() && taskings().length > 0" style="padding-top:10px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="text-align:left;background:#f8f9fa">
              <th style="padding:6px 8px;border-bottom:1px solid #ddd">Team</th>
              <th style="padding:6px 8px;border-bottom:1px solid #ddd">Status</th>
              <th style="padding:6px 8px;border-bottom:1px solid #ddd">Updated</th>
            </tr>
          </thead>
          <tbody data-bind="foreach: taskings">
<<<<<<< Updated upstream
            <tr>
              <td style="padding:4px 8px;border-bottom:1px solid #eee"
                  data-bind="text: teamCallsign"></td>
=======
            <tr data-bind="event: {
            mouseenter: drawLineToJob,
            mouseleave: removeLine
            }, click: drawRoute" class="job-popup__tasking-row" style="cursor:pointer">
              <td style="padding:4px 8px;border-bottom:1px solid #eee"
                  data-bind="text: teamCallsign, click: team.markerFocus, clickBubble: false"></td>
>>>>>>> Stashed changes
              <td style="padding:4px 8px;border-bottom:1px solid #eee"
                  data-bind="text: currentStatus"></td>
              <td style="padding:4px 8px;border-bottom:1px solid #eee"
                  data-bind="text: statusSetAt"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="text-center text-muted" data-bind="visible: !taskingLoading() && taskings().length === 0">
        No taskings yet.
      </div>

      <!-- Link -->
      <div class="text-center pt-2">
        <a target="_blank" rel="noopener noreferrer"
           data-bind="attr: { href: jobLink }">View Job Details</a>
      </div>

      <!-- Footer -->
      <span style="font-weight:bold;font-size:smaller;display:block;text-align:center">
        <hr style="height:1px;margin-top:5px;margin-bottom:5px">
        <span data-bind="text: 'Received at ' + receivedAt"></span><br>
        <span data-bind="text: entityAssignedTo.name"></span>
      </span>
    </div>
  </div>`;
}
<<<<<<< Updated upstream
=======

export function buildAssetPopupKO() {
  return `
  <div class="veh-pop" data-bind="with: asset">
    <div class="veh-pop__title" data-bind="text: name"></div>

    <div class="veh-pop__meta">
      <div data-bind="visible: entity || capability">
        <span data-bind="text: entity"></span>
        <span data-bind="visible: entity && capability">&nbsp;•&nbsp;</span>
        <span data-bind="text: capability"></span>
      </div>

      <div data-bind="visible: licensePlate">
        Rego:&nbsp;<strong data-bind="text: licensePlate"></strong>
      </div>

      <div data-bind="visible: lastSeenText">
        Last seen:&nbsp;<span data-bind="text: lastSeenText"></span>
      </div>

      <div data-bind="visible: talkgroup">
        TG:&nbsp;<strong data-bind="text: talkgroup"></strong>
        <small data-bind="visible: talkgroupLastUpdatedText">
          &nbsp;(<span data-bind="text: talkgroupLastUpdatedText"></span>)
        </small>
      </div>

      <div class="veh-pop__coords" data-bind="visible: latLngText">
        <code data-bind="text: latLngText"></code>
      </div>
    </div>

    <!-- Teams bound to this asset -->
    <div class="veh-pop__teams" data-bind="visible: matchingTeams && matchingTeams().length">
      <hr class="my-2" />
      <div class="fw-bold small mb-1">Team(s)</div>

      <div class="veh-pop__team-list" data-bind="foreach: { data: matchingTeams, as: 'tm' }">
        <div class="veh-pop__team">
          <div class="d-flex align-items-center justify-content-between">
            <div class="veh-pop__team-title">
                <strong data-bind="text: tm.callsign"></strong>
              </a>
              <span class="text-muted small ms-2" data-bind="text: tm.statusName"></span>
              <span class="text-muted small ms-2" data-bind="text: tm.teamLeader"></span>
            </div>
            <div>
              <button class="btn btn-xs btn-outline-secondary"
                      title="Open team"
                      data-bind="click: tm.editTasking">Edit</button>
            </div>
          </div>

          <!-- Taskings for this team (filtered) -->
          <div class="veh-pop__taskings mt-1"
               data-bind="visible: tm.filteredTaskings() && tm.filteredTaskings().length">
            <div class="small text-muted mb-1">
              Taskings (<span data-bind="text: tm.filteredTaskings().length"></span>)
            </div>

            <ul class="list-unstyled veh-pop__tasking-list" data-bind="foreach: { data: tm.filteredTaskings(), as: 'tsk' }">
              <li class="veh-pop__tasking-item" data-bind="event: {
        mouseenter: drawLineToJob,
        mouseleave: removeLine
      }, click: tsk.drawRoute">
                <div class="d-flex justify-content-between">
                  <div>
                    <span class="badge bg-secondary me-1" data-bind="text: tsk.currentStatus"></span>
                    <strong data-bind="text: tsk.jobIdentifier"></strong>
                    <span class="text-muted small ms-1" data-bind="text: tsk.jobTypeName"></span>
                    <span class="text-muted small ms-1" data-bind="text: tsk.jobPriority"></span>
                  </div>
                  <div class="text-end small text-muted" data-bind="text: tsk.statusSetAt"></div>
                </div>
                <div class="small text-truncate" data-bind="text: tsk.prettyAddress"></div>
              </li>
            </ul>
          </div>

          <!-- When no active taskings -->
          <div class="text-muted small" data-bind="visible: !tm.filteredTaskings() || tm.filteredTaskings().length === 0">
            No active taskings.
          </div>
        </div>
        <hr class="my-2" data-bind="visible: $index() < ($parent.matchingTeams().length - 1)"/>
      </div>
    </div>
  </div>`;
}
>>>>>>> Stashed changes
