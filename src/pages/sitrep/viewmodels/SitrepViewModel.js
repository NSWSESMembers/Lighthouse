import * as unit from '../../../shared/BeaconClient/unit.js';
import * as sectors from '../../../shared/BeaconClient/sectors.js';
import * as events from '../../../shared/BeaconClient/events.js';
import { friendlyReason } from '../../../shared/friendlyError.js';
import * as tags from '../../../shared/BeaconClient/tags.js';
import * as people from '../../../shared/BeaconClient/people.js';
import { returnTagIcon } from '../../tasking/utils/tagFactory.js';
import sectionSnippetData from '../data/sectionSnippets.json';
import { snippetsForSection, mergeSnippet } from '../lib/snippets.js';
import { sitrepWarnings } from '../lib/sitrepWarnings.js';
import * as operationslog from '../../../shared/BeaconClient/operationslog.js';
import * as entities from '../../../shared/BeaconClient/entities.js';
import { debounce } from '../../tasking/utils/debounce.js';
import { createEntityPicker } from '../lib/entityPicker.js';
import { buildGeneratedBlocks, mergeGeneratedBlock } from '../lib/generatedBlocks.js';
import {
  OPS_LOG_TAG_GROUPS,
  ACTION_ITEMS_GROUP_ID,
  SUBJECT_LIMIT,
  TEXT_LIMIT,
  isDefaultSitrepTag,
  missingDefaultTags,
  buildSitrepOpsLogPayload,
  sitrepOpsLogSubject,
} from '../lib/sitrepOpsLog.js';
import { fetchBomWarnings, buildBomBlock } from '../lib/bomWarnings.js';
import { PERIOD_PRESETS, lastNMinutes, eventRange } from '../lib/periodPresets.js';
import { buildLocationLabel } from '../lib/locationLabel.js';
import { createLinkedDocument } from '../lib/linkedDocument.js';
import { fetchSitrepData } from '../lib/fetchSitrepData.js';
import { computeSitrepReport } from '../lib/computeSitrepReport.js';
import { parseSydneyDateTimeLocal, formatSydney, formatSydneyDateTimeLocal } from '../lib/sydneyTime.js';
import { buildSitrepPreviewText } from '../lib/formatSitrepText.js';
import { SITREP_SECTIONS } from '../lib/sitrepSections.js';

/**
 * @param {object} params
 * @param {string} params.host  Beacon API host
 * @param {string} params.source  Beacon web origin (unused here, kept for symmetry with other pages)
 * @param {string} [params.userId]
 * @param {string} [params.personId]  the logged-in user's Beacon Person id (Prepared By defaults to their name)
 * @param {() => Promise<string>} params.getToken  resolves to a current, non-expired bearer token
 * @param {ko: any} params.ko  the Knockout module (loaded async, like every other Lighthouse page)
 */
