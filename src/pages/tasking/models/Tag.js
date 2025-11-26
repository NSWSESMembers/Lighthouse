import ko from "knockout";
import { returnTagIcon, returnTagClass } from "../utils/tagFactory.js";

export function Tag(data = {}) {
  this.id = ko.observable(data.Id ?? null);
  this.name = ko.observable(data.Name ?? "");
  this.tagGroupId = ko.observable(data.TagGroupId ?? null);

  this.returnTagText = ko.pureComputed(() => {
    return `${this.name()}`;
  });

  this.returnTagClass = ko.pureComputed(() => {
    return returnTagClass(this.tagGroupId());
  });

  this.returnTagClassSelected = ko.pureComputed(() => {
    return `${returnTagClass(this.tagGroupId())}-selected`;
  });

  this.returnTagIcon = ko.pureComputed(() => {
    return returnTagIcon(this.tagGroupId());
  });
}


