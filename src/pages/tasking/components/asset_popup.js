

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
                      data-bind="click: $root.openBeaconEditTeam">Edit</button>
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
        mouseenter: $root.drawCrowsFliesToJob,
        mouseleave: $root.removeCrowsFliesToJob
      }, click: $root.drawRouteToJob">
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
