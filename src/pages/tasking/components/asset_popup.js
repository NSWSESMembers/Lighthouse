export function buildAssetPopupKO() {
  return `
  <div class="veh-pop" data-bind="with: asset">
    <!-- Header / Title -->
    <div class="veh-pop__title fw-bold mb-1" data-bind="text: name"></div>

    <!-- Meta section -->
    <div class="veh-pop__meta small mb-2">
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

      <div class="veh-pop__coords text-muted" data-bind="visible: latLngText">
        <code data-bind="text: latLngText"></code>
      </div>
    </div>

    <!-- Teams bound to this asset -->
    <div class="veh-pop__teams" data-bind="visible: matchingTeamsInView && matchingTeamsInView().length">
      <hr class="my-2" />
      <div class="fw-bold small mb-1">Team(s)</div>

      <div class="veh-pop__team-list" data-bind="foreach: { data: matchingTeamsInView, as: 'tm' }">
        <div class="veh-pop__team mb-2">
          <!-- Team header row -->
          <div class="d-flex align-items-start justify-content-between">
            <div class="veh-pop__team-title">
              <div class="d-flex align-items-center flex-wrap">
                <strong class="me-2" data-bind="text: tm.callsign"></strong>
                <span class="badge bg-light text-dark border small me-1" data-bind="text: tm.statusName"></span>
              </div>
              <div class="text-muted small" data-bind="visible: tm.filteredTaskings() && tm.filteredTaskings().length">
                Current Taskings: <span data-bind="text: tm.filteredTaskings().length"></span>
              </div>
            </div>

            <div class="ms-2">
              <button class="btn btn-xs btn-outline-secondary"
                      title="Open team"
                      data-bind="click: $root.openBeaconEditTeam">
                Edit
              </button>
            </div>
          </div>

          <!-- Taskings for this team (filtered) -->
          <div class="veh-pop__taskings mt-1"
               data-bind="visible: tm.filteredTaskings() && tm.filteredTaskings().length">
            <div class="overflow-auto veh-pop__taskings-list-frame" style="max-height: 200px;">
              <ul class="list-unstyled veh-pop__tasking-list mb-0"
                  data-bind="foreach: { data: tm.filteredTaskings(), as: 'tsk' }">
                <li class="py-1 px-1 mb-1 border rounded small bg-light"
                    data-bind="event: {
                      mouseenter: $root.drawCrowsFliesToJob,
                      mouseleave: $root.removeCrowsFliesToJob
                    }, click: tsk.job.focusMap, clickBubble: false,
                    css: { 'veh-pop__tasking-item': tsk.hasJob(), 'veh-pop__tasking-item--no-job': !tsk.hasJob() }">
                  <!-- First row: status, job id, type, priority, time -->
                  <div class="d-flex justify-content-between align-items-start">
                    <div class="me-2">
                      <span class="badge me-1" data-bind="text: tsk.currentStatus, class: tsk.tagColorFromStatus()"></span>
                      <strong data-bind="text: tsk.jobIdentifier + ' - ' +tsk.job.entityAssignedTo.code"></strong>
                      <span class="text-muted ms-1" data-bind="text: tsk.jobTypeName"></span>
                      <span class="text-muted ms-1" data-bind="text: tsk.jobPriority"></span>
                    </div>
                    <div class="text-end text-muted ms-2"
                         data-bind="text: tsk.statusTimeAgoLabel"></div>
                  </div>

                  <!-- Second row: address -->
                  <div class="small text-truncate mt-1"
                       data-bind="text: tsk.prettyAddress"></div>

                  <!-- Third row: actions -->
<div class="mt-1 d-flex align-items-start justify-content-between">
  
  <!-- SituationOnScene block -->
  <div class="flex-grow-1 pe-2 small text-muted"
       style="white-space: pre-wrap; line-height: 1.2;"
       data-bind="text: job.situationOnScene">
  </div>

  <!-- Action buttons -->
  <div class="btn-group btn-group-sm ms-1" role="group">
    <button class="btn btn-outline-secondary"
            title="Focus on job"
            data-bind="click: $root.safeJobFocus,
                       disable: !hasJob(),
                       clickBubble:false">
      <i class="fa fa-crosshairs"></i>
    </button>

    <button class="btn btn-outline-secondary"
            title="Open in Beacon"
            data-bind="click: $root.safeJobOpen,
                       disable: !hasJob(),
                       clickBubble:false">
      <i class="fa fa-external-link-alt"></i>
    </button>
  </div>
</div>
                </li>
              </ul>
            </div>
          </div>

          <!-- When no active taskings -->
          <div class="text-muted small"
               data-bind="visible: !tm.filteredTaskings() || tm.filteredTaskings().length === 0">
            No active taskings.
          </div>
        </div>

        <!-- Divider between teams -->
        <hr class="my-2" data-bind="visible: $index() < ($parent.matchingTeams().length - 1)"/>
      </div>
    </div>
  </div>`;
}
