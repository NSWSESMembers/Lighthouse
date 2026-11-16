// Near-black is the unphotographed border around each image (lossy JP2, so
// not quite 0), not part of the photo.
const BORDER_MAX = 3;

/**
 * Make the black border around flood imagery transparent.
 *
 * @param {Uint8ClampedArray} data  RGBA pixels, changed in place
 * @returns {boolean} whether any of the image is still visible
 */
export function clearImageBorder(data) {
    let visible = false;
    for (let o = 0; o < data.length; o += 4) {
        if (data[o + 3] === 0) continue;
        if (data[o] <= BORDER_MAX && data[o + 1] <= BORDER_MAX && data[o + 2] <= BORDER_MAX) data[o + 3] = 0;
        else visible = true;
    }
    return visible;
}
