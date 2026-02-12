/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

function safeStr(v) {
    if (v == null) return "";
    try { return String(ko.unwrap(v) ?? ""); } catch { return String(v); }
}

function joinLower(...parts) {
    return parts
        .flatMap(p => (Array.isArray(p) ? p : [p]))
        .map(safeStr)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function joinUpper(...parts) {
    return parts
        .flatMap(p => (Array.isArray(p) ? p : [p]))
        .map(safeStr)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
}

function buildTeamSearchText(t) {
    const members = (() => {
        try {
            const arr = ko.unwrap(t.members) || [];
            return arr.map(m => `${m?.Person?.FirstName ?? ""} ${m?.Person?.LastName ?? ""}`.trim());
        } catch { return []; }
    })();

    const assets = (() => {
        try {
            const arr = ko.unwrap(t.assets) || [];
            return arr.map(a => `${a?.name ?? ""} ${a?.markerLabel ?? ""}`.trim());
        } catch { return []; }
    })();

    return joinLower(
        assets,
        t.callsign,
        t.assignedTo()?.code,
        t.assignedTo()?.name,
        t.teamLeader,
        members,
    );
}

function buildJobSearchText(j) {
    const tagNames = (() => { try { return j.tagsCsv?.(); } catch { return ""; } })();
    const addr = (() => { try { return j.address?.prettyAddress?.(); } catch { return ""; } })();

    return joinLower(
        j.id, j.identifier,
        j.typeName, j.type,
        j.statusName,
        () => { try { return j.entityAssignedTo?.code?.(); } catch { return ""; } },
        () => { try { return j.entityAssignedTo?.name?.(); } catch { return ""; } },
        j.lga,
        j.sectorName,
        addr,
        j.contactFirstName, j.contactLastName, j.contactPhoneNumber,
        j.callerFirstName, j.callerLastName, j.callerPhoneNumber,
        tagNames,
        j.situationOnScene
    );
}

function decorateResults(items) {
    return items.map((r) => ({
        ...r,
        isActive: ko.observable(false),
    }));
}

function parseTokens(input) {
    if (!input) return [];

    const tokens = [];
    const re = /"([^"]+)"|(\S+)/g;
    let m;

    while ((m = re.exec(input)) !== null) {
        tokens.push(m[1] ?? m[2]);
    }

    return tokens;
}

function scoreMatch(haystackLower, needleLower) {
    if (!needleLower) return 0;
    const idx = haystackLower.indexOf(needleLower);
    if (idx === -1) return null;
    // startsWith > includes, then earlier index
    return (idx === 0 ? 1000 : 0) - idx;
}

function uniqById(items, getId) {
    const out = [];
    const seen = new Set();
    for (const x of items || []) {
        const id = getId(x);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(x);
    }
    return out;
}

function safeId(vm) {
    try { return String(vm?.id?.() ?? vm?.id ?? ""); } catch { return ""; }
}

function getTaskedJobsForTeam(teamVm) {
    const ts = ko.unwrap(teamVm?.taskings) ? ko.unwrap(teamVm.taskings) : (teamVm?.taskings?.() || []);
    const jobs = (ts || []).map(t => {
        try { return ko.unwrap(t?.job) || t?.job?.() || t?.job || null; } catch { return null; }
    }).filter(Boolean);
    return uniqById(jobs, safeId);
}

function getTaskedTeamsForJob(jobVm) {
    const ts = ko.unwrap(jobVm?.taskings) ? ko.unwrap(jobVm.taskings) : (jobVm?.taskings?.() || []);
    const teams = (ts || []).map(t => {
        try { return ko.unwrap(t?.team) || t?.team || null; } catch { return null; }
    }).filter(Boolean);
    return uniqById(teams, safeId);
}


