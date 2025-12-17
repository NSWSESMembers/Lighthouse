/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import { showAlert } from '../components/windowAlert.js';

export function JobStatusConfirmModalVM(root) {
    const self = this;

    self.modalInstance = null;

    self.job = ko.observable(null);
    self.newStatus = ko.observable("");
    self.extraText = ko.observable("");

    self.isSubmitting = ko.observable(false);

    self.jobLabel = ko.pureComputed(() => {
        const job = self.job();
        if (!job) return "";
        return job.identifierTrimmed?.() || job.identifier?.() || `#${job.id()}`;
    });

    const needsTextFor = new Set(["Complete", "Reject", "Cancel"]);
    self.requiresExtraText = ko.pureComputed(() => needsTextFor.has(self.newStatus()));

    self.extraTextLabel = ko.pureComputed(() => {
        switch (self.newStatus()) {
            case "Complete": return "Completion notes:";
            case "Reject": return "Rejection reason:";
            case "Cancel": return "Cancellation reason:";
            default: return "Notes:";
        }
    });

    self.extraTextPlaceholder = ko.pureComputed(() => {
        switch (self.newStatus()) {
            case "Complete": return "Enter completion notes (required)";
            case "Reject": return "Enter rejection reason (required)";
            case "Cancel": return "Enter cancellation reason (required)";
            default: return "Optional notes";
        }
    });

    self.canSubmit = ko.pureComputed(() => {
        if (self.isSubmitting()) return false; // lock UI while submitting
        if (!self.requiresExtraText()) return true;
        return (self.extraText() || "").trim().length > 0;
    });

    self.open = function (job, newStatus) {
        self.job(job || null);
        self.newStatus(newStatus || "");
        self.extraText("");
        self.isSubmitting(false);
    };

    self.submit = async function () {
        if (self.isSubmitting()) return; // prevent double click

        const job = self.job();
        const status = self.newStatus();
        const text = (self.extraText() || "").trim();

        if (!job || !job.id || !status) return;
        if (!self.canSubmit()) return;

        self.isSubmitting(true);
        try {
            await root.setJobStatus(job.id(), status, text);
            self.modalInstance?.hide();
            job.refreshData?.();
            showAlert(
                `Incident ${job.identifierTrimmed?.() || job.identifier?.() || job.id()} status set to ${status}`,
                "success",
                3000
            );
        } catch (err) {
            console.error("Error updating job status:", err);
            showAlert(`Failed to update incident status to ${status}`, "danger", 5000);
        } finally {
            self.isSubmitting(false);
        }
    };
}
