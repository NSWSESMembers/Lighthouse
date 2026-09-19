/*
  Feature: urgent alerts.

  When someone else logs a NEW Important or Action Required entry, a red banner
  appears (and stays until dismissed), the urgent alarm plays, the tab title shows
  the count, and -- if the tab is in the background and notifications are allowed --
  a browser notification is raised. It does NOT fire for ordinary entries, for
  entries you or this console wrote, for entries already in the log when it loaded,
  or for anything created more than 15 minutes ago. Which flags count (Important,
  Action Required) is chosen in its settings.

  Roll back: switch it off in Settings > Experimental features, or delete this
  file, lib/urgentAlerts.js and styles/pages/radio-features/urgent-alerts.css.
*/
import '../../../../styles/pages/radio-features/urgent-alerts.css';
import { pickUrgentEntries, urgencyLabel } from '../lib/urgentAlerts.js';

const STORAGE_KEY = 'lighthouseRadioUrgentAlerts';
const MAX_SHOWN = 5;

function loadSettings() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
    return { sound: parsed.sound !== false, notify: parsed.notify !== false, important: parsed.important !== false, action: parsed.action !== false };
  } catch (err) {
    return { sound: true, notify: true, important: true, action: true };
  }
}

// Two short tones from the Web Audio API -- no audio file to ship. Browsers keep
// audio locked until the page has had a click/keypress, so a beep before then is
// silently skipped (the banner still shows); "Test alert" in Settings unlocks it.
let audioContext = null;
function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioContext = audioContext || new Ctx();
    if (audioContext.state === 'suspended') audioContext.resume();
    const start = audioContext.currentTime;
    [880, 660].forEach((frequency, i) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.25, start + i * 0.22 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.22 + 0.2);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start + i * 0.22);
      oscillator.stop(start + i * 0.22 + 0.21);
    });
  } catch (err) {
    console.error('Radio console: urgent alert sound failed', err);
  }
}

