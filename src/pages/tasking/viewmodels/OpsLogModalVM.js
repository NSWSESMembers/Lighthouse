import ko from "knockout";
import { OpsLogEntry } from "../models/OpsLogEntry.js";

export function OpsLogModalVM(parentVm) {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const self = this;

  self.job = ko.observable(null);
  self.entries = ko.observableArray([]);
  self.loading = ko.observable(false);
  self.jobIdentifier = ko.observable();

  self.openForJob = async (job) => {
    self.jobIdentifier(job.identifier() || ""); //I have no idea why this is needed separately
    self.job(job);
    self.entries([]);
    self.loading(true);
    try {
      const results = await new Promise((resolve, reject) => {
        parentVm.fetchOpsLogForJob(job.id(), (res) => resolve(res), reject);
      });
      self.entries((results || []).map(e => new OpsLogEntry(e)));
    } catch (err) {
      console.error("Failed to fetch ops log entries:", err);
    } finally {
      self.loading(false);
    }
  };
}
