import ko from "knockout";

export function Tag(data = {}) {
    this.id = ko.observable(data.Id ?? null);
    this.name = ko.observable(data.Name ?? "");
    this.tagGroupId = ko.observable(data.TagGroupId ?? null);
}