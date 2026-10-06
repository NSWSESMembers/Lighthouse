/*
  Fake incident photos for the demo: simple illustrated storm-damage scenes
  drawn as SVG, rasterised to JPEG with the harness's own Chrome at launch.
  Nothing photographic and nothing real -- each is watermarked "Demo image".
*/

const W = 2400;
const H = 1600;

const sky = (top, bottom) => `
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
  </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>`;

const rain = Array.from({ length: 140 }, (_, i) => {
  const x = (i * 211) % W;
  const y = (i * 137) % (H - 200);
  return `<line x1="${x}" y1="${y}" x2="${x - 18}" y2="${y + 60}" stroke="#cfd8e3" stroke-width="3" opacity="0.6"/>`;
}).join('');

const watermark = `<text x="${W - 40}" y="${H - 40}" text-anchor="end" font-family="Arial" font-size="56" fill="#fff" opacity="0.75">Demo image</text>`;

const SCENES = [
  // Roof with dislodged tiles and a tarp.
  `${sky('#6b7a8f', '#a9b4c2')}
   <rect y="1250" width="${W}" height="350" fill="#5f7d4a"/>
   <rect x="600" y="800" width="1200" height="500" fill="#e8dcc4"/>
   <polygon points="520,820 1200,380 1880,820" fill="#a0522d"/>
   <polygon points="900,640 1250,470 1500,620 1150,790" fill="#2b6cb0"/>
   <g fill="#7a3b1c">${Array.from({ length: 9 }, (_, i) => `<rect x="${700 + i * 110}" y="${700 - (i % 3) * 30}" width="70" height="40" transform="rotate(${(i * 23) % 40 - 20} ${735 + i * 110} ${720})"/>`).join('')}</g>
   <rect x="1050" y="1000" width="220" height="300" fill="#6b4226"/>
   <rect x="720" y="940" width="200" height="160" fill="#9cc3e6"/><rect x="1480" y="940" width="200" height="160" fill="#9cc3e6"/>
   ${rain}${watermark}`,

  // Tree limb down across a front yard and driveway.
  `${sky('#7d8a99', '#b8c2cc')}
   <rect y="1100" width="${W}" height="500" fill="#6a8f4e"/>
   <polygon points="1300,1100 1700,1100 2100,1600 1500,1600" fill="#9a9a9a"/>
   <rect x="200" y="300" width="120" height="820" fill="#5b3a22"/>
   <circle cx="260" cy="300" r="300" fill="#3f6b2f"/>
   <g transform="rotate(12 900 1150)">
     <rect x="300" y="1120" width="1500" height="70" rx="30" fill="#5b3a22"/>
     <rect x="1100" y="1060" width="400" height="30" rx="12" fill="#5b3a22" transform="rotate(-25 1100 1075)"/>
     <circle cx="1650" cy="1080" r="170" fill="#4a7a36"/><circle cx="1400" cy="1050" r="130" fill="#3f6b2f"/>
   </g>
   <rect x="1700" y="900" width="500" height="220" rx="40" fill="#c0392b"/>
   ${rain}${watermark}`,

  // Collapsed gutter with water running down a wall.
  `${sky('#5f6b7a', '#9aa5b1')}
   <rect x="0" y="500" width="${W}" height="1100" fill="#d9cdb4"/>
   <rect x="0" y="420" width="${W}" height="80" fill="#8b4513"/>
   <polygon points="300,500 1300,500 1900,760 1850,800 1250,560 300,560" fill="#9ea7ad"/>
   <path d="M1880 790 C1870 1000 1910 1200 1880 1600" stroke="#5b8db8" stroke-width="40" fill="none" opacity="0.7"/>
   <path d="M1700 700 C1690 900 1720 1100 1700 1600" stroke="#5b8db8" stroke-width="22" fill="none" opacity="0.5"/>
   <rect x="500" y="800" width="380" height="300" fill="#9cc3e6"/><rect x="1100" y="800" width="380" height="300" fill="#9cc3e6"/>
   <rect x="1600" y="1150" width="560" height="450" fill="#b9a98a" opacity="0.6"/>
   ${rain}${watermark}`,
];

/** The photo list for a job, in Beacon's Image/IncidentThumbnails structure. */
export function photoList(jobId, count) {
  return Array.from({ length: count }, (_, i) => {
    const stem = `demoimg_${String(jobId).padStart(6, '0')}_2026100514300000${i + 1}`;
    return { Image: `${stem}.jpeg`, Extension: 'jpeg', Thumbnail: `${stem}.thumb` };
  });
}

/**
 * Rasterise the scenes once per browser context. Returns name-agnostic
 * buffers by scene index: { full: Buffer[], thumb: Buffer[] }.
 */
export async function renderPhotos(context) {
  // A fresh page per image: reusing one page across viewport sizes left a
  // stale frame in the first thumbnail.
  const shoot = async (svg, width, height) => {
    const page = await context.newPage();
    await page.setViewportSize({ width, height });
    await page.setContent(`<html><body style="margin:0;overflow:hidden"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${width}" height="${height}" style="display:block">${svg}</svg></body></html>`);
    const buf = await page.screenshot({ type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width, height } });
    await page.close();
    return buf;
  };
  const full = [];
  const thumb = [];
  for (const svg of SCENES) {
    full.push(await shoot(svg, W, H));
    thumb.push(await shoot(svg, 240, 160));
  }
  return { full, thumb };
}

/** Scene index for an image/thumbnail name from photoList(). */
export function sceneIndex(name) {
  const m = /_2026100514300000(\d+)\./.exec(name);
  return m ? (Number(m[1]) - 1) % SCENES.length : 0;
}
