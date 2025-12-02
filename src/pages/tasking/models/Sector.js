import ko from 'knockout';
import { Entity } from './Entity.js';

export function Sector(data) {

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    self.id = ko.observable(data.Id || null);
    self.name = ko.observable(data.Name || null);

    self.Entity = new Entity(data.Entity || {});

    self.CurrentStatus = {
        Id: ko.observable(data.CurrentStatus?.Id || null),
        Name: ko.observable(data.CurrentStatus?.Name || null),
        Description: ko.observable(data.CurrentStatus?.Description || null),
        CreatedOn: ko.observable(data.CurrentStatus?.CreatedOn || null),
        CreatedBy: {
            Id: ko.observable(data.CurrentStatus?.CreatedBy?.Id || null),
            FirstName: ko.observable(data.CurrentStatus?.CreatedBy?.FirstName || null),
            LastName: ko.observable(data.CurrentStatus?.CreatedBy?.LastName || null),
            FullName: ko.observable(data.CurrentStatus?.CreatedBy?.FullName || null),
            Gender: ko.observable(data.CurrentStatus?.CreatedBy?.Gender || null),
            RegistrationNumber: ko.observable(data.CurrentStatus?.CreatedBy?.RegistrationNumber || null),
        },
    };

    self.SectorType = {
        Id: ko.observable(data.SectorType?.Id || null),
        Name: ko.observable(data.SectorType?.Name || null),
        Description: ko.observable(data.SectorType?.Description || null),
    };

    self.Latitude = ko.observable(data.Latitude || null);
    self.Longitude = ko.observable(data.Longitude || null);
    self.Boundary = ko.observableArray(data.Boundary || []);

    self.updateFromJson = function (data) {
        self.id(data.Id || null);
        self.name(data.Name || null);

        self.Entity = new Entity(data.Entity || {});

        self.CurrentStatus = {
            Id: ko.observable(data.CurrentStatus?.Id || null),
            Name: ko.observable(data.CurrentStatus?.Name || null),
            Description: ko.observable(data.CurrentStatus?.Description || null),
            CreatedOn: ko.observable(data.CurrentStatus?.CreatedOn || null),
            CreatedBy: {
                Id: ko.observable(data.CurrentStatus?.CreatedBy?.Id || null),
                FirstName: ko.observable(data.CurrentStatus?.CreatedBy?.FirstName || null),
                LastName: ko.observable(data.CurrentStatus?.CreatedBy?.LastName || null),
                FullName: ko.observable(data.CurrentStatus?.CreatedBy?.FullName || null),
                Gender: ko.observable(data.CurrentStatus?.CreatedBy?.Gender || null),
                RegistrationNumber: ko.observable(data.CurrentStatus?.CreatedBy?.RegistrationNumber || null),
            },
        };
    }
    self.SectorType = {
        Id: ko.observable(data.SectorType?.Id || null),
        Name: ko.observable(data.SectorType?.Name || null),
        Description: ko.observable(data.SectorType?.Description || null),
    };

    self.Latitude(data.Latitude || null);
    self.Longitude(data.Longitude || null);
    self.Boundary(data.Boundary || []);
}   