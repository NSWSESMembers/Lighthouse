/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import { SMSRecipient } from "../models/SMSRecipient.js";
import { showAlert } from '../components/windowAlert.js';


export function SendSMSModalVM(parentVM) {
    const self = this;

    self.parent = parentVM;

    // UI state
    self.headerLabel = ko.observable("Send SMS");
    self.showError = ko.observable(false);
    self.errorMessage = ko.observable("");
    self.text = ko.observable("");
    self.taskId = ko.observable(null);
    self.operationalSMS = ko.observable(true);
    // Recipients
    self.recipients = ko.observableArray([]);
    self.selectedCount = ko.pureComputed(function () {
        return self.recipients().filter(function (r) { return r.selected(); }).length;
    });

    // Bootstrap modal instance (set from main.js when opening)
    self.modalInstance = null;

    self.isSending = ko.observable(false);

    /**
     * Open the modal with a given set of recipients.
     * passedRecipients: array of { name, id, isTeamLeader }
     * opts: { headerLabel?: string, initialText?: string, taskID?: string }
     */
    self.openWithRecipients = function (passedRecipients, opts) {
        console.log("Opening SMS modal with recipients:", passedRecipients);
        const options = opts || {};

        self.headerLabel(options.headerLabel || "Send SMS");
        self.showError(false);
        self.errorMessage("");
        self.text(options.initialText || "");
        self.taskId(options.taskId || null);

        const mapped = (passedRecipients || []).map(function (r) {
            const id = r.id;
            const name = r.name;
            const isTL = r.isTeamLeader;
            return new SMSRecipient({
                id: id,
                name: name,
                isTeamLeader: isTL,
                selected: ko.observable(true),
                displayLabel: name

            })
        });

        mapped.forEach(async function (recipient) {
            try {
                console.log("Fetching contact numbers for recipient:", recipient.id);
                const contacts = await parentVM.fetchContactNumbers(recipient.id);

                if (contacts.length > 0) {
                    const filtered = contacts.filter(c => c.Description === "SMS");
                    recipient.beaconContact.push(...filtered)
                    recipient.displayLabel(`${recipient.name} (${filtered.map(c => c.Detail).join(", ")})`);
                } else {
                    recipient.displayLabel(`${recipient.name} (No SMS number found)`);
                    recipient.selected(false);
                }
                recipient.loading(false);
            } catch (err) {
                console.error("Failed to fetch contact numbers for recipient:", recipient.id, err);
            }

        });

        self.recipients(mapped);

    };

    self.messageLengthInfo = ko.pureComputed(() => {
        const len = (self.text()).length;
        return `${len} characters (${Math.ceil(len / 160)} message will be sent)`;
    });

    self.updateMessageLength = () => {
        // Trigger re-computation of messageLengthInfo
        self.text(self.text());
    }

    self.setAsOperationalSMS = function () {
        self.operationalSMS(true);
    }

    self.setAsNonOperationalSMS = function () {
        self.operationalSMS(false);
    }

    self.getSelectedRecipients = function () {
        return self.recipients().filter(function (r) { return r.selected(); });
    };

    self.submit = async function () {
        const selected = self.getSelectedRecipients();
        const msg = (self.text() || "").trim();

        if (!selected.length) {
            self.showError(true);
            self.errorMessage("Select at least one recipient.");
            return;
        }

        if (!msg) {
            self.showError(true);
            self.errorMessage("Message text is required.");
            return;
        }

        self.showError(false);
        self.errorMessage("");

        self.isSending(true)
           parentVM.sendSMS(
                    selected.flatMap(function (r) {
                        return r.beaconContact.map(c => c);
                    }),
                    self.taskId(),
                    msg,
                    self.operationalSMS()
                ).then(function (_response) {
                    self.isSending(false);
                    self.modalInstance.hide();
                    showAlert(`SMS sent successfully!`, 'success', 3000);
                }).catch(function (error) {
                self.isSending(false);
                self.showError(true);
                self.errorMessage("Failed to send SMS. Please try again.");
                console.error("Error sending SMS:", error);
            })
    };
}
