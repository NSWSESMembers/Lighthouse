export function buildJobPopupKO() {
  return `
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
                   data-bind="textInput: $root.popupTeamFilter, valueUpdate: 'afterkeydown'">
          </li>
          <li><hr class="dropdown-divider"></li>
          <li>
            <div style="max-height: 220px; overflow: auto;"
                 data-bind="foreach: $root.popupFilteredTeams">
              <button type="button" class="dropdown-item text-start py-1"
  data-bind="html:
    '<div><strong>' + (team.callsign() || '') + '</strong>' +
    '<div class=&quot;small text-muted&quot;>' +
      taskings().length + ' tasking(s) &nbsp;•&nbsp; ' +
      (distanceLabel || '-') + ' &nbsp;•&nbsp; ' +
      (bearingLabel || '-') +
    '</div>',
    click: $root.taskTeamToJobWithConfirm">
</button>
            </div>
          </li>
        </ul>
      </div>
    </div>
    <!-- Address -->
    <div class="text-center fw-bold mt-2"
         data-bind="text: (address.prettyAddress && address.prettyAddress()) || ''"></div>

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
      <div class="table-responsive job-popup_taskings">
      <div data-bind="visible: !taskingLoading() && taskings().length > 0" style="padding-top:10px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="text-align:left;background:#f8f9fa">
              <th style="padding:6px 8px;border-bottom:1px solid #ddd">Team</th>
              <th style="padding:6px 8px;border-bottom:1px solid #ddd">Status</th>
              <th style="padding:6px 8px;border-bottom:1px solid #ddd">Updated</th>
              <th style="padding:6px 8px;border-bottom:1px solid #ddd">Actions</th>
            </tr>
          </thead>
          <tbody data-bind="foreach: { data: taskings, afterRender:$root.updatePopup}">
            <tr data-bind="event: {
            mouseenter: $root.drawCrowsFliesToAsset,
            mouseleave: $root.removeCrowsFliesToAsset
            }, click: team.markerFocus, clickBubble: false" class="job-popup__tasking-row" style="cursor:pointer">
              <td style="padding:4px 8px;border-bottom:1px solid #eee"
                  data-bind="text: teamCallsign"></td>
              <td style="padding:4px 8px;border-bottom:1px solid #eee"
                  data-bind="text: currentStatus"></td>
              <td style="padding:4px 8px;border-bottom:1px solid #eee"
                  data-bind="text: statusTimeAgoLabel"></td>
              <td style="padding:4px 8px;border-bottom:1px solid #eee">
                <div class="btn-group btn-group-sm" role="group" aria-label="Tasking actions">               
                  <button type="button" class="btn btn-small btn-outline-secondary"
                      title="Zoom to"
                      data-bind="click: $root.drawRouteToAsset, disable: !team.trackableAssets().length, clickBubble: false">
                      <i class="fa fa-solid fa-car"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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