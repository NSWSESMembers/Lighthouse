/*
  Framework-free state machine for the log list's live-update/pause
  behaviour, kept separate from the Knockout view model so the pause/resume
  semantics are directly unit-testable.

  - applyPage() is a full replace: a filter change or manual refresh always
    takes effect immediately, even while paused (the operator asked for it).
  - applyLive() is an incremental merge (a SignalR push, or a background
    poll's reconciliation): while paused, it accumulates in a pending
    buffer instead of touching what's displayed, so someone reading older
    entries isn't interrupted; resume() (or the next applyPage()) flushes it.
*/

import { mergeLogEntries } from './mergeLogEntries.js';

export function createLiveLogBuffer() {
  let displayed = [];
  let pending = [];
  let paused = false;

  return {
    getDisplayed: () => displayed,
    isPaused: () => paused,

    pendingCount: () => (pending.length === 0 ? 0 : mergeLogEntries(displayed, pending).length - displayed.length),

    applyPage(rawPage) {
      displayed = mergeLogEntries([], rawPage);
      pending = [];
    },

    applyLive(rawEntries) {
      if (paused) {
        pending = mergeLogEntries(pending, rawEntries);
      } else {
        displayed = mergeLogEntries(displayed, rawEntries);
      }
    },

    pause() {
      paused = true;
    },

    resume() {
      displayed = mergeLogEntries(displayed, pending);
      pending = [];
      paused = false;
    },
  };
}