export function createSitrepViewModel({ host, userId, personId, getToken, ko }) {
  const self = {};

  self.units = ko.observableArray(); // [{id, name}]
  self.unitLoadError = ko.observable('');

  // Same HQ search/select control as the radio console's HQ filter. A sitrep
  // can span several HQs, so a pick is added to `units` (shown as chips)
  // and the picker is cleared ready for the next one, rather than holding
  // a single selection.
  self.hqPicker = createEntityPicker({
    ko,
    debounce,
    searchEntities: entities.search,
    resolveEntity: unit.getName,
    ctx: () => ctx(),
    onChange: (id, name, entity) => {
      if (id == null) return; // the clear() below re-fires onChange -- nothing to add
      addResolvedUnit(id, name, entity?.EntityTypeId);
      self.hqPicker.clear();
    },
  });

  self.startInput = ko.observable('');
  self.endInput = ko.observable('');

  // Quick periods: "Last N" ending now, or the chosen event's own dates.
  self.periodPresets = PERIOD_PRESETS;
  self.activePeriodPreset = ko.observable('');
  self.periodError = ko.observable('');
  let applyingPreset = false;

  function setPeriod(range) {
    applyingPreset = true;
    self.startInput(formatSydneyDateTimeLocal(range.start));
    self.endInput(formatSydneyDateTimeLocal(range.end));
    applyingPreset = false;
  }

  // typing your own start/end deselects the quick period
  [self.startInput, self.endInput].forEach((obs) =>
    obs.subscribe(() => {
      if (!applyingPreset) self.activePeriodPreset('');
    }),
  );

  self.pickPeriodPreset = function (preset) {
    self.periodError('');
    const now = new Date();
    if (preset.key === 'event') {
      const range = eventRange(selectedEventRecord, now);
      if (!selectedEventRecord) {
        self.periodError('Pick an event above first.');
        return;
      }
      if (!range) {
        self.periodError("Beacon has no start date for that event. Set the start and end yourself.");
        return;
      }
      setPeriod(range);
    } else {
      setPeriod(lastNMinutes(now, preset.minutes));
    }
    self.activePeriodPreset(preset.key);
  };

  self.sectorOptions = ko.observableArray(); // [{Id, Name}]
  self.selectedSectorId = ko.observable('');
  self.eventQuery = ko.observable('');
  self.eventOptions = ko.observableArray(); // [{Id, Name/Identifier}]
  self.selectedEventId = ko.observable('');
  self.selectedEventLabel = ko.observable('');
  let selectedEventRecord = null; // the full Beacon event, for "As Per Event"

  // Header fields (template: Event Name / Event # / Location / Sitrep #)
  self.eventName = ko.observable('');
  self.eventNumber = ko.observable('');
  // Follows the selected HQs (a parent expanded to its children shows as
  // "Parent (n)") until the operator types their own; see linkedDocument.js.
  self.unitParents = ko.observable({}); // childId -> the HQ it was expanded from
  const locationLink = createLinkedDocument({ ko, source: ko.pureComputed(() => buildLocationLabel(self.units(), self.unitParents())) });
  self.location = locationLink.text;
  self.sitrepNumber = ko.observable('1');
  self.sitrepTimeInput = ko.observable(formatSydneyDateTimeLocal(new Date())); // defaults to now

  // One commentary field per SITREP section, in template order -- exposed
  // as a plain array (not a keyed object) so the HTML can `foreach` it
  // directly; each entry also carries its own guidance prompts for display.
  self.sections = SITREP_SECTIONS.map((section) => ({
    key: section.key,
    heading: section.heading,
    prompts: section.prompts,
    text: ko.observable(''),
    // pre-determined content merged in with the + button (data/sectionSnippets.json)
    snippets: snippetsForSection(sectionSnippetData, section.key),
    snippetsOpen: ko.observable(false),
  }));

  self.sections.forEach((section) => {
    // (knockout-secure-binding can't parse a ternary inside data-bind)
    section.ariaExpanded = ko.pureComputed(() => (section.snippetsOpen() ? 'true' : 'false'));
    section.toggleSnippets = () => section.snippetsOpen(!section.snippetsOpen());
    // delay lets a click on a list item land before blur hides the list
    section.closeSnippetsSoon = (_data, event) => {
      const container = event?.currentTarget;
      setTimeout(() => {
        if (!container || !container.contains(document.activeElement)) section.snippetsOpen(false);
      }, 150);
    };
    section.onSnippetKeydown = (_data, event) => {
      if (event.key === 'Escape') {
        section.snippetsOpen(false);
        return false;
      }
      return true;
    };
    section.insertSnippet = (snippet) => {
      section.text(mergeSnippet(section.text(), snippet.text));
      section.snippetsOpen(false);
    };
  });

  const generatedBlocks = {}; // sectionKey -> the block the last generate wrote into that section

  function currentSectionCommentary() {
    return self.sections.reduce((acc, s) => {
      acc[s.key] = s.text();
      return acc;
    }, {});
  }

  // Closing "next situation report" line
  self.nextReportOption = ko.observable('scheduled'); // 'scheduled' | 'none'
  self.nextReportTimeInput = ko.observable('');

  // Quick "next sitrep" times, counted from this sitrep's own date & time.
  self.nextReportQuickAdds = [
    { label: '+30 mins', minutes: 30 },
    { label: '+6 hrs', minutes: 6 * 60 },
    { label: '+12 hrs', minutes: 12 * 60 },
    { label: '+1 day', minutes: 24 * 60 },
  ];
  self.addToNextReport = function (quickAdd) {
    const base = parseSydneyDateTimeLocal(self.sitrepTimeInput()) || new Date();
    self.nextReportOption('scheduled');
    self.nextReportTimeInput(formatSydneyDateTimeLocal(new Date(base.getTime() + quickAdd.minutes * 60000)));
  };

  // Authorisation block
  self.preparedBy = ko.observable('');
  self.preparedByRole = ko.observable('');
  self.approvedBy = ko.observable('');
  self.approvedByRole = ko.observable('');

  self.loading = ko.observable(false);
  self.loadingStatus = ko.observable('');
  self.error = ko.observable('');
  self.report = ko.observable(null);
  self.generatedAt = ko.observable(null);
  self.windowStart = ko.observable(null);
  self.windowEnd = ko.observable(null);

  self.copyStatus = ko.observable('');

  // Include current BOM warnings (NSW/ACT feed) in the Situation section on Get Data.
  // Off by default and not remembered: BOM's servers currently answer the
  // extension's request with 403 (see lib/bomWarnings.js), so it is opt-in each time.
  self.includeBomWarnings = ko.observable(false);
  try {
    window.localStorage.removeItem('lighthouseSitrepIncludeBom'); // an earlier build remembered the choice
  } catch (err) {
    // storage unavailable -- nothing to clear
  }
  // notes about optional extras (e.g. BOM unreachable) shown with Data Status
  self.extraDataIssues = ko.observableArray([]);

  // "Get Data" turns grey once run and back to green when what it would fetch changes.
  const inputSignature = ko.pureComputed(() =>
    JSON.stringify([self.units().map((u) => String(u.id)).sort(), self.startInput(), self.endInput(), self.selectedSectorId() || '', self.selectedEventId() || '', self.includeBomWarnings()]),
  );
  self.lastRunSignature = ko.observable(null);
  self.dataIsCurrent = ko.pureComputed(() => !!self.report() && self.lastRunSignature() === inputSignature());

  // (knockout-secure-binding can't parse a ternary inside data-bind)
  self.getDataTitle = ko.pureComputed(() => (self.dataIsCurrent() ? 'Data is up to date. Click to refresh.' : 'Fetch the Beacon data'));

  self.canGenerate = ko.pureComputed(() => {
    return self.units().length > 0 && !!self.startInput() && !!self.endInput() && !self.loading();
  });

  // What the sitrep would read as, given the fields and report right now.
  const generatedText = ko.pureComputed(() => {
    return buildSitrepPreviewText({
      header: {
        eventName: self.eventName(),
        eventNumber: self.eventNumber(),
        location: self.location(),
        sitrepNumber: self.sitrepNumber(),
        sitrepTime: parseSydneyDateTimeLocal(self.sitrepTimeInput()),
      },
      units: self.units(),
      windowStart: self.windowStart() || parseSydneyDateTimeLocal(self.startInput()),
      windowEnd: self.windowEnd() || parseSydneyDateTimeLocal(self.endInput()),
      generatedAt: self.generatedAt(),
      sectionCommentary: currentSectionCommentary(),
      sectorLabel: currentSectorLabel(),
      eventLabel: self.selectedEventLabel(),
      nextReport: {
        option: self.nextReportOption(),
        time: self.nextReportTimeInput() ? parseSydneyDateTimeLocal(self.nextReportTimeInput()) : null,
      },
      authorisation: {
        preparedBy: self.preparedBy(),
        preparedByRole: self.preparedByRole(),
        approvedBy: self.approvedBy(),
        approvedByRole: self.approvedByRole(),
      },
    });
  });

  // The working sitrep shown (and edited) on the right: follows the
  // fields/report live until the operator types into it, after which their
  // text is kept and "Reset to fields" (doc.reset) is the way back.
  const doc = createLinkedDocument({ ko, source: generatedText });
  self.sitrepText = doc.text;
  self.sitrepEdited = doc.edited;
  self.resetSitrepText = doc.reset;
  // (knockout-secure-binding can't parse a ternary inside data-bind)
  self.sitrepStateLabel = ko.pureComputed(() => (doc.edited() ? 'Edited manually' : 'Live from fields'));

  function currentSectorLabel() {
    const id = self.selectedSectorId();
    if (!id) return '';
    const found = self.sectorOptions().find((s) => String(s.Id) === String(id));
    return found ? found.Name : '';
  }

  async function ctx() {
    const token = await getToken();
    return { host, userId, token };
  }

  // entityType 2 = an HQ that can have child units (same test as LAD's filter chips)
  function pushUnit(id, name, entityType) {
    if (self.units().some((u) => String(u.id) === String(id))) return false;
    self.units.push({ id, name: name || `Unit ${id}`, entityType: entityType ?? 0 });
    return true;
  }

  function addResolvedUnit(id, name, entityType) {
    if (pushUnit(id, name, entityType)) refreshSectorOptions();
  }

  // The tree icon on a chip: adds that HQ's direct child units, as LAD's
  // "Load Children" does (already-added ones are skipped; a child that is
  // itself a parent gets its own tree icon).
  self.loadChildren = async function (parent) {
    self.unitLoadError('');
    try {
      const kids = await entities.children(parent.id, await ctx());
      let added = false;
      const parents = { ...self.unitParents() };
      kids.forEach((c) => {
        if (pushUnit(c.Id, c.Name, c.EntityTypeId)) added = true;
        if (String(c.Id) !== String(parent.id)) parents[c.Id] = parent.id;
      });
      self.unitParents(parents);
      if (added) refreshSectorOptions();
    } catch (err) {
      self.unitLoadError(`Couldn't load the units under "${parent.name}". ${friendlyReason(err)}`);
      console.error('Sitrep: child unit lookup failed', err);
    }
  };

  // For the HQ Lighthouse was launched with: an id, not something typed.
  self.addUnitById = async function (id) {
    self.unitLoadError('');
    try {
      const resolved = await unit.getName(id, await ctx());
      addResolvedUnit(resolved?.Id ?? id, resolved?.Name || resolved?.Code, resolved?.EntityTypeId);
    } catch (err) {
      self.unitLoadError(`Couldn't find your HQ automatically. Add it with the search box instead.`);
      console.error('Sitrep: unit lookup failed', err);
    }
  };

  self.clearUnits = function () {
    self.units.removeAll();
    self.unitParents({});
    self.unitLoadError('');
    refreshSectorOptions();
  };

  self.removeUnit = function (unitToRemove) {
    self.units.remove(unitToRemove);
    refreshSectorOptions();
  };

  // knockout-secure-binding's data-bind parser doesn't support inline
  // function literals (MV3's CSP rules out the default eval-based
  // provider) -- handlers have to be named view model methods.
  async function refreshSectorOptions() {
    self.selectedSectorId('');
    if (self.units().length === 0) {
      self.sectorOptions([]);
      return;
    }
    try {
      const unitEntities = self.units().map((u) => ({ Id: u.id }));
      const result = await sectors.search(self.units().length === 1 ? unitEntities[0] : unitEntities, await ctx());
      self.sectorOptions(result.results);
    } catch (err) {
      console.error('Sitrep: sector lookup failed', err);
      self.sectorOptions([]);
    }
  }

  // "6/1718 - Flood Event" -- identifier first, as it's what operators know events by
  // Beacon's event records carry the name as `Name` (job.Event.Name); `EventName` is what the search form calls it
  function eventDisplayName(e) {
    return e.Name || e.EventName || e.Description || '';
  }

  function eventOptionLabel(e) {
    const name = eventDisplayName(e);
    return [e.Identifier, name].filter(Boolean).join(' - ') || `Event ${e.Id}`;
  }

  // Focusing the empty event box offers the 5 most recent events -- for the
  // selected HQs when Beacon accepts that filter, else for everyone (the
  // heading says which). Typing your own search replaces this.
  self.eventOptionsTitle = ko.observable('');
  let eventOptionsAreRecent = false;

  function setEventResults(results, title, recent) {
    self.eventOptions(results.map((e) => ({ ...e, label: eventOptionLabel(e) })));
    self.eventOptionsTitle(title);
    eventOptionsAreRecent = recent;
  }

  self.onEventQueryFocus = async function () {
    if (self.eventQuery().trim()) return;
    const ids = self.units().map((u) => u.id);
    try {
      const c = await ctx();
      let result;
      let title = ids.length ? 'Recent events for the selected HQs' : 'Recent events';
      try {
        result = await events.recent(ids, c);
      } catch (err) {
        if (!ids.length) throw err;
        console.warn('Sitrep: HQ-filtered recent events rejected, showing unfiltered', err);
        result = await events.recent([], c);
        title = 'Recent events (all HQs, the HQ filter was not accepted)';
      }
      if (self.eventQuery().trim()) return; // they started typing meanwhile
      setEventResults(result.results, title, true);
    } catch (err) {
      console.error('Sitrep: recent events lookup failed', err);
    }
  };

  // delay lets a click on an option land before the list is dismissed
  self.onEventQueryBlur = function () {
    setTimeout(() => {
      if (eventOptionsAreRecent) {
        self.eventOptions([]);
        eventOptionsAreRecent = false;
      }
    }, 150);
  };

  self.searchEvents = async function () {
    const q = self.eventQuery().trim();
    if (!q) {
      self.eventOptions([]);
      return;
    }
    try {
      const result = await events.search(q, await ctx());
      setEventResults(result.results, 'Search results', false);
    } catch (err) {
      console.error('Sitrep: event search failed', err);
      self.eventOptions([]);
    }
  };

  self.onEventQueryKeydown = function (_data, event) {
    if (event.key === 'Enter') {
      self.searchEvents();
      return false;
    }
    return true;
  };

  self.pickEvent = function (event) {
    selectedEventRecord = event;
    self.selectedEventId(event.Id);
    self.selectedEventLabel(event.label || eventOptionLabel(event));
    // fill the report details from the chosen event (still editable)
    self.eventName(eventDisplayName(event));
    self.eventNumber(event.Identifier || '');
    self.eventOptions([]);
    self.eventQuery('');
  };

  self.clearEvent = function () {
    selectedEventRecord = null;
    self.selectedEventId('');
    self.selectedEventLabel('');
  };

  self.generate = async function () {
    self.error('');
    if (self.sitrepEdited() && !window.confirm('Regenerating will replace your manual edits to the working sitrep. Continue?')) return;
    const windowStart = parseSydneyDateTimeLocal(self.startInput());
    const windowEnd = parseSydneyDateTimeLocal(self.endInput());

    if (!windowStart || !windowEnd) {
      self.error('Enter a valid reporting start and end time.');
      return;
    }
    if (windowEnd.getTime() <= windowStart.getTime()) {
      self.error('The reporting end time must be after the start time.');
      return;
    }
    if (self.units().length === 0) {
      self.error('Select at least one HQ/unit.');
      return;
    }

    const signatureAtStart = inputSignature();
    self.loading(true);
    self.report(null);
    try {
      const unitArg = self.units().length === 1 ? { Id: self.units()[0].id } : self.units().map((u) => ({ Id: u.id }));
      const fetched = await fetchSitrepData({
        unit: unitArg,
        windowStart,
        windowEnd,
        ctx: await ctx(),
        onProgress: (status) => self.loadingStatus(status),
      });
      // BOM warnings are an optional extra: if BOM can't be reached the rest of
      // Get Data still completes, the failure is flagged in Data Status, and any
      // warnings already in Situation are left as they were.
      self.extraDataIssues([]);
      let bomBlock = '';
      let bomFailed = false;
      if (self.includeBomWarnings()) {
        self.loadingStatus('Fetching BOM warnings…');
        try {
          const bom = await fetchBomWarnings();
          bomBlock = buildBomBlock(bom.warnings, bom.fetchedAt);
        } catch (err) {
          bomFailed = true;
          console.error('Sitrep: BOM warnings fetch failed', err);
          self.extraDataIssues(["BOM warnings couldn't be retrieved, so the Situation section has no BOM information from this run. Check bom.gov.au."]);
        }
      }
      const report = computeSitrepReport(fetched, windowStart, windowEnd, {
        sectorId: self.selectedSectorId() || null,
        eventId: self.selectedEventId() || null,
      });
      self.windowStart(windowStart);
      self.windowEnd(windowEnd);
      self.generatedAt(new Date());
      self.report(report);
      self.lastRunSignature(signatureAtStart);
      // The figures go into the narrative textareas (Impact/Resources) so
      // they can be edited like any other text.
      const blocks = { ...buildGeneratedBlocks(report), situation: bomBlock };
      self.sections.forEach((section) => {
        if (section.key === 'situation' && bomFailed) return;
        const block = blocks[section.key] || '';
        if (!block && !generatedBlocks[section.key]) return;
        section.text(mergeGeneratedBlock(section.text(), generatedBlocks[section.key] || '', block));
        generatedBlocks[section.key] = block;
      });
      // the working sitrep is rebuilt from the fields too (confirmed above if
      // it had manual edits) -- its data-completeness block would go stale.
      self.resetSitrepText();
    } catch (err) {
      console.error('Sitrep: generation failed', err);
      self.error(
        `Couldn't get the data for the sitrep. ${friendlyReason(err)} Nothing is shown rather than a report with missing figures.`,
      );
    } finally {
      self.loading(false);
      self.loadingStatus('');
    }
  };

  self.copyToClipboard = async function () {
    try {
      await navigator.clipboard.writeText(self.sitrepText());
      self.copyStatus('Copied.');
    } catch (err) {
      console.error('Sitrep: clipboard copy failed', err);
      self.copyStatus("Couldn't copy automatically. Select the preview text and copy it yourself.");
    }
    setTimeout(() => self.copyStatus(''), 4000);
  };

  // ---- "may not be complete" guard for Copy / Print / + Ops Log ----
  self.warnings = ko.observableArray([]);
  self.warningOpen = ko.observable(false);
  let pendingAction = null;

  function currentWarnings() {
    return sitrepWarnings({
      sections: self.sections.map((s) => ({ heading: s.heading, text: s.text() })),
      nextReportOption: self.nextReportOption(),
      nextReportTime: self.nextReportTimeInput() ? parseSydneyDateTimeLocal(self.nextReportTimeInput()) : null,
    });
  }

  function focusSoon(id) {
    setTimeout(() => document.getElementById(id)?.focus(), 0);
  }

  // Runs `action` straight away when nothing looks missing; otherwise asks first.
  function guarded(action) {
    const found = currentWarnings();
    if (found.length === 0) {
      action();
      return;
    }
    self.warnings(found);
    pendingAction = action;
    self.warningOpen(true);
    focusSoon('sitrepWarningDialog');
  }

  self.cancelWarning = function () {
    pendingAction = null;
    self.warningOpen(false);
  };

  self.continueAfterWarning = function () {
    const action = pendingAction;
    pendingAction = null;
    self.warningOpen(false);
    if (action) action();
  };

  self.onWarningKeydown = function (_data, event) {
    if (event.key === 'Escape') {
      self.cancelWarning();
      return false;
    }
    return true;
  };

  self.requestCopy = () => guarded(self.copyToClipboard);
  self.requestPrint = () => guarded(self.print);

  // ---- + Ops Log: a "New Ops Log" popup like LAD/tasking's, prefilled ----
  // (Contact Types = SES, Entry Purpose = Information + Update; the tag
  // sections start collapsed), filed against the first selected HQ.
  self.opsLogStatus = ko.observable('');
  self.opsLogError = ko.observable('');
  self.opsLogOpen = ko.observable(false);
  self.opsLogLoading = ko.observable(false);
  self.opsLogSubmitting = ko.observable(false);
  self.opsLogGroups = ko.observableArray([]); // [{id, title, tags: [{id, name, icon, selected, toggle}], selectedSummary}]
  self.opsLogSubject = ko.observable('');
  self.opsLogText = ko.observable('');
  self.opsLogImportant = ko.observable(false);
  self.opsLogRestricted = ko.observable(false);
  self.opsLogActionRequired = ko.observable(false);
  // "Action required" only appears once an Action Items tag is chosen, and starts ticked then (as in LAD)
  self.opsLogHasActionTag = ko.pureComputed(() =>
    self.opsLogGroups().some((g) => g.id === ACTION_ITEMS_GROUP_ID && g.tags.some((t) => t.selected())),
  );
  self.opsLogHasActionTag.subscribe((has) => self.opsLogActionRequired(has));
  self.opsLogHqName = ko.pureComputed(() => {
    const hq = self.units()[0];
    if (!hq) return '';
    return self.units().length > 1 ? `${hq.name} (the first of ${self.units().length} selected HQs)` : hq.name;
  });

  self.canAddToOpsLog = ko.pureComputed(() => self.units().length > 0 && !!self.sitrepText().trim() && !self.opsLogOpen());

  self.opsLogTextTooLong = ko.pureComputed(() => self.opsLogText().length > TEXT_LIMIT);
  self.opsLogTextCounter = ko.pureComputed(() => `${self.opsLogText().length} / ${TEXT_LIMIT}${self.opsLogTextTooLong() ? ' (too long for an Ops Log entry, please shorten it)' : ''}`);
  self.canSubmitOpsLog = ko.pureComputed(
    () => !self.opsLogSubmitting() && !self.opsLogLoading() && !self.opsLogTextTooLong() && !!self.opsLogText().trim() && !!self.opsLogSubject().trim(),
  );

  function buildOpsLogGroup(group, rawTags) {
    const uiTags = rawTags.map((t) => {
      const ui = { id: t.Id, name: t.Name, groupId: group.id, isAction: group.id === ACTION_ITEMS_GROUP_ID, icon: returnTagIcon(group.id, t.Id), selected: ko.observable(isDefaultSitrepTag(group.id, t.Name)) };
      ui.toggle = () => ui.selected(!ui.selected());
      ui.onKeydown = (_d, event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          ui.toggle();
          return false;
        }
        return true;
      };
      return ui;
    });
    return {
      id: group.id,
      title: group.title,
      tags: uiTags,
      selectedSummary: ko.pureComputed(() => {
        const chosen = uiTags.filter((t) => t.selected()).map((t) => t.name);
        return chosen.length ? `(${chosen.join(', ')})` : '';
      }),
    };
  }

  async function openOpsLogModal() {
    self.opsLogError('');
    self.opsLogStatus('');
    self.opsLogSubject(sitrepOpsLogSubject({ eventName: self.eventName(), sitrepNumber: self.sitrepNumber() }));
    self.opsLogText(self.sitrepText());
    self.opsLogImportant(false);
    self.opsLogRestricted(false);
    self.opsLogActionRequired(false);
    self.opsLogGroups([]);
    self.opsLogOpen(true);
    self.opsLogLoading(true);
    focusSoon('sitrepOpsLogDialog');
    try {
      const c = await ctx();
      const loaded = await Promise.all(OPS_LOG_TAG_GROUPS.map((g) => tags.getGroup(g.id, c)));
      const byGroup = {};
      OPS_LOG_TAG_GROUPS.forEach((g, i) => {
        byGroup[g.id] = loaded[i];
      });
      self.opsLogGroups(OPS_LOG_TAG_GROUPS.map((g) => buildOpsLogGroup(g, byGroup[g.id])));
      const missing = missingDefaultTags(byGroup);
      if (missing.length > 0) {
        self.opsLogError(`Couldn't find the usual tag(s): ${missing.join(', ')}. Pick tags below before adding.`);
      }
    } catch (err) {
      console.error('Sitrep: loading Ops Log tags failed', err);
      self.opsLogError(`Couldn't load the Ops Log tags. ${friendlyReason(err)} Close this and try again.`);
    } finally {
      self.opsLogLoading(false);
    }
  }

  self.requestOpsLog = function () {
    if (!self.canAddToOpsLog()) return;
    guarded(openOpsLogModal);
  };

  self.closeOpsLog = function () {
    if (self.opsLogSubmitting()) return;
    self.opsLogOpen(false);
  };

  self.onOpsLogKeydown = function (_data, event) {
    if (event.key === 'Escape') {
      self.closeOpsLog();
      return false;
    }
    return true;
  };

  self.submitOpsLog = async function () {
    if (!self.canSubmitOpsLog()) return;
    const hq = self.units()[0];
    const chosen = self.opsLogGroups().flatMap((g) => g.tags.filter((t) => t.selected()).map((t) => ({ id: t.id, groupId: g.id })));
    if (chosen.length === 0) {
      self.opsLogError('Select at least one tag.');
      return;
    }
    self.opsLogError('');
    self.opsLogSubmitting(true);
    try {
      const payload = buildSitrepOpsLogPayload({
        entityId: hq.id,
        subject: self.opsLogSubject().trim().slice(0, SUBJECT_LIMIT),
        text: self.opsLogText(),
        tagIds: chosen.map((t) => t.id),
        eventId: self.selectedEventId() || null,
      });
      payload.ActionRequired = self.opsLogHasActionTag() && self.opsLogActionRequired();
      payload.Important = self.opsLogImportant();
      payload.Restricted = self.opsLogRestricted();
      await operationslog.create(payload, await ctx());
      self.opsLogOpen(false);
      self.opsLogStatus(`Added to the Ops Log for ${hq.name}.`);
    } catch (err) {
      console.error('Sitrep: adding to the Ops Log failed', err);
      self.opsLogError(`Couldn't add this to the Ops Log. ${friendlyReason(err)} Check the Ops Log before trying again, in case it did go through.`);
    } finally {
      self.opsLogSubmitting(false);
    }
  };

  // Beside the sitrep, not in it -- for the operator's reference.
  self.dataStatusLevel = ko.pureComputed(() => {
    const r = self.report();
    if (!r) return '';
    const level = { green: 'green', amber: 'amber', red: 'red' }[r.dataCompleteness.level] || 'amber';
    return level === 'green' && self.extraDataIssues().length > 0 ? 'amber' : level;
  });
  self.dataStatusLabel = ko.pureComputed(() => ({ green: 'Complete', amber: 'Check notes', red: 'Incomplete' })[self.dataStatusLevel()] || '');
  // Data Status bullet points, each with optional sub-points (e.g. the people counted as "Other")
  self.completenessItems = ko.pureComputed(() => {
    const r = self.report();
    if (!r) return [];
    const { issues, issueDetails = {} } = r.dataCompleteness;
    return [
      ...self.extraDataIssues().map((text) => ({ text, details: [] })),
      ...issues.map((text, i) => ({ text, details: issueDetails[i] || [] })),
    ];
  });

  // Reset button on the Situation Report card: header fields and every body
  // section back to their defaults (Location follows the selected HQs again,
  // Sitrep # 1, date & time now). The Beacon Data section (HQs, period, event
  // filter) and Authorisation are left alone. Get Data turns green again since
  // the sections it filled are now empty.
  self.resetSituationReport = function () {
    if (!window.confirm('Clear the Situation Report section back to its defaults? The header fields and all body text will be lost.')) return;
    self.eventNumber('');
    self.eventName('');
    locationLink.reset();
    self.sitrepNumber('1');
    self.sitrepTimeInput(formatSydneyDateTimeLocal(new Date()));
    self.sections.forEach((section) => {
      section.text('');
      section.snippetsOpen(false);
      generatedBlocks[section.key] = '';
    });
    self.lastRunSignature(null);
    self.resetSitrepText();
  };

  // Prepared By defaults to the logged-in user (their person record's first +
  // last name), unless the operator has already typed something.
  async function loadPreparedBy() {
    if (!personId || personId === 'undefined') return;
    try {
      const person = await people.getSimplePerson(personId, await ctx());
      const name = [person?.FirstName, person?.LastName].filter(Boolean).join(' ') || person?.FullName || '';
      if (name && !self.preparedBy()) self.preparedBy(name);
    } catch (err) {
      console.warn('Sitrep: could not look up the current user for Prepared By', err);
    }
  }
  loadPreparedBy();

  self.print = function () {
    window.print();
  };

  self.formatSydney = formatSydney;

  return self;
}
