// OpsLogEntry.js
/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import moment from "moment";
import { Entity } from "./Entity.js";
import { Tag } from "./Tag.js";

export function OpsLogEntry(data = {}) {
  const self = this;

  // --- core ids/links ---
  self.id = ko.observable(data.Id ?? null);
  self.jobLabel = ko.observable(data.JobLabel ?? null);
  self.jobId = ko.observable(data.JobId ?? null);
  self.eventLabel = ko.observable(data.EventLabel ?? null);
  self.eventId = ko.observable(data.EventId ?? null);

  // --- entity (origin/owner) ---
  self.entity = new Entity(data.Entity || {});

  // --- flags/booleans ---
  self.important = ko.observable(!!data.Important);
  self.restricted = ko.observable(!!data.Restricted);
  self.actionRequired = ko.observable(!!data.ActionRequired);
  self.readOnly = ko.observable(!!data.ReadOnly);

  // --- talkgroup metadata (nullable) ---
  self.talkgroupId = ko.observable(data.TalkgroupId ?? null);
  self.talkgroupLabel = ko.observable(data.TalkgroupLabel ?? null);
  self.talkgroupRequestId = ko.observable(data.TalkgroupRequestId ?? null);
  self.talkgroupRequestLabel = ko.observable(data.TalkgroupRequestLabel ?? null);

  // --- message content ---
  self.subject = ko.observable(data.Subject ?? "");
  self.text = ko.observable(data.Text ?? "");

  // --- timing ---
  self.timeLogged = ko.observable(data.TimeLogged ?? null);   // ISO string
  self.createdOn = ko.observable(data.CreatedOn ?? null);     // ISO string

  // --- tags & createdBy ---
  self.tags = ko.observableArray((data.Tags || []).map(t => new Tag(t)));
  self.createdBy = {
    id: ko.observable(data.CreatedBy?.Id ?? null),
    firstName: ko.observable(data.CreatedBy?.FirstName ?? ""),
    lastName: ko.observable(data.CreatedBy?.LastName ?? ""),
    fullName: ko.observable(data.CreatedBy?.FullName ?? ""),
    gender: ko.observable(data.CreatedBy?.Gender ?? null),
    registrationNumber: ko.observable(data.CreatedBy?.RegistrationNumber ?? null)
  };

  // --- ICEMS fields ---
  self.icemsIncidentIdentifier = ko.observable(data.ICEMSIncidentIdentifier ?? null);

  // --- misc (nullable) ---
  self.position = ko.observable(data.Position ?? null);           // keep raw (could be {lat,lng} or string per API)
  self.actionReminder = ko.observable(data.ActionReminder ?? null);

  // --- quality-of-life computed values ---
  const _tick = ko.observable(Date.now());
  setInterval(() => _tick(Date.now()), 60000); // refresh “ago” labels every 60s

  self.timeLoggedFormatted = ko.pureComputed(() => {
    const v = self.timeLogged();
    return v ? moment(v).format("DD/MM/YYYY HH:mm:ss") : null;
  });

  self.createdOnFormatted = ko.pureComputed(() => {
    const v = self.createdOn();
    return v ? moment(v).format("DD/MM/YYYY HH:mm:ss") : null;
  });

  self.timeLoggedAgo = ko.pureComputed(() => {
    _tick(); // depend on timer
    const v = self.timeLogged();
    return v ? moment(v).fromNow() : "-";
  });

  self.tagsCsv = ko.pureComputed(() => self.tags().map(t => t.name()).join(", "));

  self.createdByDisplay = ko.pureComputed(() => {
    const n = self.createdBy.fullName();
    const rn = self.createdBy.registrationNumber();
    return n || rn ? [n, rn].filter(Boolean).join(" — ") : "";
  });

  self.hasPoliceTag = ko.pureComputed(() =>
    self.tags().some(t => (t.name?.() || "").toLowerCase() === "police")
  );

  self.hasIncomingTag = ko.pureComputed(() =>
    self.tags().some(t => (t.name?.() || "").toLowerCase() === "incoming")
  );

  // --- patch/update helper (partial updates) ---
  OpsLogEntry.prototype.updateFromJson = function (d = {}) {
    if (d.Id !== undefined) this.id(d.Id);
    if (d.JobLabel !== undefined) this.jobLabel(d.JobLabel);
    if (d.JobId !== undefined) this.jobId(d.JobId);
    if (d.EventLabel !== undefined) this.eventLabel(d.EventLabel);
    if (d.EventId !== undefined) this.eventId(d.EventId);

    if (d.Entity !== undefined) {
      this.entity.id(d.Entity?.Id ?? null);
      this.entity.code(d.Entity?.Code ?? "");
      this.entity.name(d.Entity?.Name ?? "");
      this.entity.latitude(d.Entity?.Latitude ?? null);
      this.entity.longitude(d.Entity?.Longitude ?? null);
      this.entity.parentEntity(
        d.Entity?.ParentEntity
          ? { id: d.Entity.ParentEntity.Id, code: d.Entity.ParentEntity.Code, name: d.Entity.ParentEntity.Name }
          : null
      );
    }

    if (d.Important !== undefined) this.important(!!d.Important);
    if (d.Restricted !== undefined) this.restricted(!!d.Restricted);
    if (d.ActionRequired !== undefined) this.actionRequired(!!d.ActionRequired);
    if (d.ReadOnly !== undefined) this.readOnly(!!d.ReadOnly);

    if (d.TalkgroupId !== undefined) this.talkgroupId(d.TalkgroupId ?? null);
    if (d.TalkgroupLabel !== undefined) this.talkgroupLabel(d.TalkgroupLabel ?? null);
    if (d.TalkgroupRequestId !== undefined) this.talkgroupRequestId(d.TalkgroupRequestId ?? null);
    if (d.TalkgroupRequestLabel !== undefined) this.talkgroupRequestLabel(d.TalkgroupRequestLabel ?? null);

    if (d.Subject !== undefined) this.subject(d.Subject ?? "");
    if (d.Text !== undefined) this.text(d.Text ?? "");

    if (d.TimeLogged !== undefined) this.timeLogged(d.TimeLogged ?? null);
    if (d.CreatedOn !== undefined) this.createdOn(d.CreatedOn ?? null);

    if (Array.isArray(d.Tags)) this.tags(d.Tags.map(t => new Tag(t)));

    if (d.CreatedBy !== undefined) {
      this.createdBy.id(d.CreatedBy?.Id ?? null);
      this.createdBy.firstName(d.CreatedBy?.FirstName ?? "");
      this.createdBy.lastName(d.CreatedBy?.LastName ?? "");
      this.createdBy.fullName(d.CreatedBy?.FullName ?? "");
      this.createdBy.gender(d.CreatedBy?.Gender ?? null);
      this.createdBy.registrationNumber(d.CreatedBy?.RegistrationNumber ?? null);
    }

    if (d.ICEMSIncidentIdentifier !== undefined) this.icemsIncidentIdentifier(d.ICEMSIncidentIdentifier ?? null);
    if (d.Position !== undefined) this.position(d.Position ?? null);
    if (d.ActionReminder !== undefined) this.actionReminder(d.ActionReminder ?? null);
  };

  // helpers
  self.addTag = (t) => self.tags.push(new Tag(t));
  self.removeTagId = (id) => self.tags.remove(x => x.id() === id);
}