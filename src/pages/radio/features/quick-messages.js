/*
  Feature: quick messages.

  A row of one-click buttons under the Message box (mouse, or Alt+1..9 with the shortcuts feature -- not tab stops, so Tab still goes Message -> Submit). Clicking one puts its text
  in the message (after anything already typed) and, where the quick message
  says so, ticks Important / Action Required and picks a reminder. It never
  submits -- you still review and send. The list is edited in Settings.

  Roll back: switch it off in Settings > Experimental features, or delete this
  file, lib/quickMessages.js and styles/pages/radio-features/quick-messages.css.
*/
import '../../../../styles/pages/radio-features/quick-messages.css';
import {
  DEFAULT_QUICK_MESSAGES,
  QUICK_MESSAGE_REMINDERS,
  normaliseQuickMessages,
  loadQuickMessages,
  saveQuickMessages,
  mergeQuickMessageText,
} from '../lib/quickMessages.js';

const REMINDER_LABELS = { none: 'No reminder', 30: 'Reminder 30 mins', 60: 'Reminder 60 mins', 120: 'Reminder 120 mins' };

export const feature = {
  key: 'quick-messages',
  label: 'Quick messages',
  description: 'One-click canned messages (with optional Important / Action Required) under the Message box. Edit them below.',
  icon: 'fa-comment-dots',

  install(vm, { ko, enabled, mount }) {
    const storage = window.localStorage;
    const reminderOptions = QUICK_MESSAGE_REMINDERS.map((key) => ({ key, label: REMINDER_LABELS[key] }));

    function makeItem(data) {
      return {
        label: ko.observable(data.label),
        text: ko.observable(data.text),
        important: ko.observable(data.important),
        actionRequired: ko.observable(data.actionRequired),
        reminder: ko.observable(data.reminder),
      };
    }
    const toData = (item) => ({
      label: item.label(),
      text: item.text(),
      important: item.important(),
      actionRequired: item.actionRequired(),
      reminder: item.reminder(),
    });

    const items = ko.observableArray(loadQuickMessages(storage).map(makeItem));

    // Save whenever the list or any field in it changes. Half-typed rows (an empty
    // label or text) are simply left out of what is saved and shown as buttons.
    const snapshot = ko.computed(() => items().map(toData));
    snapshot.subscribe((list) => saveQuickMessages(storage, normaliseQuickMessages(list)));

    const model = {
      enabled,
      items,
      reminderOptions,
      // only complete rows become buttons
      buttons: ko.pureComputed(() => items().filter((i) => i.label().trim() && i.text().trim())),
    };

    const messageBox = () => document.getElementById('radioMessageInput');

    model.apply = (item) => {
      if (!enabled()) return;
      vm.messageInput(mergeQuickMessageText(vm.messageInput(), item.text().trim()));
      if (item.important()) vm.entryImportant(true);
      if (item.actionRequired()) {
        vm.entryActionRequired(true);
        if (item.reminder() !== 'none' && vm.entryReminderPreset() === 'none') vm.entryReminderPreset(item.reminder());
      }
      const box = messageBox();
      if (box) {
        box.focus();
        box.setSelectionRange(box.value.length, box.value.length);
      }
    };
    // 1-based, over the visible buttons (used by the keyboard shortcuts feature when both are on)
    model.applyByNumber = (n) => {
      const item = model.buttons()[n - 1];
      if (item) model.apply(item);
    };

    model.add = () => items.push(makeItem({ label: '', text: '', important: false, actionRequired: false, reminder: 'none' }));
    model.remove = (item) => items.remove(item);
    model.resetToDefaults = () => {
      if (window.confirm('Replace your quick messages with the defaults?')) items(normaliseQuickMessages(DEFAULT_QUICK_MESSAGES).map(makeItem));
    };
    vm.quickMessages = model;

    mount(
      'entry-message-after',
      `
<div class="radio-quick-messages" data-bind="visible: quickMessages.enabled() && quickMessages.buttons().length > 0" aria-label="Quick messages">
  <!-- ko foreach: quickMessages.buttons -->
  <button type="button" class="radio-quick-chip" tabindex="-1" data-bind="click: $root.quickMessages.apply, text: label, attr: { title: text }"></button>
  <!-- /ko -->
</div>`,
    );

    mount(
      'settings-body-end',
      `
<div class="radio-settings-section" data-bind="visible: quickMessages.enabled">
  <h6>Quick messages</h6>
  <p class="radio-settings-note">Changes are saved as you type. A row needs a label and text to show as a button.</p>
  <div class="radio-quick-editor" data-bind="foreach: quickMessages.items">
    <div class="radio-quick-editor-row">
      <input type="text" class="form-control radio-quick-editor-label" placeholder="Button label" aria-label="Button label" data-bind="textInput: label">
      <input type="text" class="form-control radio-quick-editor-text" placeholder="Message text" aria-label="Message text" data-bind="textInput: text">
      <label class="radio-checkbox-label"><input type="checkbox" data-bind="checked: important"> Important</label>
      <div class="radio-quick-editor-action">
        <label class="radio-checkbox-label"><input type="checkbox" data-bind="checked: actionRequired"> Action required</label>
        <select class="form-control radio-quick-editor-reminder" aria-label="Reminder" data-bind="options: $root.quickMessages.reminderOptions, optionsText: 'label', optionsValue: 'key', value: reminder, visible: actionRequired"></select>
      </div>
      <button type="button" class="radio-quick-editor-remove" title="Remove" aria-label="Remove" data-bind="click: $root.quickMessages.remove"><i class="fas fa-times"></i></button>
    </div>
  </div>
  <div class="radio-quick-editor-actions">
    <button type="button" class="btn btn-secondary btn-sm" data-bind="click: quickMessages.add"><i class="fas fa-plus"></i> Add quick message</button>
    <button type="button" class="btn btn-outline-secondary btn-sm" data-bind="click: quickMessages.resetToDefaults">Reset to defaults</button>
  </div>
</div>`,
    );
  },
};
