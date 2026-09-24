/**
 * configFilters.js
 *
 * Job/team admission rules against the Config modal's filter settings.
 * Extracted from main.js's VM() so they can be tested independently of the
 * rest of the tasking page -- both are pure functions of (entity, config).
 */

/**
 * @param {object} jb  a Job view-model
 * @param {object} config  the ConfigVM instance (self.config in main.js)
 * @returns {boolean}
 */
export function jobMatchesConfigFilters(jb, config) {
    const hqIds = new Set((config.incidentFilters() || []).map(f => String(f.id)));
    const sectorIds = new Set((config.sectorFilters() || []).map(s => String(s.id)));

    const allowedStatus = config.jobStatusFilter(); // allow-list
    const allowedStatusSet = new Set(allowedStatus || []);
    const incidentTypeAllowedById = config.allowedIncidentTypeIds(); // allow-list (Set in ConfigVM)
    const incidentTypeIterable =
        incidentTypeAllowedById && typeof incidentTypeAllowedById[Symbol.iterator] === "function"
            ? incidentTypeAllowedById
            : [];
    const incidentTypeSet = new Set(Array.from(incidentTypeIterable, id => String(id)));

    var start = new Date();
    var end = new Date();

    start.setDate(end.getDate() - config.fetchPeriod());

    // Add 5 minutes to the start time just to account for drift
    start.setMinutes(start.getMinutes() + 5);

    end.setDate(end.getDate() + config.fetchForward());

    // Same drift/clock-skew allowance as start, above -- without it, a
    // job admitted via push the instant it's created (jobReceived from
    // the notification's own CreatedOn, essentially "now") sits right
    // on the end boundary, and a few hundred ms of processing lag or
    // any client/server clock skew is enough to flip jobDate > end and
    // evict it (confirmed live: fetchForward=0 gave zero tolerance).
    end.setMinutes(end.getMinutes() + 5);

    const statusName = jb.statusName();
    const jobHqId = String(jb.entityAssignedTo.id());
    const hqMatch = hqIds.size === 0 || hqIds.has(jobHqId);

    // Sector filtering — only when scope includes incidents
    if (config.applySectorsToIncidents() && sectorIds.size > 0) {
        const sectorId = String(jb.sector().id());
        const sectorMatch = sectorIds.has(sectorId);

        //if no sector and config says to exclude, filter out
        if (!jb.sector().id() && config.includeIncidentsWithoutSector() === false) {
            return false;
        }

        if (jb.sector().id() && !sectorMatch) return false;
    }

    // If allow-list non-empty, only show jobs whose status is in it
    if (allowedStatusSet.size > 0 && !allowedStatusSet.has(statusName)) {
        return false;
    }

    // If incident type filter non-empty, only show jobs whose type is in
    // it -- but only reject when we actually know the type. A job built
    // straight from the jobCreated notification has no type information
    // at all (unlike status/priority, there's no id to resolve either),
    // so typeId() is "" until refreshData() backfills it; treating that
    // as "known not to match" would evict every new job whenever any
    // type filter is active. isFilteredIn corrects itself reactively
    // once the real type lands, so being lenient here at admission time
    // costs nothing beyond a job briefly sitting untracked-by-filter.
    const typeId = jb.typeId();
    if (incidentTypeSet.size > 0 && typeId && !incidentTypeSet.has(String(typeId))) {
        return false;
    }

    //date matching
    const jobDate = new Date(jb.jobReceived());

    if (jobDate < start || jobDate > end) {
        return false;
    }

    //must match HQ filter
    if (!hqMatch) return false;

    return true;
}

/**
 * @param {object} tm  a Team view-model
 * @param {object} config  the ConfigVM instance (self.config in main.js)
 * @returns {boolean}
 */
export function teamMatchesConfigFilters(tm, config) {
    const allowed = config.teamStatusFilter(); // allow-list
    const allowedSet = new Set(allowed || []);
    const allowedTypeSet = new Set(config.teamTypeFilter() || []); // allow-list of team type names
    const hqFilterIds = new Set((config.teamFilters() || []).map(f => String(f.id)));
    const applySectorsToTeams = config.applySectorsToTeams();
    const sectorIds = new Set((config.sectorFilters() || []).map(s => String(s.id)));

    var start = new Date();
    var end = new Date();

    start.setDate(end.getDate() - config.fetchPeriod());

    // Add 5 minutes to the start time just to account for drift
    start.setMinutes(start.getMinutes() + 5);

    end.setDate(end.getDate() + config.fetchForward());

    const status = tm.teamStatusType()?.Name;
    const teamHqId = String(tm.assignedTo().id());
    const hqMatch = hqFilterIds.size === 0 || hqFilterIds.has(teamHqId);
    if (status == null) {
        return false;
    }

    // If allow-list non-empty, only show teams whose status is in it
    if (allowedSet.size > 0 && !allowedSet.has(status)) {
        return false;
    }

    // Team type allow-list (Field / Operations / Aviation). Beacon already
    // filters the fetch by TypeIds; this also drops wrong-type teams that
    // arrive via SignalR pushes. Lenient when the type is unknown.
    if (allowedTypeSet.size > 0) {
        const typeName = tm.teamType()?.Name;
        if (typeName && !allowedTypeSet.has(typeName)) {
            return false;
        }
    }

    //must match HQ filter
    if (!hqMatch) {
        return false;
    }

    // Sector filtering — only when scope includes teams
    if (applySectorsToTeams && sectorIds.size > 0) {
        const teamSectorId = String(tm.sector()?.id?.() || '');
        if (teamSectorId && !sectorIds.has(teamSectorId)) return false;
        if (!teamSectorId && config.includeIncidentsWithoutSector() === false) return false;
    }

    const statusDate = tm.statusDate();
    if (statusDate < start || statusDate > end) {
        return false;
    }

    return true;
}

/**
 * Maps a list of human-readable filter descriptions (as stored in
 * ConfigVM's teamStatusFilter()/teamTypeFilter()) to the matching enum ids,
 * dropping any that don't resolve to a known entry.
 *
 * @param {string[]} descriptions
 * @param {Record<string, {Id: number, Name: string, Description: string}>} enumMap
 * @param {'Description'|'Name'} [matchField='Description']
 * @returns {number[]}
 */
export function filterDescriptionsToEnumIds(descriptions, enumMap, matchField = 'Description') {
    return (descriptions || [])
        .map(desc => {
            const entry = Object.values(enumMap).find(e => e[matchField] === desc);
            return entry ? entry.Id : undefined;
        })
        .filter(id => id !== undefined);
}
