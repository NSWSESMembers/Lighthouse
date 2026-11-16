// Turns a grid of ground heights (NSW_Elevation tiles, see
// mapLayers/heightShading.js) into coloured, relief-shaded tile pixels.

export const TILE_SIZE = 256;

/** [height in metres, [r, g, b]]. Tight spacing low down, so floodplains show detail. */
export const HEIGHT_STOPS = [
    [0, [40, 120, 90]],
    [10, [92, 170, 96]],
    [25, [166, 206, 110]],
    [50, [238, 226, 130]],
    [100, [240, 186, 96]],
    [250, [214, 130, 70]],
    [500, [168, 92, 60]],
    [1000, [140, 110, 100]],
    [1500, [230, 226, 222]],
];

// Open ocean comes through as about -3.4e38 rather than masked.
const NO_DATA_BELOW = -1000;

/** [slope in degrees where the band starts, [r, g, b]]; flatter ground is left clear. */
export const STEEPNESS_BANDS = [
    [5, [255, 237, 160]],
    [10, [254, 196, 79]],
    [20, [245, 130, 40]],
    [30, [215, 48, 39]],
    [45, [122, 1, 119]],
];

const MIN_SHADE = 0.35;
const MAX_SHADE = 1.15;
// Unit vector towards a light in the north-west, 45 degrees up (x east, y south, z up).
const LIGHT_X = -0.5;
const LIGHT_Y = -0.5;
const LIGHT_Z = Math.SQRT1_2;

const WORLD_METRES = 40075016.68557849;

/** Colour for a height in metres, clamped to the ends of the scale. */
export function heightColor(h) {
    if (h <= HEIGHT_STOPS[0][0]) return HEIGHT_STOPS[0][1];
    for (let i = 1; i < HEIGHT_STOPS.length; i++) {
        const [top, topColor] = HEIGHT_STOPS[i];
        if (h <= top) {
            const [bottom, bottomColor] = HEIGHT_STOPS[i - 1];
            const t = (h - bottom) / (top - bottom);
            return bottomColor.map((v, k) => v + (topColor[k] - v) * t);
        }
    }
    return HEIGHT_STOPS[HEIGHT_STOPS.length - 1][1];
}

/** Ground distance in metres between grid cells of a tile at (y, z). */
export function tileCellMetres(y, z) {
    const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / 2 ** z)));
    return (WORLD_METRES / 2 ** z / TILE_SIZE) * Math.cos(lat);
}

/** Colour for a slope in degrees, or null if it's flatter than the first band. */
export function steepnessColor(degrees) {
    let color = null;
    for (const [from, c] of STEEPNESS_BANDS) {
        if (degrees < from) break;
        color = c;
    }
    return color;
}

/**
 * Run paint(o, h, dx, dy) for each land cell: o is the pixel's offset in out,
 * h the height, dx and dy the rise per metre to the east and south. The grid has one more row and column
 * one more row and column than the tile, so every pixel has a neighbour to the
 * east and south. Sea (height exactly 0 or no data) and missing cells stay
 * transparent.
 *
 * @param {ArrayLike<number>} heights   grid, row by row
 * @param {number} width                grid width in cells
 * @param {ArrayLike<number>|null} mask 0 where a cell has no data, if any
 * @param {number} cellMetres           see tileCellMetres
 * @param {Uint8ClampedArray} out       TILE_SIZE x TILE_SIZE RGBA
 * @param {(o: number, h: number, dx: number, dy: number) => void} paint
 */
function paintLandCells(heights, width, mask, cellMetres, out, paint) {
    const isLand = (i) => (!mask || mask[i] !== 0) && heights[i] > NO_DATA_BELOW && heights[i] !== 0;

    for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
            const i = y * width + x;
            const o = (y * TILE_SIZE + x) * 4;
            if (!isLand(i)) {
                out[o + 3] = 0;
                continue;
            }

            const h = heights[i];
            const dx = ((isLand(i + 1) ? heights[i + 1] : h) - h) / cellMetres;
            const dy = ((isLand(i + width) ? heights[i + width] : h) - h) / cellMetres;
            paint(o, h, dx, dy);
        }
    }
}

/** Colour a height grid by height, with relief shading. See paintLandCells for the arguments. */
export function paintHeightTile(heights, width, mask, cellMetres, out) {
    paintLandCells(heights, width, mask, cellMetres, out, (o, h, dx, dy) => {
        // Surface normal is (-dx, -dy, 1); flat ground comes out at 1.
        const lit = (-dx * LIGHT_X - dy * LIGHT_Y + LIGHT_Z) / Math.hypot(dx, dy, 1) / LIGHT_Z;
        const shade = Math.max(MIN_SHADE, Math.min(MAX_SHADE, lit));

        const color = heightColor(h);
        out[o] = color[0] * shade;
        out[o + 1] = color[1] * shade;
        out[o + 2] = color[2] * shade;
        out[o + 3] = 255;
    });
}

/** Colour a height grid by steepness; gentle ground stays clear. See paintLandCells for the arguments. */
export function paintSteepnessTile(heights, width, mask, cellMetres, out) {
    paintLandCells(heights, width, mask, cellMetres, out, (o, _h, dx, dy) => {
        const color = steepnessColor((Math.atan(Math.hypot(dx, dy)) * 180) / Math.PI);
        if (!color) {
            out[o + 3] = 0;
            return;
        }
        out[o] = color[0];
        out[o + 1] = color[1];
        out[o + 2] = color[2];
        out[o + 3] = 255;
    });
}
