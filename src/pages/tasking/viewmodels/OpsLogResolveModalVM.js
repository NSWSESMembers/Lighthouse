/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import { showAlert } from '../components/windowAlert.js';

export function OpsLogResolveModalVM(root) {
    const self = this;

    self.modalInstance = null;

    self.entry = ko.observable(null);
    self.job = ko.observable(null);

    self.text = ko.observable("");

    self.isSubmitting = ko.observable(false);

    self.entrySubject = ko.pureComputed(() => {
        const entry = self.entry();
        if (!entry) return "";
        return entry.subject?.() || entry.tagsCsv?.() || `Entry #${entry.id?.()}`;
    });

    self.canSubmit = ko.pureComputed(() => !self.isSubmitting() && (self.text() || "").trim().length > 0);

    self.open = function (entry, job) {
        self.entry(entry || null);
        self.job(job || null);
        self.text("");
        self.isSubmitting(false);
    };

    self.submit = async function () {
        if (self.isSubmitting()) return; // prevent double click

        const entry = self.entry();
        const text = (self.text() || "").trim();
        if (!entry || !text) return;
        if (!self.canSubmit()) return;

        self.isSubmitting(true);
        try {
            await root.resolveOpsLogEntry(entry.id(), { Text: text });

            entry.actionRequired(false);
            self.modalInstance?.hide();
            showAlert("Ops log entry resolved", "success", 3000);

            const job = self.job();
            job?.refreshData?.({ force: true });
        } catch (err) {
            console.error("Error resolving ops log entry:", err);
            showAlert("Failed to resolve ops log entry", "danger", 5000);
        } finally {
            self.isSubmitting(false);
        }
    };
}
