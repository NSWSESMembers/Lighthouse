/*
  Situation On Scene word cloud, laid out with d3-cloud into an SVG.
*/

import cloud from 'd3-cloud';
import { select, scaleSqrt, extent } from 'd3';

const WIDTH = 1200;
const HEIGHT = 320;
const COLORS = ['#c0392b', '#d35400', '#2471a3', '#1e8449', '#7d3c98', '#5d6d7e'];

// Seeded, so the same words always land in the same places (stable
// between refreshes and in screenshots).
function seededRandom(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Lays out and draws `words` into `el`, replacing what was there.
 *
 * @param {Element} el
 * @param {Array<{text: string, weight: number}>} words  most frequent first
 * @returns {() => void}  stops a layout still in progress
 */
export function renderWordCloud(el, words) {
  const root = select(el);
  root.selectAll('*').remove();
  if (!words.length) {
    root.append('p').attr('class', 'text-body-secondary text-center my-4').text('No situation text in the filtered incidents.');
    return () => {};
  }

  const [min, max] = extent(words, (w) => w.weight);
  const size = scaleSqrt().domain([min, Math.max(max, min + 1)]).range([12, 60]);

  const layout = cloud()
    .size([WIDTH, HEIGHT])
    // The count goes in `count`: d3-cloud writes the font weight into `weight`.
    .words(words.map((w, i) => ({ text: w.text, count: w.weight, size: size(w.weight), i })))
    .padding(3)
    .random(seededRandom())
    .rotate((d) => (d.i % 4 === 3 ? 90 : 0))
    .font('system-ui, sans-serif')
    .fontSize((d) => d.size)
    .on('end', (placed) => {
      root.selectAll('*').remove();
      const svg = root.append('svg')
        .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
        .attr('class', 'word-cloud')
        .attr('role', 'img')
        .attr('aria-label', 'Most common words in Situation On Scene');
      svg.append('g')
        .attr('transform', `translate(${WIDTH / 2},${HEIGHT / 2})`)
        .selectAll('text')
        .data(placed)
        .join('text')
        .attr('text-anchor', 'middle')
        .attr('transform', (d) => `translate(${d.x},${d.y}) rotate(${d.rotate})`)
        .style('font-size', (d) => `${d.size}px`)
        .style('font-family', 'system-ui, sans-serif')
        .style('fill', (d) => COLORS[d.i % COLORS.length])
        .text((d) => d.text)
        .append('title')
        .text((d) => `${d.text}: ${d.count} ${d.count === 1 ? 'mention' : 'mentions'}`);
    });
  layout.start();
  return () => layout.stop();
}
