import ko from 'knockout';

export function Entity(data = {}) {
    this.id = ko.observable(data.Id ?? null);
    this.code = ko.observable(data.Code ?? "");
    this.name = ko.observable(data.Name ?? "");
    this.latitude = ko.observable(data.Latitude ?? null);
    this.longitude = ko.observable(data.Longitude ?? null);
    this.parentEntity = ko.observable(
        data.ParentEntity ? { id: data.ParentEntity.Id, code: data.ParentEntity.Code, name: data.ParentEntity.Name } : null
    );
}