export function SpotlightSearchVM({ rootVm, getTeams, getJobs }) {
    const self = this;

    self.query = ko.observable("");
    self.activeIndex = ko.observable(0);
    self.results = ko.observableArray([]);

    // command UI state
    self.isCommandMode = ko.observable(false);
    self.commandName = ko.observable("");
    self.commandStage = ko.observable(""); // "command" | "team" | "incident" | "ready" | "error"
    self.commandHint = ko.observable("");
    self.matchedTeam = ko.observable(null);
    self.matchedJob = ko.observable(null);

    self.matchedTeamText = ko.pureComputed(() => {
        const t = self.matchedTeam();
        if (!t) return "";
        return `${safeStr(t.callsign)} — ${safeStr(t.assignedTo?.()?.name?.())}`;
    });

    self.matchedJobText = ko.pureComputed(() => {
        const j = self.matchedJob();
        if (!j) return "";
        return `${safeStr(j.identifier)} — ${safeStr(j.statusName)} — ${safeStr(j.typeShort)}${safeStr(j.categoriesNameNumberDash)}`;
    });

    // lightweight cache rebuilt when registries change
    let teamIndex = [];
    let jobIndex = [];

    self.positionText = ko.pureComputed(() => {
        const n = self.results().length;
        if (!n) return "";
        const max = n == 20 ? "20+" : n; //hacky but no one will ever count them
        return (self.activeIndex() + 1) + "/" + max;
    });

    function foldTeamTokens(tokens) {
        if (tokens.length < 2) return tokens;

        // try longest-first folding after command token
        for (let i = tokens.length; i > 1; i--) {
            const joined = tokens.slice(1, i).join(" ");
            const m = topMatchesForToken(joined);

            if (m.uniqueTeam) {
                return [tokens[0], joined, ...tokens.slice(i)];
            }
        }

        return tokens;
    }

    function quoteIfNeeded(s) {
        const v = safeStr(s).trim();
        if (!v) return v;
        return /\s/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v;
    }

    function scrollActiveIntoView(idx) {
        const container = document.querySelector('#spotlightResults');
        if (!container) return;

        const el = container.querySelector(`[data-idx="${idx}"]`);
        if (!el) return;

        const cRect = container.getBoundingClientRect();
        const eRect = el.getBoundingClientRect();

        if (eRect.top < cRect.top) {
            el.scrollIntoView({ block: 'nearest' });
        } else if (eRect.bottom > cRect.bottom) {
            el.scrollIntoView({ block: 'nearest' });
        }
    }

    function setActiveByIndex(idx) {
        const arr = self.results();
        const n = arr.length;
        if (!n) {
            self.activeIndex(0);
            return;
        }

        const clamped = Math.max(0, Math.min(n - 1, idx));
        self.activeIndex(clamped);

        for (let i = 0; i < n; i++) {
            arr[i].isActive(i === clamped);
        }

        scrollActiveIntoView(clamped);


    }

    self.isActiveIndex = function (indexFn) {
        try {
            const idx = typeof indexFn === "function" ? indexFn() : Number(indexFn);
            return idx === self.activeIndex();
        } catch (e) {
            return false;
        }
    };

    function rebuildIndex() {
        const teams = getTeams() || [];
        const jobs = getJobs() || [];

        teamIndex = teams.map(t => {
            const members = ko.unwrap(t.members) || [];
            const memberNames = members.map(m => `${m?.Person?.FirstName ?? ""} ${m?.Person?.LastName ?? ""}`.trim());
            const callsign = safeStr(t.callsign);
            const callsignLower = callsign.toLowerCase();

            return ({
                kind: "Team",
                ref: t,
                searchText: buildTeamSearchText(t),
                callsign,
                callsignLower,
                primary: `${callsign} - ${safeStr(t.assignedTo()?.name?.())} - ${safeStr(t.statusName)}`,
                secondary: memberNames.join(", ").trim()
            });
        });

        jobIndex = jobs.map(j => {
            const identifier = safeStr(j.identifier);
            const identifierLower = identifier.toLowerCase();
            return ({
                kind: "Incident",
                ref: j,
                searchText: buildJobSearchText(j),
                identifier,
                identifierLower,
                primary: `${identifier} - ${safeStr(j.typeShort)}${safeStr(j.categoriesNameNumberDash)} - ${safeStr(j.statusName)} - (${safeStr(j.entityAssignedTo?.name?.())})`,
                secondary: joinUpper(
                    (() => { try { return j.address?.prettyAddress?.(); } catch { return ""; } })(),
                    ".",
                    (() => { try { return j.situationOnScene?.(); } catch { return ""; } })()
                ).trim()
            });
        });
    }

    rebuildIndex();

    let timer = null;
    function scheduleSearch() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(runSearch, 40);
    }

    function resetCommandState() {
        self.isCommandMode(false);
        self.commandName("");
        self.commandStage("");
        self.commandHint("");
        self.matchedTeam(null);
        self.matchedJob(null);
    }

    function setCommandState({ name, stage, hint, team, job }) {
        self.isCommandMode(true);
        self.commandName(name || "");
        self.commandStage(stage);
        self.commandHint(hint || "");
        self.matchedTeam(team || null);
        self.matchedJob(job || null);
    }

    self.isOrderlessCommand = ko.pureComputed(() => {
        const c = (self.commandName() || "").toLowerCase();
        return c === "task" || c === "radio";
    });

    self.commandNeedsOnlyJob = ko.pureComputed(() => {
        const c = (self.commandName() || "").toLowerCase();
        return c === "log";
    });

    function topMatchesForToken(tokenLower) {
        const teamMatches = [];
        const jobMatches = [];

        for (const t of teamIndex) {
            const s1 = scoreMatch(t.callsignLower, tokenLower);
            const s2 = scoreMatch(t.searchText, tokenLower);
            const score = Math.max(s1 ?? -999999, s2 ?? -999999);
            if (!tokenLower || score > -999999) teamMatches.push({ item: t, score: tokenLower ? score : 0 });
        }
        teamMatches.sort((a, b) => b.score - a.score);

        for (const j of jobIndex) {
            const s1 = scoreMatch(j.identifierLower, tokenLower);
            const s2 = scoreMatch(j.searchText, tokenLower);
            const score = Math.max(s1 ?? -999999, s2 ?? -999999);
            if (!tokenLower || score > -999999) jobMatches.push({ item: j, score: tokenLower ? score : 0 });
        }
        jobMatches.sort((a, b) => b.score - a.score);

        const uniqueTeam =
            tokenLower &&
                teamMatches.length &&
                teamMatches[0].item.callsignLower === tokenLower
                ? teamMatches[0].item.ref
                : (teamMatches.length === 1 && tokenLower ? teamMatches[0].item.ref : null);

        const uniqueJob =
            tokenLower &&
                jobMatches.length &&
                jobMatches[0].item.identifierLower === tokenLower
                ? jobMatches[0].item.ref
                : (jobMatches.length === 1 && tokenLower ? jobMatches[0].item.ref : null);

        return { teamMatches, jobMatches, uniqueTeam, uniqueJob };
    }

    function commandResultsForTask(raw) {

        let tokens = parseTokens(raw);
        const cmd = (tokens[0] || "").toLowerCase();

        if (cmd === "task" || cmd === "radio") {
            tokens = foldTeamTokens(tokens);
        }

        if (cmd !== "task") return null;

        const aTok = (tokens[1] || "").toLowerCase();
        const bTok = (tokens[2] || "").toLowerCase();

        // No args yet → show teams by default (or you can show both groups)
        if (!tokens[1]) {
            setCommandState({
                name: "task",
                stage: "team",
                hint: "task <team> <incident> (either order) — select first argument",
                team: null,
                job: null
            });

            const { teamMatches } = topMatchesForToken("");
            return decorateResults(
                teamMatches.slice(0, 15).map(({ item: t }) => ({
                    kind: "Team",
                    ref: t.ref,
                    primary: t.primary,
                    secondary: t.secondary,
                    badge: "Team",
                    applyText: `task ${quoteIfNeeded(t.callsign)} `
                }))
            );
        }

        const A = topMatchesForToken(aTok);

        // If only 1 arg provided, decide what user is likely entering and suggest next.
        if (!tokens[2]) {
            const aIsTeam = !!A.uniqueTeam && !A.uniqueJob;
            const aIsJob = !!A.uniqueJob && !A.uniqueTeam;

            if (aIsTeam) {
                setCommandState({
                    name: "task",
                    stage: "incident",
                    hint: `Team matched (${safeStr(A.uniqueTeam.callsign)}). Now select an incident.`,
                    team: A.uniqueTeam,
                    job: null
                });

                const { jobMatches } = topMatchesForToken("");
                return decorateResults(
                    jobMatches.slice(0, 15).map(({ item: j }) => ({
                        kind: "Incident",
                        ref: j.ref,
                        primary: j.primary,
                        secondary: j.secondary,
                        badge: "Incident",
                        applyText: `task ${quoteIfNeeded(A.uniqueTeam.callsign)} ${quoteIfNeeded(j.identifier)}`
                    }))
                );
            }

            if (aIsJob) {
                setCommandState({
                    name: "task",
                    stage: "team",
                    hint: `Incident matched (${safeStr(A.uniqueJob.identifier)}). Now select a team.`,
                    team: null,
                    job: A.uniqueJob
                });

                const { teamMatches } = topMatchesForToken("");
                return decorateResults(
                    teamMatches.slice(0, 15).map(({ item: t }) => ({
                        kind: "Team",
                        ref: t.ref,
                        primary: t.primary,
                        secondary: t.secondary,
                        badge: "Team",
                        applyText: `task ${quoteIfNeeded(A.uniqueJob.identifier)} ${quoteIfNeeded(t.callsign)}`
                    }))
                );
            }

            // Ambiguous first token → show both groups, top-ranked first
            setCommandState({
                name: "task",
                stage: "command",
                hint: "First argument ambiguous — pick team or incident",
                team: null,
                job: null
            });

            const teamRows = A.teamMatches.slice(0, 8).map(({ item: t }) => ({
                kind: "Team",
                ref: t.ref,
                primary: t.primary,
                secondary: t.secondary,
                badge: "Team",
                applyText: `task ${quoteIfNeeded(t.callsign)} `
            }));

            const jobRows = A.jobMatches.slice(0, 8).map(({ item: j }) => ({
                kind: "Incident",
                ref: j.ref,
                primary: j.primary,
                secondary: j.secondary,
                badge: "Incident",
                applyText: `task ${quoteIfNeeded(j.identifier)} `
            }));

            return decorateResults(teamRows.concat(jobRows));
        }

        // Two args supplied: resolve both orders.
        const B = topMatchesForToken(bTok);

        const order1 = { team: A.uniqueTeam, job: B.uniqueJob }; // a=team, b=job
        const order2 = { team: B.uniqueTeam, job: A.uniqueJob }; // a=job, b=team

        const order1Ok = !!order1.team && !!order1.job;
        const order2Ok = !!order2.team && !!order2.job;

        if (order1Ok && !order2Ok) {
            setCommandState({ name: "task", stage: "ready", hint: "Press Enter to task.", team: order1.team, job: order1.job });

            const execRow = [{
                kind: "Execute",
                ref: { cmd: "task", team: order1.team, job: order1.job },
                primary: `Task ${safeStr(order1.job.identifier)} → ${safeStr(order1.team.callsign)}`,
                secondary: "Open confirm tasking modal",
                badge: "Task Team",
                applyText: null
            }];

            return decorateResults(execRow);
        }

        if (order2Ok && !order1Ok) {
            setCommandState({ name: "task", stage: "ready", hint: "Press Enter to task.", team: order2.team, job: order2.job });

            const execRow = [{
                kind: "Execute",
                ref: { team: order2.team, job: order2.job },
                primary: `Task ${safeStr(order2.job.identifier)} → ${safeStr(order2.team.callsign)}`,
                secondary: "Open confirm tasking modal",
                badge: "Task Team",
                applyText: null
            }];

            return decorateResults(execRow);
        }

        if (order1Ok && order2Ok) {
            // Very rare (token A matches both uniquely etc). Force explicit choice.
            setCommandState({
                name: "task",
                stage: "error",
                hint: "Both orders valid — choose the intended pairing below",
                team: null,
                job: null
            });

            const rows = [{
                kind: "Execute",
                ref: { team: order1.team, job: order1.job },
                primary: `Task ${safeStr(order1.job.identifier)} → ${safeStr(order1.team.callsign)}`,
                secondary: "a=team, b=incident",
                badge: "Task Team",
                applyText: null
            }, {
                kind: "Execute",
                ref: { team: order2.team, job: order2.job },
                primary: `Task ${safeStr(order2.job.identifier)} → ${safeStr(order2.team.callsign)}`,
                secondary: "a=incident, b=team",
                badge: "Task Team",
                applyText: null
            }];

            return decorateResults(rows);
        }

        // Not resolvable yet: show suggestions based on what's missing.
        // If A looks like team, suggest incidents filtered by bTok; else if A looks like incident, suggest teams; else show both.
        const aLooksTeam = A.teamMatches[0]?.score > (A.jobMatches[0]?.score ?? -1e9);
        const aLooksJob = A.jobMatches[0]?.score > (A.teamMatches[0]?.score ?? -1e9);

        if (aLooksTeam) {
            setCommandState({
                name: "task",
                stage: "incident",
                hint: "Select an incident (or refine incident token)",
                team: A.uniqueTeam || null,
                job: null
            });

            const rows = B.jobMatches.slice(0, 15).map(({ item: j }) => ({
                kind: "Incident",
                ref: j.ref,
                primary: j.primary,
                secondary: j.secondary,
                badge: "Incident",
                applyText: `task ${quoteIfNeeded((A.uniqueTeam || A.teamMatches[0]?.item?.ref)?.callsign || "")} ${quoteIfNeeded(j.identifier)}`.trim()
            }));

            return decorateResults(rows);
        }

        if (aLooksJob) {
            setCommandState({
                name: "task",
                stage: "team",
                hint: "Select a team (or refine team token)",
                team: null,
                job: A.uniqueJob || null
            });

            const rows = B.teamMatches.slice(0, 15).map(({ item: t }) => ({
                kind: "Team",
                ref: t.ref,
                primary: t.primary,
                secondary: t.secondary,
                badge: "Team",
                applyText: `task ${quoteIfNeeded((A.uniqueJob || A.jobMatches[0]?.item?.ref)?.identifier || "")} ${quoteIfNeeded(t.callsign)}`.trim()
            }));

            return decorateResults(rows);
        }

        setCommandState({
            name: "task",
            stage: "command",
            hint: "Both tokens ambiguous — pick team/incident from suggestions",
            team: null,
            job: null
        });

        const teamRows = B.teamMatches.slice(0, 8).map(({ item: t }) => ({
            kind: "Team",
            ref: t.ref,
            primary: t.primary,
            secondary: t.secondary,
            badge: "Team",
            applyText: `task ${t.callsign} ${tokens[2] || ""}`.trimEnd() + (tokens[2] ? "" : " ")
        }));

        const jobRows = B.jobMatches.slice(0, 8).map(({ item: j }) => ({
            kind: "Incident",
            ref: j.ref,
            primary: j.primary,
            secondary: j.secondary,
            badge: "Incident",
            applyText: `task ${quoteIfNeeded(j.identifier)} ${tokens[2] || ""}`.trimEnd() + (tokens[2] ? "" : " ")
        }));

        return decorateResults(teamRows.concat(jobRows));
    }

    function commandResultsForLog(raw) {
        const tokens = parseTokens(raw);
        const cmd = (tokens[0] || "").toLowerCase();
        if (cmd !== "log") return null;

        const aTok = (tokens[1] || "").toLowerCase();

        // No incident yet → show incident suggestions
        if (!tokens[1]) {
            setCommandState({
                name: "log",
                stage: "incident",
                hint: "log <incident> — select an incident",
                team: null,
                job: null
            });

            const { jobMatches } = topMatchesForToken("");
            return decorateResults(
                jobMatches.slice(0, 15).map(({ item: j }) => ({
                    kind: "Incident",
                    ref: j.ref,
                    primary: j.primary,
                    secondary: j.secondary,
                    badge: "Incident",
                    applyText: `log ${quoteIfNeeded(j.identifier)}`
                }))
            );
        }

        const A = topMatchesForToken(aTok);

        // Unique match → ready to run
        if (A.uniqueJob) {
            setCommandState({
                name: "log",
                stage: "ready",
                hint: "Press Enter to open Ops Log.",
                team: null,
                job: A.uniqueJob
            });

            return decorateResults([{
                kind: "Execute",
                ref: { cmd: "log", job: A.uniqueJob },
                primary: `Ops Log — ${safeStr(A.uniqueJob.identifier)}`,
                secondary: "Open new Ops Log modal",
                badge: "Create Log",
                applyText: null
            }]);
        }

        // Not unique → show filtered incident suggestions
        setCommandState({
            name: "log",
            stage: "incident",
            hint: "Select an incident (or refine token)",
            team: null,
            job: null
        });

        return decorateResults(
            A.jobMatches.slice(0, 15).map(({ item: j }) => ({
                kind: "Incident",
                ref: j.ref,
                primary: j.primary,
                secondary: j.secondary,
                badge: "Incident",
                applyText: `log ${quoteIfNeeded(j.identifier)}`
            }))
        );
    }

    function commandResultsForRadio(raw) {
        let tokens = parseTokens(raw);
        const cmd = (tokens[0] || "").toLowerCase();

        if (cmd === "task" || cmd === "radio") {
            tokens = foldTeamTokens(tokens);
        }
        if (cmd !== "radio") return null;

        const aTok = (tokens[1] || "").toLowerCase();
        const bTok = (tokens[2] || "").toLowerCase();

        // no args -> teams first (same UX as task)
        if (!tokens[1]) {
            setCommandState({
                name: "radio",
                stage: "team",
                hint: "radio <team> <incident> (either order) — select first argument",
                team: null,
                job: null
            });

            const { teamMatches } = topMatchesForToken("");
            return decorateResults(
                teamMatches.slice(0, 15).map(({ item: t }) => ({
                    kind: "Team",
                    ref: t.ref,
                    primary: t.primary,
                    secondary: t.secondary,
                    badge: "Team",
                    applyText: `radio ${quoteIfNeeded(t.callsign)} `
                }))
            );
        }

        const A = topMatchesForToken(aTok);

        // one arg only -> decide likely side and show other-side suggestions with tasking-first ordering
        if (!tokens[2]) {
            const aIsTeam = !!A.uniqueTeam && !A.uniqueJob;
            const aIsJob = !!A.uniqueJob && !A.uniqueTeam;

            if (aIsTeam) {
                const team = A.uniqueTeam;

                setCommandState({
                    name: "radio",
                    stage: "incident",
                    hint: `Team matched (${safeStr(team.callsign)}). Now select an incident.`,
                    team,
                    job: null
                });

                const preferred = new Set(getTaskedJobsForTeam(team).map(j => safeId(j)));
                const { jobMatches } = topMatchesForToken(""); // allow anything

                const pref = [];
                const rest = [];
                for (const { item: j } of jobMatches) {
                    (preferred.has(safeId(j.ref)) ? pref : rest).push(j);
                }

                const rows = pref.concat(rest).slice(0, 20).map((j) => ({
                    kind: "Incident",
                    ref: j.ref,
                    primary: j.primary,
                    secondary: j.secondary,
                    badge: preferred.has(safeId(j.ref)) ? "Active Tasking" : "Incident",
                    applyText: `radio ${quoteIfNeeded(team.callsign)} ${quoteIfNeeded(j.identifier)}`
                }));

                return decorateResults(rows);
            }

            if (aIsJob) {

                setCommandState({
                    name: "radio",
                    stage: "team",
                    hint: `Incident matched (${safeStr(A.uniqueJob.identifier)}). Now select a team.`,
                    team: null,
                    job: A.uniqueJob
                });

                const preferred = new Set(getTaskedTeamsForJob(A.uniqueJob).map(t => safeId(t)));
                const { teamMatches } = topMatchesForToken(""); // allow anything

                const pref = [];
                const rest = [];
                for (const { item: t } of teamMatches) {
                    (preferred.has(safeId(t.ref)) ? pref : rest).push(t);
                }

                const rows = pref.concat(rest).slice(0, 20).map((t) => ({
                    kind: "Team",
                    ref: t.ref,
                    primary: t.primary,
                    secondary: t.secondary,
                    badge: preferred.has(safeId(t.ref)) ? "Active Tasking" : "Team",
                    applyText: `radio ${quoteIfNeeded(job.identifier)} ${quoteIfNeeded(t.callsign)}`
                }));

                return decorateResults(rows);
            }

            // ambiguous first token -> show both lists (no special ordering yet)
            setCommandState({
                name: "radio",
                stage: "command",
                hint: "Pick a team or incident",
                team: null,
                job: null
            });

            const teamRows = A.teamMatches.slice(0, 8).map(({ item: t }) => ({
                kind: "Team",
                ref: t.ref,
                primary: t.primary,
                secondary: t.secondary,
                badge: "Team",
                applyText: `radio ${quoteIfNeeded(t.callsign)} `

            }));

            const jobRows = A.jobMatches.slice(0, 8).map(({ item: j }) => ({
                kind: "Incident",
                ref: j.ref,
                primary: j.primary,
                secondary: j.secondary,
                badge: "Incident",
                applyText: `radio ${quoteIfNeeded(j.identifier)} `

            }));

            return decorateResults(teamRows.concat(jobRows));
        }

        // two args -> resolve either order like task, but execute radio when both unique
        const B = topMatchesForToken(bTok);

        const team = A.uniqueTeam || B.uniqueTeam || null;
        const job = A.uniqueJob || B.uniqueJob || null;

        if (team && job) {
            setCommandState({
                name: "radio",
                stage: "ready",
                hint: "Press Enter to open Radio Log.",
                team,
                job
            });

            return decorateResults([{
                kind: "Execute",
                ref: { cmd: "radio", team, job },
                primary: `Radio Log — ${safeStr(team.callsign)} / ${safeStr(job.identifier)}`,
                secondary: "Open radio log modal",
                badge: "Create Log",
                applyText: null
            }]);
        }

        // not resolvable yet -> whichever side is known, reorder suggestions with tasked-first
        if (team && !job) {
            setCommandState({
                name: "radio",
                stage: "incident",
                hint: "Select an incident (tasked ones are shown first)",
                team,
                job: null
            });

            const preferred = new Set(getTaskedJobsForTeam(team).map(j => safeId(j)));
            const { jobMatches } = topMatchesForToken(bTok);

            const pref = [];
            const rest = [];
            for (const { item: j } of jobMatches) (preferred.has(safeId(j.ref)) ? pref : rest).push(j);

            return decorateResults(
                pref.concat(rest).slice(0, 20).map((j) => ({
                    kind: "Incident",
                    ref: j.ref,
                    primary: j.primary,
                    secondary: j.secondary,
                    badge: preferred.has(safeId(j.ref)) ? "Tasked" : "Incident",
                    applyText: `radio ${quoteIfNeeded(team.callsign)} ${quoteIfNeeded(j.identifier)}`
                }))
            );
        }

        if (job && !team) {
            setCommandState({
                name: "radio",
                stage: "team",
                hint: "Select a team (tasked ones are shown first)",
                team: null,
                job
            });

            const preferred = new Set(getTaskedTeamsForJob(job).map(t => safeId(t)));
            const { teamMatches } = topMatchesForToken(bTok);

            const pref = [];
            const rest = [];
            for (const { item: t } of teamMatches) (preferred.has(safeId(t.ref)) ? pref : rest).push(t);

            return decorateResults(
                pref.concat(rest).slice(0, 20).map((t) => ({
                    kind: "Team",
                    ref: t.ref,
                    primary: t.primary,
                    secondary: t.secondary,
                    badge: preferred.has(safeId(t.ref)) ? "Tasked" : "Team",
                    applyText: `radio ${quoteIfNeeded(job.identifier)} ${quoteIfNeeded(t.callsign)}`
                }))
            );
        }

        // still ambiguous -> show both token suggestions
        setCommandState({
            name: "radio",
            stage: "command",
            hint: "Both tokens ambiguous — pick team/incident",
            team: null,
            job: null
        });

        const teamRows = B.teamMatches.slice(0, 8).map(({ item: t }) => ({
            kind: "Team",
            ref: t.ref,
            primary: t.primary,
            secondary: t.secondary,
            badge: "team",
            applyText: `radio ${quoteIfNeeded(t.callsign)} ${tokens[2] || ""}`.trimEnd() + (tokens[2] ? "" : " ")
        }));

        const jobRows = B.jobMatches.slice(0, 8).map(({ item: j }) => ({
            kind: "Incident",
            ref: j.ref,
            primary: j.primary,
            secondary: j.secondary,
            badge: "Incident",
            applyText: `radio ${quoteIfNeeded(j.identifier)} ${tokens[2] || ""}`.trimEnd() + (tokens[2] ? "" : " ")
        }));

        return decorateResults(teamRows.concat(jobRows));
    }



    function runSearch() {
        const prev = self.results()[self.activeIndex()];
        const prevId = prev?.ref ? safeId(prev.ref) : null;

        const raw = (self.query() || "");

        // Autocomplete for partial command keywords
        const commandKeywords = ["task", "log", "radio"];
        const q = raw.trim().toLowerCase();
        let autocompleteResults = [];
        if (q && !raw.includes(" ")) {
            const suggestions = [];
            for (const cmd of commandKeywords) {
                if (cmd.startsWith(q) && cmd !== q) {
                    suggestions.push({
                        kind: "Autocomplete",
                        ref: { cmd },
                        primary: `Complete command: ${cmd}`,
                        secondary: "Press Enter to autocomplete",
                        badge: "Command",
                        applyText: cmd + " "
                    });
                }
            }
            autocompleteResults = decorateResults(suggestions);
        }

        const cmdResults =
            commandResultsForTask(raw) ||
            commandResultsForLog(raw) ||
            commandResultsForRadio(raw);

        if (cmdResults) {
            // Prepend autocomplete suggestions if present
            self.results(autocompleteResults.concat(cmdResults));

            const idx = prevId
                ? cmdResults.findIndex(r => safeId(r.ref) === prevId)
                : -1;

            setActiveByIndex(idx >= 0 ? idx : 0);
            return;
        }

        resetCommandState();

        const scored = [];

        const consider = (x) => {
            const idx = x.searchText.indexOf(q);
            if (idx === -1) return;
            scored.push({ ...x, score: (idx === 0 ? 1000 : 0) - idx });
        };

        jobIndex.forEach(consider);
        teamIndex.forEach(consider);

        scored.sort((a, b) => b.score - a.score);

        const decorated = decorateResults(scored.slice(0, 20));
        self.results(autocompleteResults.concat(decorated));

        const idx = prevId
            ? decorated.findIndex(r => safeId(r.ref) === prevId)
            : -1;

        setActiveByIndex(idx >= 0 ? idx : 0);
    }


    self.query.subscribe(scheduleSearch);

    function executeTask(teamVm, jobVm) {
        if (!teamVm || !jobVm) return;
        rootVm._closeSpotlight?.();
        // NOTE: signature is (jobVm, teamVm)
        rootVm.showConfirmTaskingModal?.(jobVm, teamVm);
    }

    function executeLog(jobVm) {
        if (!jobVm) return;
        rootVm._closeSpotlight?.();
        rootVm.attachNewOpsLogModal?.(jobVm);
    }

    function executeRadio(teamVm, jobVm) {
        if (!teamVm || !jobVm) return;
        rootVm._closeSpotlight?.();
        rootVm.attachJobRadioLogModalByTeamAndIncident?.(jobVm.id?.(), safeStr(teamVm.callsign));
    }

    self.openResult = (r) => {
        console.log(r)
        if (!r) return;


            if (r.kind === "Autocomplete" && r.ref?.cmd) {
                self.query(r.ref.cmd + " ");
                return;
            }


        // Command-mode rows
        if (self.isCommandMode()) {
            if (r.kind === "Execute") {
                if (r.ref?.cmd === "log" && r.ref?.job) { executeLog(r.ref.job); return; }
                if (r.ref?.cmd === "radio" && r.ref?.team && r.ref?.job) { executeRadio(r.ref.team, r.ref.job); return; }
                if (r.ref?.cmd === "task" && r.ref?.team && r.ref?.job) { executeTask(r.ref.team, r.ref.job); return; }
            }

            if (r.applyText) {
                self.query(r.applyText);
                // keep spotlight open; query subscription will refresh results
                return;
            }
            // Fallback: if clicking on Team/Incident result without applyText, still apply
            if (r.kind === "Team" && r.ref?.callsign) {
                self.query(`task ${quoteIfNeeded(r.ref.callsign)} `);
                return;
            }
            if (r.kind === "Incident" && r.ref?.identifier) {
                const cmd = (self.commandName() || "").toLowerCase();

                if (cmd === "task") {
                    const t = self.matchedTeam();
                    const tcs = t?.callsign?.() || safeStr(t?.callsign) || "";
                    if (tcs) self.query(`task ${tcs} ${quoteIfNeeded(r.ref.identifier)}`);
                    return;
                }

                if (cmd === "log") {
                    self.query(`log ${quoteIfNeeded(r.ref.identifier)}`);
                    return;
                }

                return;
            }
            return;
        }

        // Normal-mode open
        if (!r?.ref) return;

        rootVm._closeSpotlight?.();

        if (r.kind === "Team") {
            r.ref.toggleAndExpand?.();
            r.ref.markerFocus?.();
        } else {
            r.ref.focusMap?.();
        }
    };

    self.onInputKeyDown = (_, e) => {
        const key = e.key;

        if (key === "ArrowDown") {
            e.preventDefault();
            setActiveByIndex(self.activeIndex() + 1);
            return true;
        }
        if (key === "ArrowUp") {
            e.preventDefault();
            setActiveByIndex(self.activeIndex() - 1);
            return true;
        }
        if (key === "Enter") {
            e.preventDefault();

            if (self.isCommandMode() && self.commandStage() === "ready") {
                const cmd = (self.commandName() || "").toLowerCase();

                if (cmd === "task") {
                    const t = self.matchedTeam();
                    const j = self.matchedJob();
                    if (t && j) { executeTask(t, j); return true; }
                }

                if (cmd === "log") {
                    const j = self.matchedJob();
                    if (j) { executeLog(j); return true; }
                }

                if (cmd === "radio") {
                    const t = self.matchedTeam();
                    const j = self.matchedJob();
                    if (t && j) { executeRadio(t, j); return true; }
                }

            }

            const r = self.results()[self.activeIndex()];
            if (r) self.openResult(r);
            return true;
        }

        if (key === "Escape") {
            e.preventDefault();
            rootVm._closeSpotlight?.();
            return true;
        }

        return true;
    };

    // called by root when new data arrives
    self.rebuildIndex = () => {
        const prev = self.results()[self.activeIndex()];
        const prevId = prev?.ref ? safeId(prev.ref) : null;

        rebuildIndex();
        runSearch(prevId);
    };
}
