export function buildJobPopupKO() {
  return `
  <div class="job-popup" data-bind="with: job, draggableRow: { data: job, kind: 'job' }" draggable="true">
    <!-- Header -->
    <div id="jobIdentifier"
         class="fw-bold text-center"
         style="color:white;background: black">
         <span class="no-drag" data-bind="text: identifier"></span>
         <em class="fa fa-fw fa-share-alt" data-bind="visible: icemsIncidentIdentifier, attr:{ title: icemsIncidentIdentifier }"></em>
         </div>
    <div id="jobType"
         class="fw-bold text-center"
         style="color:white;"
         data-bind="style: { backgroundColor: bannerBGColour},
                    text: typeName() + ' - ' + statusName()"></div>

    <div id="jobPriority"
         class="text-center"
         style="color:white;"
         data-bind="style: { backgroundColor: bannerBGColour}">
      <span id="priAndCat" data-bind="text: priorityName +' '+categoriesName"></span>
    </div>
    <!-- New line to show tag.Name if actionRequiredTags has length -->
    <div id="actionRequiredTags" class="text-center d-flex flex-wrap mt-1" data-bind="visible: actionRequiredTags().length > 0, foreach: actionRequiredTagsDeduplicated">
        <span data-bind="class: returnTagClass" style="cursor: default; width: 100%;">
          <i data-bind="class: returnTagIcon"></i> <span data-bind="text: name"></span>
        </span>
      </div>
<!-- Assign to Team Dropdown -->
    <div class="text-center mt-2">
      <div class="dropdown d-inline-block">
        <button class="btn btn-small dropdown-toggle btn-outline-primary" type="button" id="assignTeamBtn"
                data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                <i class="fa fa-solid fa-user-plus"></i>

        </button>
        <button type="button" class="btn btn-small btn-outline-secondary"
                      title="Job Timeline"
                      data-bind="click: $root.displayTimelineForJob, clickBubble: false">
                      <i class="fas fa-book"></i>
        </button>
        <button type="button" class="btn btn-small btn-outline-secondary"
                      title="Open In Beacon"
                      data-bind="click: openBeaconJobDetails, clickBubble: false">
                      <i class="fas fa-external-link-alt"></i>
        </button>   
        <button type="button" class="btn btn-small btn-outline-secondary"
                      title="Refresh"
                      data-bind="click: refreshDataAndTasking, clickBubble: false">
                      <i class="fa fa-sync"></i>
                  </button>                 
           <ul class="dropdown-menu dropdown-menu-end p-2  job-taskteam-dropdown"
       data-bind="attr: { id: 'tmAssignTeamMenu-' + $root.job.id, 'aria-labelledby': 'tmAssignTeamBtn-' + $root.job.id }"
       style="min-width: 260px;"
       data-bs-popper="static">
       <li class="mb-2">
           <input type="text"
               class="form-control form-control-sm"
               placeholder="Filter teams…"
               data-bind="textInput: $root.job.instantTask.popupTeamFilter, valueUpdate: 'afterkeydown'">
       </li>
       <li>
           <hr class="dropdown-divider">
       </li>
       <li>
           <div
               style="max-height: 220px; overflow-y: auto; overflow-x: hidden; width: 260px;">
               <!-- ko if: $root.job.instantTask.popupFilteredTeams().length > 0 -->
               <!-- ko foreach: $root.job.instantTask.popupFilteredTeams -->
               <button type="button"
                   class="dropdown-item text-start py-1"
                   data-bind="click: taskTeamToJobWithConfirm, 
                              event: { mouseenter: mouseInTeamInInstantTaskPopup, mouseleave: mouseOutTeamInInstantTaskPopup }">
                   <div>
                       <strong
                           data-bind="text: team.callsign() || ''"></strong>
                   </div>
                   <div class="small text-muted"
                       data-bind="text: currentTaskingSummary()">
                   </div>
                   <div class="small text-muted"
                       data-bind="text: summaryLine">
                   </div>
               </button>
               <!-- /ko -->
               <!-- /ko -->
               <!-- ko if: $root.job.instantTask.popupFilteredTeams().length === 0 -->
               <div class="text-muted text-center py-2">
                   No results found.
               </div>
               <!-- /ko -->
           </div>
       </li>
     </ul>
      </div>
    </div>
    <!-- Address -->
    <div class="text-center fw-bold mt-2"><span class="no-drag" data-bind="text: (address.prettyAddress && address.prettyAddress()) || ''"></span></div>

    <div id="JobDetails" style="padding-top:10px;width:100%;margin:auto">
      <!-- SoS -->
      <div id="JobSoS" class="text-center"><span data-bind="visible: !!situationOnScene(), text: situationOnScene"></span></div>
      <div class="text-center no-drag" data-bind="visible: !situationOnScene()"><i>No situation on scene available.</i></div>

      <!-- Tags -->
      <div id="JobTags" class="text-center d-flex flex-wrap mt-1" data-bind="foreach: tags">
        <span data-bind="class: returnTagClass" style="cursor: default;">
          <i data-bind="class: returnTagIcon"></i> <span data-bind="text: name"></span>
        </span>
      </div>

      <!-- Taskings: loading / table / empty -->
      <div class="table-responsive job-popup_taskings">
      <div data-bind="visible: taskings().length > 0" style="padding-top:10px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="text-align:left;background:#f8f9fa">
              <th style="padding:6px 8px;border-bottom:1px solid #ddd">Team</th>
              <th style="padding:6px 8px;border-bottom:1px solid #ddd">Status</th>
              <th style="padding:6px 8px;border-bottom:1px solid #ddd">Updated</th>
              <th style="padding:6px 8px;border-bottom:1px solid #ddd">Actions</th>
            </tr>
          </thead>
          <tbody data-bind="foreach: { data: sortedTaskings, afterRender:$root.updatePopup}">
            <tr data-bind="event: {
            mouseenter: $root.drawCrowsFliesToAssetFromTasking,
            mouseleave: $root.removeCrowsFlies
            }, click: team.markerFocus,
            clickBubble: false,
            css: { 'job-popup__tasking-row': hasTeam(), 'job-popup__tasking-row--no-job': !hasTeam() }">
              <td style="padding:4px 8px;border-bottom:1px solid #eee"
                  data-bind="text: teamCallsign"></td>
              <td style="padding:4px 8px;border-bottom:1px solid #eee"><span class="badge"
                data-bind="text: currentStatus, css: tagColorFromStatus()"></span></td>
              <td style="padding:4px 8px;border-bottom:1px solid #eee"
                  data-bind="text: statusTimeAgoLabel"></td>
              <td style="padding:4px 8px;border-bottom:1px solid #eee">
                <div class="btn-group btn-group-sm" role="group" aria-label="Tasking actions">               
                  <button type="button" class="btn btn-small btn-outline-secondary"
                      title="Route to Asset"
                      data-bind="click: $root.drawRouteToAsset, disable: !team.trackableAndIsFiltered(), clickBubble: false">
                      <i class="fa fa-solid fa-car"></i>
                  </button>
                  <button type="button" class="btn btn-small btn-outline-secondary"
                      title="Fit Bounds"
                      data-bind="click: $root.fitBoundsWithTasking, disable: !team.trackableAndIsFiltered(), clickBubble: false">
                      <i class="fa fa-solid fa-object-group"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
</div>
      <div class="text-center text-muted" data-bind="visible: taskingLoading()">
        <div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>
        <span class="ms-1">Loading taskings…</span>
      </div>
      <div class="text-center text-muted" data-bind="visible: !taskingLoading() && taskings().length === 0">
        No taskings yet.
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