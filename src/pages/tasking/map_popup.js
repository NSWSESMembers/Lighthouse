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
            <tr>
              <td style="padding:4px 8px;border-bottom:1px solid #eee"
                  data-bind="text: teamCallsign"></td>
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
