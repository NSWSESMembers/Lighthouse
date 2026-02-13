import ko from "knockout";

export function Address(data = {}) {

    this.gnafId = ko.observable(data.GnafId ?? null);
    this.latitude = ko.observable(data.Latitude ?? null);
    this.longitude = ko.observable(data.Longitude ?? null);
    this.streetNumber = ko.observable(data.StreetNumber ?? "");
    this.street = ko.observable(data.Street ?? "");
    this.locality = ko.observable(data.Locality ?? "");
    this.postCode = ko.observable(data.PostCode ?? "");
    this.prettyAddress = ko.observable(data.PrettyAddress ?? "");
    this.additionalAddressInfo = ko.observable(data.AdditionalAddressInfo ?? null)

    this.latLng = ko.pureComputed(() => {
        const lat = +this.latitude(), lng = +this.longitude();
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    });
}