/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import moment from "moment";
import { Entity } from "./Entity.js";

export function UnacceptedNotification(data = {}, deps = {}) {
  const self = this;

  const { 
    acknowledgeNotification = async () => { /* shut up linter its not empty */ },
    fetchMessageById = async () => { /* shut up linter its not empty */ },
    acknowledgeIumMessage = async () => { /* shut up linter its not empty */ },
    relativeUpdateTick = null,
    onAcknowledged = () => { /* shut up linter its not empty */},
    onAcknowledgeError = () => { /* shut up linter its not empty */ }
  } = deps;

  // --- core fields ---
  self.id = ko.observable(data.Id ?? null);
  self.jobId = ko.observable(data.JobId ?? null);
  self.jobIdentifier = ko.observable(data.JobIdentifier ?? "");
  self.icemIncidentIdentifier = ko.observable(data.ICEMSIncidentIdentifier ?? "");
  self.notificationTypeId = ko.observable(data.NotificationTypeId ?? null);
  self.notificationType = ko.observable(data.NotificationType ?? "");
  self.text = ko.observable(data.Text ?? "");
  self.externalRefId = ko.observable(data.ExternalRefId ?? null);

  // --- timestamps ---
  self.createdOn = ko.observable(data.CreatedOn ?? null);
  self.lastModified = ko.observable(data.LastModified ?? null);

  // --- entity/creator info ---
  self.entity = new Entity(data.Entity || {});
  self.createdBy = ko.observable(data.CreatedBy ?? "");
  self.lastModifiedBy = ko.observable(data.LastModifiedBy ?? "");

  // --- location ---
  self.jobAddress = ko.observable(data.JobAddress ?? "");
  self.latitude = ko.observable(data.Latitude ?? null);
  self.longitude = ko.observable(data.Longitude ?? null);

  // --- acknowledgement state ---
  self.acknowledged = ko.observable(data.Acknowledged ?? null);
  self.acknowledgedBy = ko.observable(data.AcknowledgedBy ?? null);

  // --- relative time display ---
  self.createdOnAgo = ko.pureComputed(() => {
    if (relativeUpdateTick) relativeUpdateTick();
    const v = self.createdOn();
    return v ? moment(v).fromNow() : "";
  });

  self.createdOnFormatted = ko.pureComputed(() => {
    const v = self.createdOn();
    return v ? moment(v).format("DD/MM/YYYY HH:mm:ss") : "";
  });

  // --- actions ---
  self.isAcknowledging = ko.observable(false);

  self.isIumMessage = () => {
    const typeId = self.notificationTypeId();
    const hasRefId = self.externalRefId();
    return hasRefId && (typeId === 13 || typeId === 14); // 13=IUMReceived, 14=UrgentIUMReceived
  };

  self.acknowledge = async function () {
    if (self.isAcknowledging()) return;
    self.isAcknowledging(true);
    try {
      // Always acknowledge the notification first
      await acknowledgeNotification(self.id());
      
      // If it's an IUM message, also acknowledge via IUM endpoint
      if (self.isIumMessage()) {
        const messageData = await fetchMessageById(self.externalRefId());
        await acknowledgeIumMessage(self.id(), messageData);
      }
      
      self.acknowledged(new Date());
      onAcknowledged(self);

    } catch (e) {
      console.error("Failed to acknowledge notification:", e);
      onAcknowledgeError(e, self);
    } finally {
      self.isAcknowledging(false);
    }
  };
}
