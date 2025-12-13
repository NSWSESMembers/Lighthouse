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

    // ----------------------------
    // Recipient search + add
    // ----------------------------
    self.recipientSearchQuery = ko.observable("");
    self.recipientSearchResults = ko.observableArray([]);
    self.recipientSearchDropdownOpen = ko.observable(false);
    self.recipientSearchLoading = ko.observable(false);
    self.recipientSearchHasFocus = ko.observable(false);

    let _recipientSearchTimer = null;

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
        self.operationalSMS(true)
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
                    recipient.displayLabel(`${recipient.name} (SMS ${filtered.map(c => c.Detail).join(", ")})`);
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

    self.sendingOrLoading = ko.pureComputed(() => {
        return self.isSending() || self.recipientsLoading();
    });

    self.recipientsLoading = ko.pureComputed(() => {
        return self.recipients().some(r => r.loading());
    });

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

    self.clearRecipientSearch = function () {
        self.recipientSearchQuery("");
        self.recipientSearchResults([]);
        self.recipientSearchDropdownOpen(false);
    };

    self.closeRecipientSearchDropdown = function () {
        // allow click on dropdown items to fire before closing
        setTimeout(function () {
            self.recipientSearchDropdownOpen(false);
        }, 150);
    };

    self.onRecipientSearchKeydown = function (_vm, e) {
        if (e.key === "Escape") {
            self.clearRecipientSearch();
            return true;
        }
        if (e.key === "Enter") {
            const first = self.recipientSearchResults()[0];
            if (first) self.addRecipientFromSearch(first);
            return false;
        }
        return true;
    };

    self._searchContacts = async function (q) {
        return await parentVM.searchContacts(q);
    }

    self._runRecipientSearch = async function () {
        const q = (self.recipientSearchQuery() || "").trim();
        if (q.length < 2) {
            self.recipientSearchResults([]);
            self.recipientSearchDropdownOpen(false);
            return;
        }

        self.recipientSearchLoading(true);
        try {
            const rows = await self._searchContacts(q);
            const cleanedRows = rows
                .map((r) => {
                    let detail = r.Detail || "";
                    if (r.ContactTypeId === 0) {
                        detail = `${r.Location} Group`;
                    } else if (r.ContactTypeId === 2) {
                        detail = `SMS ${detail}`;
                    }
                    return {
                        id: r.Id,
                        name: r.Description,
                        detail: detail
                    };
                });
            self.recipientSearchResults(cleanedRows);
            self.recipientSearchDropdownOpen(cleanedRows.length > 0 && self.recipientSearchHasFocus());
        } catch (err) {
            console.error("Recipient search failed:", err);
            self.recipientSearchResults([]);
            self.recipientSearchDropdownOpen(false);
        } finally {
            self.recipientSearchLoading(false);
        }
    };

    self.recipientSearchQuery.subscribe(function () {
        if (_recipientSearchTimer) clearTimeout(_recipientSearchTimer);
        _recipientSearchTimer = setTimeout(function () {
            self._runRecipientSearch();
        }, 250);
    });

    self._addRecipientByIdName = function (id) {
        const already = self.recipients().some(r => String(r.id) === String(id));

        if (already) return;

        const match = self.recipientSearchResults().find(r => String(r.id) === String(id));
        if (!match) return;
        console.log(match)
        self.recipients.push(new SMSRecipient({
            id: match.id,
            name: match.name,
            isTeamLeader: false,
            selected: true,
            displayLabel: `${match.name} (${match.detail})`,
            beaconContact: [match],
            loading: false
        }));



    };

    self.addRecipientFromSearch = function (row) {
        if (!row) return;
        self._addRecipientByIdName(row.id);
        self.clearRecipientSearch();
    };
}
