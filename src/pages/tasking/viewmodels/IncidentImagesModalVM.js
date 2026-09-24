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

    vm.selectedPosText = ko.pureComputed(() => {
        const list = vm.images();
        const cur = vm.selectedImage();
        if (!list.length || !cur) return "";
        const idx = list.indexOf(cur);
        if (idx === -1) return "";
        return `${idx + 1} of ${list.length}`;
    });

    vm.hasMultipleImages = ko.pureComputed(() => vm.images().length > 1);

    vm.isZoomed = ko.observable(false);
    vm._suppressNextClick = false;

    // The preview box's height while zoomed kept coming out wrong via CSS alone (flex-basis
    // still factors content size into an item's sizing even with overflow:hidden/auto, in
    // ways that vary by nesting -- vertical scroll broke across three different flex/block
    // rewrites while horizontal kept working). Sidestepping that entirely: measure the box's
    // real pixel size while still in the (known-correct) fitted state, and lock it there with
    // an inline style for the duration of the zoom, so overflow:auto has a hard, CSS-immune
    // number to compute scrollable area against instead of a recomputed flex value.
    vm.lockedPreviewWidthPx = ko.observable("");
    vm.lockedPreviewHeightPx = ko.observable("");

    vm.toggleZoom = () => {
        // a drag just finished on mouseup -- don't also treat it as a click-to-toggle
        if (vm._suppressNextClick) {
            vm._suppressNextClick = false;
            return;
        }

        if (!vm.isZoomed()) {
            const el = document.querySelector("#incidentImagesModal .incident-images-preview");
            if (el) {
                vm.lockedPreviewWidthPx(el.clientWidth + "px");
                vm.lockedPreviewHeightPx(el.clientHeight + "px");
            }
        } else {
            vm.lockedPreviewWidthPx("");
            vm.lockedPreviewHeightPx("");
        }

        vm.isZoomed(!vm.isZoomed());
    };

    // Drag-to-pan while zoomed: scrolls the preview box directly rather than relying on
    // the user finding scrollbars. Returning false from a knockout mousedown handler
    // prevents the browser's native image-drag/text-selection while panning.
    vm.startPan = (_data, event) => {
        if (!vm.isZoomed()) return true;

        const btn = event.currentTarget;
        const container = btn.closest(".incident-images-preview");
        if (!container) return true;

        const startX = event.clientX;
        const startY = event.clientY;
        const startScrollLeft = container.scrollLeft;
        const startScrollTop = container.scrollTop;
        let moved = false;

        btn.style.cursor = "grabbing";

        const onMove = (e) => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) moved = true;
            container.scrollLeft = startScrollLeft - dx;
            container.scrollTop = startScrollTop - dy;
        };
        const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            btn.style.cursor = "";
            if (moved) vm._suppressNextClick = true;
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        return false;
    };

    vm.zoomImageTitle = ko.pureComputed(() => vm.isZoomed() ? "Drag to pan, click to fit to window" : "Click to zoom to actual size");
    vm.zoomButtonTitle = ko.pureComputed(() => vm.isZoomed() ? "Fit to window" : "Zoom to actual size");

    vm.selectedRotation = ko.pureComputed(() => {
        const cur = vm.selectedImage();
        return cur ? cur.rotation() : 0;
    });

    vm.openImageInNewTab = () => {
        const src = vm.selectedFullSrc();
        if (!src) return;
        const win = window.open();
        if (win) {
            win.document.write(`<img src="${src}" style="max-width:100%;max-height:100%;">`);
            win.document.title = vm.selectedName();
        }
    };

    vm.downloadSelected = () => {
        const src = vm.selectedFullSrc();
        if (!src) return;
        const a = document.createElement("a");
        a.href = src;
        a.download = vm.selectedName() || "image";
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    vm.rotateLeft = () => {
        const cur = vm.selectedImage();
        if (!cur) return;
        cur.rotation((cur.rotation() + 270) % 360);
    };

    vm.rotateRight = () => {
        const cur = vm.selectedImage();
        if (!cur) return;
        cur.rotation((cur.rotation() + 90) % 360);
    };

    function stepSelection(delta) {
        const list = vm.images();
        if (!list.length) return;
        const cur = vm.selectedImage();
        let idx = cur ? list.indexOf(cur) : -1;
        idx = idx === -1 ? 0 : (idx + delta + list.length) % list.length;
        vm.selectImage(list[idx]);
    }

    vm.selectNext = () => stepSelection(1);
    vm.selectPrev = () => stepSelection(-1);

    vm._keydownHandler = (e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); vm.selectNext(); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); vm.selectPrev(); }
    };

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

        im.rotation = ko.observable(0);     // degrees, manual rotate delta (applies to the full preview too)
        im.autoRotation = ko.observable(0); // degrees, detected from the full image's EXIF orientation tag

        // The full-size image is corrected by the browser itself (it carries the EXIF tag), so only
        // the manual delta applies there. The thumbnail asset doesn't carry that tag, so it needs the
        // detected correction plus whatever manual delta the user has applied.
        im.thumbRotation = ko.pureComputed(() => (im.autoRotation() + im.rotation()) % 360);

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
                ext === "jpg" || ext === "jpeg" || ext === "thumb" ? "image/jpeg" :
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

    // Reads the EXIF Orientation tag from JPEG bytes and returns the CSS rotation (deg)
    // needed to display it upright. Only handles the non-mirrored orientations (1/3/6/8),
    // which covers the vast majority of camera-phone photos; mirrored scans return 0.
    function parseJpegOrientationDegrees(buffer) {
        try {
            const view = new DataView(buffer);
            if (view.getUint16(0, false) !== 0xFFD8) return 0;

            let offset = 2;
            const length = view.byteLength;
            while (offset + 4 <= length) {
                const marker = view.getUint16(offset, false);
                offset += 2;

                if (marker === 0xFFE1) {
                    if (view.getUint32(offset + 2, false) !== 0x45786966) return 0; // "Exif"
                    const tiffOffset = offset + 8;
                    const little = view.getUint16(tiffOffset, false) === 0x4949;
                    const firstIFDOffset = view.getUint32(tiffOffset + 4, little);
                    const dirStart = tiffOffset + firstIFDOffset;
                    const entries = view.getUint16(dirStart, little);
                    for (let i = 0; i < entries; i++) {
                        const entryOffset = dirStart + 2 + i * 12;
                        if (view.getUint16(entryOffset, little) === 0x0112) {
                            const value = view.getUint16(entryOffset + 8, little);
                            return { 3: 180, 6: 90, 8: 270 }[value] || 0;
                        }
                    }
                    return 0;
                } else if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFDA) {
                    return 0; // start of scan / not a marker segment -- no EXIF found before pixel data
                } else {
                    offset += view.getUint16(offset, false);
                }
            }
        } catch (_e) {
            // malformed/unsupported data -- leave un-rotated
        }
        return 0;
    }

    async function detectOrientationDegrees(url) {
        try {
            const buffer = await (await fetch(url)).arrayBuffer();
            return parseJpegOrientationDegrees(buffer);
        } catch (_e) {
            return 0;
        }
    }

    async function getIncidentImages(jobId, token) {
        try {
            const list = await BeaconClient.images.getIncidentImages(jobId, { host: apiHost, userId, token });
            return list || [];
        } catch (_e) {
            return null;
        }
    }

    async function getImageData(name, token) {
        const data = await BeaconClient.images.getImageData(vm.job().id(), name, { host: apiHost, userId, token });
        if (data == null) {
            throw new Error("No data returned");
        }
        return data;
    }

    vm._loadThumb = async (im, token) => {
        if (!im) return;

        // If already cached, make sure spinner is off
        if (im.thumbUrl && im.thumbUrl()) {
            im.loadingThumb(false);
            return;
        }

        if (im.loadingThumb()) return;

        const thumbName = im.thumbName();
        if (!thumbName) {
            im.loadingThumb(false);
            return;
        }

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
        if (!im) return;

        // If already cached, make sure spinners are off
        if (im.fullUrl && im.fullUrl()) {
            im.loadingFull(false);
            vm.loadingFull(false);
            return;
        }

        if (im.loadingFull()) return;

        const imageName = im.imageName();
        if (!imageName) {
            im.loadingFull(false);
            vm.loadingFull(false);
            return;
        }

        im.loadingFull(true);
        vm.loadingFull(true);
        try {
            const data = await getImageData(imageName, token);
            const url = asUrl(data, im.extension());
            if (url.startsWith("blob:")) im._fullObjectUrl = url;
            im.fullUrl(url);

            // Detect the thumbnail's needed rotation from the full image's EXIF tag (the
            // thumbnail asset itself doesn't carry one). Non-blocking -- the preview doesn't
            // need this since the browser already auto-orients the full-size <img>.
            detectOrientationDegrees(url).then(deg => im.autoRotation(deg));
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
        vm.isZoomed(false);
        vm.lockedPreviewWidthPx("");
        vm.lockedPreviewHeightPx("");

        // always reset VM-level spinner on selection change
        vm.loadingFull(false);

        if (!im) return;

        // If already cached, show immediately and ensure spinners are off
        if (im.fullUrl && im.fullUrl()) {
            im.loadingFull(false);
            vm.loadingFull(false);
            vm.selectedFullSrc(im.fullUrl());
            return;
        }

        const token = await getToken();
        await vm._loadFull(im, token);

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

        document.removeEventListener("keydown", vm._keydownHandler);
        document.addEventListener("keydown", vm._keydownHandler);

        vm.loadingList(true);
        try {
            const token = await getToken();
            const list = await getIncidentImages(job.id(), token);

            const vms = (list || []).map(dto => new ImageVM(dto));
            vm.images(vms);
            // thumbs in background
            prefetchThumbs(vms, token, 4);

            if (vms.length) await vm.selectImage(vms[0]);
        } catch (e) {
            vm.errorText("Failed to load incident image list.");
            console.error("Image list load failed:", e);
        } finally {
            vm.loadingList(false);
        }

        modalEl.addEventListener("hidden.bs.modal", () => {
            document.removeEventListener("keydown", vm._keydownHandler);
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
