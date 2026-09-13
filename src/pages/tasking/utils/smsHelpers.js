/**
 * smsHelpers.js
 *
 * Recipient list and prefill-text building for the "Send SMS" modal.
 * Extracted from main.js's VM() `attachSendSMSModal`; the modal-show/bootstrap
 * glue stays in main.js, these are just the pure data-prep pieces.
 */

/**
 * @param {object} team  a Team view-model
 * @returns {{id: any, name: string, isTeamLeader: boolean}[]}
 */
export function buildSmsRecipientsFromTeam(team) {
    return team.members().map(t => ({
        id: t.Person.Id,
        name: t.Person.FirstName + ' ' + t.Person.LastName,
        isTeamLeader: t.TeamLeader,
    }));
}

/**
 * Prefill when opening the modal from a Tasking (existing job/team pairing).
 * @param {object} tasking
 * @returns {{taskId: any, headerLabel: string, initialText: string}}
 */
export function buildSmsPrefillFromTasking(tasking) {
    return {
        taskId: tasking.job.id(),
        headerLabel: `Send SMS - Incident: ${tasking.job.identifier()}`,
        initialText: `Re: Inc ${tasking.job.identifier()} at ${tasking.job.address.prettyAddress()}: `,
    };
}

/**
 * Prefill when opening the modal from a Job directly (assumed new tasking).
 * @param {object} job
 * @returns {{taskId: any, headerLabel: string, initialText: string}}
 */
export function buildSmsPrefillFromJob(job) {
    const initialText = [
        job.priorityName(),
        job.typeShort() + job.categoriesNameNumberDash(),
        job.entityAssignedTo?.code(),
        job.identifier(),
        job.contactFirstName(),
        job.contactLastName(),
        job.address?.prettyAddress(),
        job.contactPhoneNumber(),
        job.tagsCsv(),
        job.situationOnScene(),
    ]
        .filter(value => value) // Remove empty or undefined values
        .join(' ')
        .toUpperCase();

    return {
        taskId: job.id(),
        headerLabel: `Send SMS - Incident: ${job.identifier()}`,
        initialText,
    };
}
