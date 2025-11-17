import ko from 'knockout';

export function Entity(data = {}) {
    if (!data) data = {};
    this.id = ko.observable(data.Id ?? null);
    this.code = ko.observable(data.Code ?? "");
    this.name = ko.observable(data.Name ?? "");
    this.latitude = ko.observable(data.Latitude ?? null);
    this.longitude = ko.observable(data.Longitude ?? null);
    this.parentEntity = ko.observable(null);
    if (data.ParentEntity !== null && data.ParentEntity !== undefined) {
        this.parentEntity(new Entity(data.ParentEntity));
    }
}