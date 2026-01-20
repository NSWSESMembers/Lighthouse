/* eslint-disable @typescript-eslint/no-this-alias */
import ko from "knockout";
import * as bootstrap from 'bootstrap5'; // gives you Modal, Tooltip, etc.


export default function IncidentImagesModalVM({ getToken, apiHost, userId, BeaconClient }) {
    const vm = this;

    vm.modalInstance = null;

    vm.job = ko.observable(null);
    vm.title = ko.pureComputed(() => {
        const j = vm.job();
        if (!j) return "Incident images";
        const ident = (typeof j.identifier === "function") ? j.identifier() : "";
        const id = (typeof j.id === "function") ? j.id() : "";
        return `Incident ${ident || id} images`;
    });

    vm.images = ko.observableArray([]); // ImageVM[]
    vm.selectedImage = ko.observable(null);

    vm.loadingList = ko.observable(false);
    vm.loadingFull = ko.observable(false);
    vm.errorText = ko.observable("");

    vm.errorText = ko.observable("");
    vm.hasError = ko.pureComputed(() => !!vm.errorText());

    vm.showNoImages = ko.pureComputed(() => {
        return !vm.loadingList() && vm.images().length === 0 && !vm.hasError();
    });

    vm.selectedFullSrc = ko.observable("");     // string
    vm.selectedName = ko.observable("");        // string

    vm.selectedFullReady = ko.pureComputed(() => !!vm.selectedFullSrc());
    vm.selectedNameReady = ko.pureComputed(() => !!vm.selectedName());

    vm.showSelectHint = ko.pureComputed(() => {
        return !vm.loadingList() && !vm.loadingFull() && vm.images().length > 0 && !vm.selectedFullReady();
    });

    function ImageVM(dto) {
        const im = this;
        im.imageName = ko.observable(dto?.Image || "");
        im.extension = ko.observable(dto?.Extension || "");
        im.thumbName = ko.observable(dto?.Thumbnail || "");

        im.thumbUrl = ko.observable("");
        im.fullUrl = ko.observable("");

        im.loadingThumb = ko.observable(false);
        im.loadingFull = ko.observable(false);

        im.thumbReady = ko.pureComputed(() => !!im.thumbUrl());

        im._thumbObjectUrl = null;
        im._fullObjectUrl = null;

        im.dispose = () => {
            if (im._thumbObjectUrl) URL.revokeObjectURL(im._thumbObjectUrl);
            if (im._fullObjectUrl) URL.revokeObjectURL(im._fullObjectUrl);
            im._thumbObjectUrl = null;
            im._fullObjectUrl = null;
        };
    }

    function asUrl(data, extHint) {
        if (!data) return "";

        // unwrap common response shapes
        if (typeof data === "object" && data.Data && typeof data.Data === "string") data = data.Data;
        if (typeof data === "object" && data.data && typeof data.data === "string") data = data.data;

        if (typeof data === "string") {
            if (data.startsWith("data:")) return data;

            const ext = (extHint || "jpeg").toLowerCase();
            const mime =
                ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
                    ext === "png" ? "image/png" :
                        ext === "gif" ? "image/gif" :
                            "application/octet-stream";

            return `data:${mime};base64,${data}`;
        }

        if (data instanceof Blob) return URL.createObjectURL(data);

        try {
            return URL.createObjectURL(new Blob([data]));
        } catch (_e) {
            return "";
        }
    }

    function getIncidentImages(jobId, token) {
        return new Promise((resolve, reject) => {
            BeaconClient.images.getIncidentImages(
                jobId, apiHost, userId, token,
                (list) => resolve(list || []),
                (err) => reject(err)
            );
        });
    }

    function getImageData(name, token) {
        console.log(name,token)
        return new Promise((resolve, reject) => {
            BeaconClient.images.getImageData(
                vm.job().id(), name, apiHost, userId, token,
                (data) => resolve(data),
                (err) => reject(err)
            );
        });
    }

    vm._loadThumb = async (im, token) => {
        if (!im || im.thumbUrl() || im.loadingThumb()) return;
        const thumbName = im.thumbName();
        if (!thumbName) return;

        im.loadingThumb(true);
        try {
            const data = await getImageData(thumbName, token);
            const url = asUrl(data, "jpeg");
            if (url.startsWith("blob:")) im._thumbObjectUrl = url;
            im.thumbUrl(url);
        } catch (e) {
            console.error("Thumb load failed:", e);
        } finally {
            im.loadingThumb(false);
        }
    };

    vm._loadFull = async (im, token) => {
        if (!im || im.fullUrl() || im.loadingFull()) return;
        const imageName = im.imageName();
        if (!imageName) return;

        im.loadingFull(true);
        vm.loadingFull(true);
        try {
            const data = await getImageData(imageName, token);
            const url = asUrl(data, im.extension());
            if (url.startsWith("blob:")) im._fullObjectUrl = url;
            im.fullUrl(url);
        } catch (e) {
            vm.errorText("Failed to load image.");
            console.error("Full load failed:", e);
        } finally {
            im.loadingFull(false);
            vm.loadingFull(false);
        }
    };

    async function prefetchThumbs(list, token, concurrency = 4) {
        let i = 0;
        async function worker() {
            while (i < list.length) {
                const idx = i++;
                const im = list[idx];
                if (!im || im.thumbUrl()) continue;
                await vm._loadThumb(im, token);
            }
        }
        await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
    }

    vm.selectImage = async (im) => {
        vm.selectedImage(im || null);
        vm.selectedFullSrc("");
        vm.selectedName(im ? im.imageName() : "");
        vm.errorText("");

        if (!im) return;

        const token = await getToken();
        await vm._loadFull(im, token);

        // after full loads, push to VM-level observable for simple binding
        vm.selectedFullSrc(im.fullUrl() || "");
    };


    vm.openForJob = async (job) => {
        vm.errorText("");
        vm.job(job || null);
        vm.selectedImage(null);

        // dispose old urls
        vm.images().forEach(x => x.dispose && x.dispose());
        vm.images.removeAll();

        const modalEl = document.getElementById("incidentImagesModal");
        if (!modalEl) return;

        vm.modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        vm.modalInstance.show();

        vm.loadingList(true);
        try {
            const token = await getToken();
            const list = await getIncidentImages(job.id(), token);

            const vms = (list || []).map(dto => new ImageVM(dto));
            vm.images(vms);
            // thumbs in background
            prefetchThumbs(job.id(), vms, token, 4);

            if (vms.length) await vm.selectImage(vms[0]);
        } catch (e) {
            vm.errorText("Failed to load incident image list.");
            console.error("Image list load failed:", e);
        } finally {
            vm.loadingList(false);
        }

        modalEl.addEventListener("hidden.bs.modal", () => {
            vm.images().forEach(x => x.dispose && x.dispose());
            vm.images.removeAll();
            vm.selectedImage(null);
            vm.job(null);
            vm.errorText("");
            vm.loadingList(false);
            vm.loadingFull(false);
        }, { once: true });
    };
}
