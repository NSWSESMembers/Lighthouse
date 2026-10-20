/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";

// Call off one tasking with a reason. Opened from the Spotlight `calloff`
// command; submits through the tasking's own status update, same as the
// tasking status dropdown.
export function CallOffModalVM() {
    const self = this;

    self.modalInstance = null;

    self.tasking = ko.observable(null);
    self.reason = ko.observable("");

    self.teamLabel = ko.pureComputed(() => {
        const ts = self.tasking();
        return ts ? (ko.unwrap(ts.team)?.callsign?.() || "") : "";
    });

    self.jobLabel = ko.pureComputed(() => {
        const ts = self.tasking();
        return ts ? (ko.unwrap(ts.job)?.identifier?.() || "") : "";
    });

    self.canSubmit = ko.pureComputed(() =>
        !!self.tasking()?.canCalloff?.() && (self.reason() || "").trim().length > 0
    );

    self.open = function (tasking) {
        self.tasking(tasking || null);
        self.reason("");
    };

    self.submit = function () {
        if (!self.canSubmit()) return;
        const ts = self.tasking();
        const option = ts.statusOptions().find(o => o.key === "CallOff");

        ts.onStatusDropdownToggleClick();
        ts.onStatusOptionClick(option);
        ts.callOffReason(self.reason().trim());
        ts.updateTaskingStatus();
        self.modalInstance?.hide();
    };
}
