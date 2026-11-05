/*
  Breakdown pie styling: a donut with the hovered slice's details in the
  middle, and an HTML legend beside it (swatch, name, count, %) that's
  linked both ways with the slices -- hover either to highlight the pair,
  click either to filter.
*/

import { select } from 'd3';

// 18 distinguishable colours (Tableau 20 without its greys): the strong
// shades first, then the light ones. Grey is kept for "Others".
export const PIE_PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#59a14f', '#b07aa1', '#76b7b2', '#edc948', '#ff9da7', '#9c755f',
  '#a0cbe8', '#ffbe7d', '#ff9d9a', '#8cd17d', '#d4a6c8', '#86bcb6', '#f1ce63', '#fabfd2', '#d7b5a6',
];
export const OTHERS_COLOR = '#a5a5a5';
export const OTHERS_LABEL = 'Others';

/**
 * Colour per key for one chart. Keys get colours in the order first seen,
 * so passing them biggest-first gives the big slices the strong colours,
 * and a key keeps its colour across filtering and refreshes.
 *
 * A chart can have far more keys than colours (Locality, Assigned Unit), so
 * colours repeat across keys. Before each render, call `fit()` with the keys
 * about to be shown: any shown key whose colour a bigger shown slice already
 * has moves to a free colour, so the slices on screen never share one. At
 * most 10 slices show (9 + Others), against 18 colours.
 *
 * @param {string[]} [initialKeys]  keys to assign first (largest first)
 * @returns {((key: string) => string) & {fit: (shownKeys: string[]) => void}}
 */
export function pieColors(initialKeys = []) {
  const assigned = new Map();
  const colorFor = (key) => {
    if (key === OTHERS_LABEL) return OTHERS_COLOR;
    if (!assigned.has(key)) assigned.set(key, PIE_PALETTE[assigned.size % PIE_PALETTE.length]);
    return assigned.get(key);
  };
  colorFor.fit = (shownKeys) => {
    const taken = new Set();
    for (const key of shownKeys) {
      if (key === OTHERS_LABEL) continue;
      const current = colorFor(key);
      if (!taken.has(current)) {
        taken.add(current);
        continue;
      }
      // Clashes with a bigger slice on screen: prefer a colour no key has yet.
      const inUse = new Set(assigned.values());
      const free = PIE_PALETTE.find((c) => !taken.has(c) && !inUse.has(c))
        || PIE_PALETTE.find((c) => !taken.has(c));
      assigned.set(key, free);
      taken.add(free);
    }
  };
  initialKeys.forEach(colorFor);
  return colorFor;
}

/** "83%", "<1%" for a sliver, "" with no total. */
export function percentText(value, total) {
  if (!total) return '';
  const pct = (value / total) * 100;
  if (pct > 0 && pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

/**
 * Wire up the centre label and HTML legend for a dc pie chart.
 *
 * @param {object} chart  dc pieChart (a donut: set innerRadius)
 * @param {object} opts
 * @param {Element} opts.legendEl  where the legend rows go
 * @param {string} opts.noun  what the counts are ("incidents", "tags")
 */
export function decoratePie(chart, { legendEl, noun }) {
  let hoverKey = null;

  const items = () => {
    const rows = chart.legendables();
    const total = rows.reduce((s, r) => s + r.data, 0);
    return { rows, total };
  };

  function setHover(key) {
    hoverKey = key;
    const root = chart.root();
    root.classed('has-hover', key !== null);
    root.selectAll('g.pie-slice').classed('is-hover', (d) => d && d.data.key === key);
    select(legendEl).classed('has-hover', key !== null);
    select(legendEl).selectAll('.pie-legend-row').classed('is-hover', (d) => d.name === key);
    updateCentre();
  }

  function updateCentre() {
    const { rows, total } = items();
    const centre = chart.select('g.pie-centre');
    const row = rows.find((r) => r.name === hoverKey);
    // Filtered: the selected slices' count, matching the rest of the page.
    const filters = chart.filters().map(String);
    const selected = rows.filter((r) => filters.includes(String(r.name))).reduce((n, r) => n + r.data, 0);
    let big = total.toLocaleString();
    let small = noun;
    if (row) {
      big = row.data.toLocaleString();
      small = `${percentText(row.data, total)} · ${String(row.name)}`;
    } else if (filters.length) {
      big = selected.toLocaleString();
      small = 'selected';
    }
    centre.select('.pie-centre-value').text(big);
    centre.select('.pie-centre-label').text(small.length > 20 ? small.slice(0, 19) + '…' : small);
  }

  function renderLegend() {
    const { rows, total } = items();
    const filters = chart.filters().map(String);
    const anySelected = filters.length > 0;
    const list = select(legendEl);
    list.selectAll('.pie-legend-row')
      .data(rows, (d) => d.name)
      .join((enter) => {
        const row = enter.append('button')
          .attr('type', 'button')
          .attr('class', 'pie-legend-row');
        row.append('span').attr('class', 'pie-legend-swatch');
        row.append('span').attr('class', 'pie-legend-name');
        row.append('span').attr('class', 'pie-legend-count');
        row.append('span').attr('class', 'pie-legend-pct');
        return row;
      })
      .order()
      // On every row, new or reused, so they always act on this chart.
      .on('mouseenter', (_e, d) => setHover(d.name))
      .on('mouseleave', () => setHover(null))
      .on('click', (_e, d) => chart.legendToggle(d))
      .classed('is-selected', (d) => filters.includes(String(d.name)))
      .classed('is-deselected', (d) => anySelected && !filters.includes(String(d.name)))
      .attr('title', (d) => `${d.name}: ${d.data.toLocaleString()} (${percentText(d.data, total)})`)
      .call((row) => {
        row.select('.pie-legend-swatch').style('background-color', (d) => d.color);
        row.select('.pie-legend-name').text((d) => d.name);
        row.select('.pie-legend-count').text((d) => d.data.toLocaleString());
        row.select('.pie-legend-pct').text((d) => percentText(d.data, total));
      });
    if (!rows.length) {
      list.selectAll('.pie-legend-empty').data([0]).join('div').attr('class', 'pie-legend-empty').text('None');
    } else {
      list.selectAll('.pie-legend-empty').remove();
    }
  }

  chart.on('renderlet.pieStyle', () => {
    // Centre label: total by default, the hovered slice's details on hover.
    const g = chart.select('g.pie-slice-group').node()?.parentNode;
    if (g && chart.select('g.pie-centre').empty()) {
      const centre = select(g).append('g').attr('class', 'pie-centre');
      centre.append('text').attr('class', 'pie-centre-value').attr('text-anchor', 'middle').attr('dy', '0.1em');
      centre.append('text').attr('class', 'pie-centre-label').attr('text-anchor', 'middle').attr('dy', '1.6em');
    }
    chart.selectAll('g.pie-slice')
      .on('mouseenter.pieStyle', (_e, d) => setHover(d.data.key))
      .on('mouseleave.pieStyle', () => setHover(null));
    renderLegend();
    setHover(hoverKey);
  });
}
