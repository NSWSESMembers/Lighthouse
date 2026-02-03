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
    // cheap + safe (avoids deep traversals)
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




export function SpotlightSearchVM({ rootVm, getTeams, getJobs }) {
    const self = this;

    self.query = ko.observable("");
    self.activeIndex = ko.observable(0);
    self.results = ko.observableArray([]);

    // lightweight cache rebuilt when registries change
    let teamIndex = [];
    let jobIndex = [];

    self.positionText = ko.pureComputed(() => {
        const n = self.results().length;
        if (!n) return "";
        return (self.activeIndex() + 1) + "/" + n;
    });

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
            return ({
                kind: "Team",
                ref: t,
                searchText: buildTeamSearchText(t),
                primary: `${safeStr(t.callsign)} - ${safeStr(t.assignedTo()?.name?.())} - ${safeStr(t.statusName)}`,
                secondary: memberNames.join(", ").trim()
            })
        })

        jobIndex = jobs.map(j => ({
            kind: "Incident",
            ref: j,
            searchText: buildJobSearchText(j),
            primary: `${safeStr(j.identifier)} - ${safeStr(j.typeShort)}${safeStr(j.categoriesNameNumberDash)} - ${safeStr(j.statusName)} - (${safeStr(j.entityAssignedTo?.name?.())})`,
            secondary: joinUpper((() => { try { return j.address?.prettyAddress?.(); } catch { return ""; } })(), ".", (() => { try { return j.situationOnScene?.(); } catch { return ""; } })()).trim()
        }));
    }

    // call once now; then callers can trigger again as data loads
    rebuildIndex();

    let timer = null;
    function scheduleSearch() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(runSearch, 60);
    }

    function runSearch() {
        const q = (self.query() || "").trim().toLowerCase();
        if (!q) {
            self.results.removeAll();
            self.activeIndex(0);
            return;
        }

        // simple scoring: startsWith > includes
        const scored = [];
        const consider = (x) => {
            const s = x.searchText;
            const idx = s.indexOf(q);
            if (idx === -1) return;
            const score = (idx === 0 ? 1000 : 0) - idx;
            scored.push({ ...x, score });
        };

        teamIndex.forEach(consider);
        jobIndex.forEach(consider);

        scored.sort((a, b) => b.score - a.score);

        const raw = scored.slice(0, 40).map(({ _score, ...r }) => r);
        self.results(decorateResults(raw));
        setActiveByIndex(0);
    }

    self.query.subscribe(scheduleSearch);

    self.openResult = (r) => {
        if (!r?.ref) return;

        // close modal first (Bootstrap owns DOM focus)
        rootVm._closeSpotlight?.();

        // open target
        if (r.kind === "Team") {
            r.ref.toggleAndExpand?.(); //if its a team without an asset still expand it. might be a bit racey?
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
        rebuildIndex();
        runSearch();
    };
}
