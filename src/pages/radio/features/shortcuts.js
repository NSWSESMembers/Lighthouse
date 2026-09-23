/*
  Feature: keyboard shortcuts.

  Alt + a key jumps around the form and controls the log without the mouse
  (Alt+N new radio log, Alt+C callsign, Alt+M message, Alt+P pause, Alt+R reset the form ...; Alt+K search; Alt+1..9 for quick
  messages when that feature is on). Press ? outside a text field for the list.
  Ctrl/Cmd+Enter to submit is unchanged. Ignored while a dialog is open.

  Roll back: switch it off in Settings > Experimental features, or delete this
  file, lib/shortcuts.js and styles/pages/radio-features/shortcuts.css.
*/
import '../../../../styles/pages/radio-features/shortcuts.css';
import { BASE_SHORTCUTS, quickMessageShortcuts, matchShortcut, isHelpKey, isTypingTarget } from '../lib/shortcuts.js';

const byId = (id) => document.getElementById(id);

export const feature = {
  key: 'shortcuts',
  label: 'Keyboard shortcuts',
  description: 'Alt + key shortcuts for the entry form and log controls; press ? for the list.',
  icon: 'fa-keyboard',

  install(vm, { ko, enabled, mount }) {
    const helpOpen = ko.observable(false);
    const helpList = ko.observableArray();

    // Quick-message shortcuts exist only when that feature is installed and on
    function currentShortcuts() {
      const q = vm.quickMessages;
      const quick = q && q.enabled() ? quickMessageShortcuts(q.buttons().map((b) => ({ label: b.label() }))) : [];
      return [...BASE_SHORTCUTS, ...quick];
    }

    const actions = {
      // straight to the entry form: bring it into view (the page may be scrolled down the log) and start on Callsign
      'focus-new-log': () => {
        document.querySelector('.radio-entry-area')?.scrollIntoView({ block: 'nearest' });
        byId('radioCallsignInput')?.focus();
      },
      'focus-callsign': () => byId('radioCallsignInput')?.focus(),
      'focus-message': () => byId('radioMessageInput')?.focus(),
      'focus-incident': () => byId('radioEntryJobInput')?.focus(),
      'focus-talkgroup': () => byId('radioEntryTalkgroupInput')?.focus(),
      'toggle-important': () => vm.entryImportant(!vm.entryImportant()),
      'toggle-action': () => vm.entryActionRequired(!vm.entryActionRequired()),
      // empties every field of the entry form (an unsent draft included) and starts again on Callsign
      'reset-form': () => {
        vm.callsignInput('');
        vm.messageInput('');
        vm.clearEntryJob();
        vm.clearEntryTalkgroup();
        vm.entryRetrospective(false);
        vm.entryActionRequired(false);
        vm.entryImportant(false);
        vm.entryRestricted(false);
        vm.entryReminderPreset('none');
        vm.entryReminderCustomInput('');
        vm.submitError('');
        vm.submitNotInFilterNotice('');
        byId('radioCallsignInput')?.focus();
      },
      'focus-search': () => {
        vm.toggleTextFilter();
        setTimeout(() => byId('radioTextFilter')?.focus(), 0);
      },
      'toggle-pause': () => vm.togglePause(),
      'jump-latest': () => vm.jumpToLatest(),
      'open-settings': () => byId('radioSettingsButton')?.click(),
    };

    const dialogOpen = () => !!document.querySelector('.modal.show');

    function openHelp() {
      helpList(currentShortcuts());
      helpOpen(true);
      setTimeout(() => byId('radioShortcutsHelp')?.focus(), 0);
    }
    const closeHelp = () => helpOpen(false);

    document.addEventListener('keydown', (event) => {
      if (!enabled()) return;

      if (helpOpen()) {
        if (event.key === 'Escape' || isHelpKey(event)) {
          event.preventDefault();
          closeHelp();
        }
        return;
      }
      if (dialogOpen()) return;

      if (isHelpKey(event) && !isTypingTarget(event.target)) {
        event.preventDefault();
        openHelp();
        return;
      }

      const shortcut = matchShortcut(event, currentShortcuts());
      if (!shortcut) return;
      event.preventDefault();
      if (shortcut.id.startsWith('quick-')) {
        vm.quickMessages?.applyByNumber(Number(shortcut.id.slice(6)));
      } else {
        actions[shortcut.id]?.();
      }
    });

    vm.shortcuts = { enabled, helpOpen, helpList, openHelp, closeHelp };

    mount(
      'body-end',
      `
<div class="radio-shortcuts-backdrop" data-bind="visible: shortcuts.enabled() && shortcuts.helpOpen(), click: shortcuts.closeHelp">
  <div class="radio-shortcuts-panel" id="radioShortcutsHelp" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="radioShortcutsTitle">
    <h2 id="radioShortcutsTitle"><i class="fas fa-keyboard"></i> Keyboard shortcuts</h2>
    <p class="radio-shortcuts-note">Alt (Option on a Mac) + key. Ctrl/Cmd+Enter submits. Press ? or Esc to close.</p>
    <dl class="radio-shortcuts-list" data-bind="foreach: shortcuts.helpList">
      <dt><kbd data-bind="text: keys"></kbd></dt>
      <dd data-bind="text: label"></dd>
    </dl>
  </div>
</div>`,
    );

    mount(
      'settings-body-end',
      `
<div class="radio-settings-section" data-bind="visible: shortcuts.enabled">
  <h6>Keyboard shortcuts</h6>
  <p class="radio-settings-note">Press <kbd>?</kbd> anywhere outside a text box to see them.</p>
  <button type="button" class="btn btn-secondary btn-sm" data-bind="click: shortcuts.openHelp" data-bs-dismiss="modal">Show shortcuts</button>
</div>`,
    );
  },
};
