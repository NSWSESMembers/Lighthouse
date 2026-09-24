/**
 * pushNotificationMapping.js
 *
 * Remaps a Beacon jobCreated/jobUpdated/jobRejected push notification (a
 * Notification record) into the field shape Job.js/getOrCreateJob expects.
 * Extracted from main.js's VM(); both already pure given their explicit
 * params.
 */

/**
 * jobCreated/jobUpdated/jobRejected's actual payload is a Notification
 * record -- Id is the notification's own id, the job's real id is
 * JobId -- not a job view-model despite the "vm" parameter name in
 * Beacon's own source. Remap to the fields Job.js understands before
 * merging; passing the raw notification straight into getOrCreateJob
 * would key it on the notification's id instead of the job's,
 * silently creating a phantom job entry instead of updating the real
 * one (confirmed live -- this is why status updates weren't landing).
 *
 * @param {object} n  the raw push notification
 * @returns {object}  a partial Job.js-shaped payload
 */
export function mapJobNotificationToJobJson(n) {
    return {
        Id: n.JobId,
        Identifier: n.JobIdentifier,
        ICEMSIncidentIdentifier: n.ICEMSIncidentIdentifier,
        JobPriorityTypeId: n.JobPriorityTypeId,
        JobStatusTypeId: n.JobStatusTypeId,
        EntityAssignedTo: n.Entity,
    };
}

/**
 * JobReceived isn't in any of these notifications at all -- without
 * it, jobMatchesConfigFilters' date check always fails (new
 * Date(null) is epoch, always outside the configured range), so a
 * brand-new admission would get silently evicted instead of
 * admitted. The notification's own CreatedOn is a reasonable proxy.
 * Only applied when not already tracked -- otherwise this would
 * clobber an existing job's real jobReceived with the
 * notification's timestamp. Applies to jobUpdated/jobRejected too,
 * not just jobCreated: a job evicted while "New" (outside the
 * status filter) hits this same first-admission path again the
 * moment a later jobUpdated brings its status back into scope.
 *
 * @param {object} jobJson  mutated in place and returned
 * @param {object} notification  the raw push notification
 * @param {boolean} alreadyTracked
 * @returns {object}  the same jobJson instance
 */
export function withJobReceivedFallback(jobJson, notification, alreadyTracked) {
    if (!alreadyTracked) jobJson.JobReceived = notification.CreatedOn;
    return jobJson;
}
