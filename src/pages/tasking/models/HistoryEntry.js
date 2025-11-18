// HistoryEntry.js

/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import moment from "moment";

export function HistoryEntry(data = {}) {
  const self = this;

  // --- core fields ---
  self.name = ko.observable(data.Name || "");
  self.description = ko.observable(data.Description || "");

  self.timeLoggedRaw = ko.observable(data.TimeLogged || null);
  self.timeStampRaw = ko.observable(data.TimeStamp || null);

  // derived — formatted times
  self.timeLogged = ko.pureComputed(() => {
    const v = self.timeLoggedRaw();
    return v ? moment(v).format("DD/MM/YYYY HH:mm:ss") : "";
  });

  self.timeStamp = ko.pureComputed(() => {
    const v = self.timeStampRaw();
    return v ? moment(v).format("DD/MM/YYYY HH:mm:ss") : "";
  });

    // "time ago" label
  self.timeStampAgo = ko.pureComputed(() => {
    const v = self.timeStampRaw();
    return v ? moment(v).fromNow() : "";
  });

  // "time ago" label
  self.timeLoggedAgo = ko.pureComputed(() => {
    const v = self.timeLoggedRaw();
    return v ? moment(v).fromNow() : "";
  });

  // --- CreatedBy object ---
  const created = data.CreatedBy || {};

  self.createdBy = {
    id: ko.observable(created.Id || null),
    firstName: ko.observable(created.FirstName || ""),
    lastName: ko.observable(created.LastName || ""),
    fullName: ko.observable(created.FullName || ""),
    gender: ko.observable(created.Gender || null),
    registrationNumber: ko.observable(created.RegistrationNumber || "")
  };

  // convenience computed
  self.createdByDisplay = ko.pureComputed(() => {
    return self.createdBy.fullName();
  });
}