export const feature = {
  key: 'urgent-alerts',
  label: 'Urgent alerts',
  description: 'Red banner, alarm and tab-title flag when someone else logs a new Important or Action Required entry (choose which below). Never fires for ordinary entries or your own.',
  icon: 'fa-exclamation-triangle',

  install(vm, { ko, enabled, mount }) {
    const initial = loadSettings();
    const sound = ko.observable(initial.sound);
    const notify = ko.observable(initial.notify);
    const alertOnImportant = ko.observable(initial.important);
    const alertOnAction = ko.observable(initial.action);
    [sound, notify, alertOnImportant, alertOnAction].forEach((o) => o.subscribe(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ sound: sound(), notify: notify(), important: alertOnImportant(), action: alertOnAction() }),
        );
      } catch (err) {
        // not remembered -- harmless
      }
    }));

    const alerts = ko.observableArray(); // newest first
    const seen = new Set();
    const baseTitle = document.title;

    const shown = ko.pureComputed(() => alerts().slice(0, MAX_SHOWN));
    const hiddenCount = ko.pureComputed(() => Math.max(0, alerts().length - MAX_SHOWN));

    // "(2) URGENT -- Radio Operations Console" while alerts are waiting (visible in a background tab)
    alerts.subscribe((list) => {
      document.title = list.length > 0 && enabled() ? `(${list.length}) URGENT -- ${baseTitle}` : baseTitle;
    });
    enabled.subscribe((on) => {
      if (!on) alerts.removeAll();
    });

    const model = {
      enabled,
      sound,
      notify,
      alertOnImportant,
      alertOnAction,
      shown,
      hiddenCount,
      hasAlerts: ko.pureComputed(() => alerts().length > 0),
      dismissAll: () => alerts.removeAll(),
    };

    function raise(item) {
      const label = urgencyLabel(item.kind);
      alerts.unshift({
        id: item.id,
        label,
        callsign: item.callsign,
        text: item.text.length > 160 ? `${item.text.slice(0, 157)}...` : item.text,
        dismiss() {
          alerts.remove(this);
        },
      });
      if (sound()) (vm.playChime ? vm.playChime('overdue') : playBeep()); // the console's red (urgent) alarm tone, else the built-in beep
      if (notify() && document.hidden && vm.showNotification && vm.notificationPermission() === 'granted') {
        vm.showNotification({ tag: `radio-urgent-${item.id}`, title: `Urgent: ${label}`, body: `${item.callsign}: ${item.text.slice(0, 150)}`, persistent: true });
      }
    }

    // Everything loaded (first load, filter change, load more) and everything we wrote is "known"
    vm.events.subscribe((entries) => entries.forEach((e) => seen.add(e.Id)), null, 'entriesLoaded');
    vm.events.subscribe((created) => seen.add(created.Id), null, 'entryCreated');

    // If the first thing to arrive is a multi-entry refresh (the initial list load failed, so nothing is
    // "known" yet), treat it as the baseline instead of alerting for everything flagged in it.
    let baselined = false;
    vm.events.subscribe(() => {
      baselined = true;
    }, null, 'entriesLoaded');

    vm.events.subscribe(
      (entries) => {
        if (!baselined && entries.length > 1) {
          entries.forEach((e) => seen.add(e.Id));
          baselined = true;
          return;
        }
        // seen is always kept current, even while off, so switching on doesn't replay old entries
        const { urgent, seenIds } = pickUrgentEntries(entries, {
          seen,
          personId: vm.personId,
          suppress: vm.submitting(),
          now: Date.now(),
          kinds: { important: alertOnImportant(), action: alertOnAction() },
        });
        seenIds.forEach((id) => seen.add(id));
        if (enabled()) urgent.forEach(raise);
      },
      null,
      'entriesReceived',
    );

    model.test = () => {
      raise({ id: `test-${Date.now()}`, kind: 'both', callsign: 'TEST', text: 'This is a test of the urgent alert.' });
    };

    vm.urgentAlerts = model;

    mount(
      'page-top',
      `
<div class="radio-urgent-stack" role="alert" aria-live="assertive" data-bind="visible: urgentAlerts.enabled() && urgentAlerts.hasAlerts()">
  <!-- ko foreach: urgentAlerts.shown -->
  <div class="radio-urgent-alert">
    <i class="fas fa-exclamation-triangle"></i>
    <div class="radio-urgent-body">
      <div class="radio-urgent-title"><span data-bind="text: label"></span> &middot; <strong data-bind="text: callsign"></strong></div>
      <div class="radio-urgent-text" data-bind="text: text"></div>
    </div>
    <button type="button" class="radio-urgent-dismiss" data-bind="click: dismiss" aria-label="Dismiss" title="Dismiss"><i class="fas fa-times"></i></button>
  </div>
  <!-- /ko -->
  <div class="radio-urgent-more" data-bind="visible: urgentAlerts.hiddenCount() > 0">
    <span data-bind="text: '+' + urgentAlerts.hiddenCount() + ' more'"></span>
  </div>
  <button type="button" class="radio-urgent-clear" data-bind="click: urgentAlerts.dismissAll">Dismiss all</button>
</div>`,
    );

    mount(
      'settings-body-end',
      `
<div class="radio-settings-section" data-bind="visible: urgentAlerts.enabled">
  <h6>Urgent alerts</h6>
  <div class="radio-settings-hint">Alert me when someone else logs a new entry that is:</div>
  <label class="radio-checkbox-label"><input type="checkbox" data-bind="checked: urgentAlerts.alertOnImportant"> Important</label>
  <label class="radio-checkbox-label"><input type="checkbox" data-bind="checked: urgentAlerts.alertOnAction"> Action Required</label>
  <label class="radio-checkbox-label"><input type="checkbox" data-bind="checked: urgentAlerts.sound"> Play a sound</label>
  <label class="radio-checkbox-label"><input type="checkbox" data-bind="checked: urgentAlerts.notify"> Browser notification when this tab is in the background</label>
  <button type="button" class="btn btn-secondary btn-sm" data-bind="click: urgentAlerts.test">Test alert</button>
</div>`,
    );
  },
};
