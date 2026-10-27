/*
  The dc.js charts and the crossfilter behind them.

  Every chart filters every other one (click a pie slice, brush a bar
  chart). The view model doesn't touch dc directly: it calls load() with
  facts, and hears about filter changes through onFiltered.
*/

import './dcD3Compat.js';
import {
  pieChart, barChart, compositeChart, lineChart, legend, units, config,
  chartRegistry, renderAll, redrawAll, filterAll,
} from 'dc/src/index.js';
import crossfilter from 'crossfilter2';
import { scaleTime, scaleLinear, schemeTableau10 } from 'd3';

import { BREAKDOWNS, chartElementId, legendElementId } from './breakdowns.js';
import { pieColors, decoratePie, OTHERS_LABEL } from './pieStyle.js';
import {
  bucketFor, closedBucket, cumulativeGroup, withoutEmptyBins, roundUp, NOT_CLOSED,
} from '../data/timeBuckets.js';

const HOUR_MS = 3600 * 1000;

// dc's default is d3 v3's schemeCategory20c, with a deprecation warning.
config.defaultColors(schemeTableau10);

// Logical sizes; useViewBoxResizing scales each chart to its card.
const PIE = { size: 200, radius: 95, innerRadius: 58 };
const WIDE = { width: 1200, height: 230 };
const HALF = { width: 600, height: 230 };
const MARGINS = { top: 10, right: 20, bottom: 30, left: 45 };
const SLICES = 9; // plus "Others"

/** Histogram bin width (hours) for the completion-time chart. */
export function durationBinHours(maxHours) {
  if (maxHours <= 8) return 0.25;
  if (maxHours <= 48) return 1;
  return 4;
}

export class StatsCharts {
  /**
   * @param {object} [opts]
   * @param {(chartKey: string) => void} [opts.onFiltered]  after any chart's filter changes
   */
  constructor({ onFiltered = () => {} } = {}) {
    this.onFiltered = onFiltered;
    this.ndx = null;
    this.charts = {};
    this.bucket = null;
    this.byReceived = null;
  }

  get built() {
    return this.ndx !== null;
  }

  /**
   * Show `facts` for [start, end]. The first call builds the charts. Later
   * calls with the same bucket size swap the data in place and keep the
   * user's filters; a change of bucket size (hourly <-> daily) rebuilds.
   */
  load(facts, start, end) {
    const bucket = bucketFor(start, end);
    if (this.built && bucket.label === this.bucket.label) {
      this._replaceData(facts, start, end);
    } else {
      this.destroy();
      this._build(facts, start, end, bucket);
    }
  }

  destroy() {
    if (!this.built) return;
    Object.values(this.charts).forEach((c) => {
      const el = c.anchor();
      if (el && el.replaceChildren) el.replaceChildren();
    });
    // The pie legends sit beside their charts, not in them: clear those too,
    // or the new charts reuse rows wired to the old ones.
    for (const b of BREAKDOWNS) {
      const legend = document.getElementById(legendElementId(b.key));
      if (legend) legend.replaceChildren();
    }
    chartRegistry.clear();
    this.charts = {};
    this.ndx = null;
  }

  /** Records passing every chart's filter. */
  filteredFacts() {
    return this.built ? this.ndx.allFiltered() : [];
  }

  totalCount() {
    return this.built ? this.ndx.size() : 0;
  }

  /** Most recently received jobs that pass the filters. */
  latest(n) {
    return this.built ? this.byReceived.top(n) : [];
  }

  isFiltered(key) {
    const c = this.charts[key];
    return !!c && c.hasFilter();
  }

  filterLabels(key) {
    const c = this.charts[key];
    return c ? c.filters().map(String) : [];
  }

  resetChart(key) {
    const c = this.charts[key];
    if (!c) return;
    c.filterAll();
    redrawAll();
  }

  resetAll() {
    filterAll();
    redrawAll();
  }

  _build(facts, start, end, bucket) {
    this.bucket = bucket;
    this.ndx = crossfilter(facts);
    this.byReceived = this.ndx.dimension((f) => f.received);

    for (const b of BREAKDOWNS) {
      this.charts[b.key] = this._pie(b);
    }
    this._timeCharts(start, end);
    this._durationChart();

    for (const [key, chart] of Object.entries(this.charts)) {
      chart.on('filtered.stats', () => this.onFiltered(key));
    }
    renderAll();
  }

  _pie({ key, accessor, multi }) {
    // Tag fields are arrays: crossfilter2 counts a job once under each of
    // its tags, and a selected tag keeps every job carrying it.
    const dimension = this.ndx.dimension(accessor, !!multi);
    const group = dimension.group();
    const chart = pieChart('#' + chartElementId(key));
    const colors = pieColors(group.top(Infinity).map((d) => d.key));
    const fitColors = () => colors.fit(chart.data().map((d) => d.key));
    chart.on('preRender.colors', fitColors);
    chart.on('preRedraw.colors', fitColors);
    chart
      .useViewBoxResizing(true)
      .width(PIE.size)
      .height(PIE.size)
      .radius(PIE.radius)
      .innerRadius(PIE.innerRadius)
      .dimension(dimension)
      .group(group)
      // Its own colours per chart, biggest slices first; fit() before each
      // draw keeps the slices on screen distinct (see pieColors).
      .colors(colors)
      .slicesCap(SLICES)
      .othersLabel(OTHERS_LABEL)
      .renderLabel(false)
      .title((d) => `${d.key}: ${d.value}`);
    decoratePie(chart, { legendEl: document.getElementById(legendElementId(key)), noun: multi ? 'tags' : 'incidents' });
    return chart;
  }

  _timeCharts(start, end) {
    const { floor, units: xUnits } = this.bucket;
    const closedKey = closedBucket(floor);
    const receivedDim = this.ndx.dimension((f) => floor(f.received));
    const closedDim = this.ndx.dimension(closedKey);
    const receivedGroup = receivedDim.group();
    const closedGroup = closedDim.group();
    const closedOnly = {
      all: () => closedGroup.all().filter((d) => +d.key !== +NOT_CLOSED),
    };

    const bar = (id, dim, group) => barChart('#' + id)
      .useViewBoxResizing(true)
      .width(HALF.width)
      .height(HALF.height)
      .margins(MARGINS)
      .dimension(dim)
      .group(group)
      .x(scaleTime().domain([start, end]))
      .xUnits(xUnits)
      .round((d) => floor.round(d))
      .elasticY(true)
      .brushOn(true)
      .renderHorizontalGridLines(true);

    this.charts.received = bar('chart-received', receivedDim, receivedGroup);
    this.charts.closed = bar('chart-closed', closedDim, closedOnly);

    // The running totals get dimensions of their own. A crossfilter group
    // ignores its own dimension's filter, so sharing the bar charts' ones
    // left each line deaf to its own chart's brush (brush Received and only
    // the Closed line changed).
    const runReceivedGroup = this.ndx.dimension((f) => floor(f.received)).group();
    const runClosedGroup = this.ndx.dimension(closedKey).group();

    const running = compositeChart('#chart-running');
    running
      .useViewBoxResizing(true)
      .width(WIDE.width)
      .height(WIDE.height)
      .margins(MARGINS)
      .x(scaleTime().domain([start, end]))
      .xUnits(xUnits)
      .elasticY(true)
      .brushOn(false)
      .renderHorizontalGridLines(true)
      .legend(legend().x(MARGINS.left + 35).y(10).itemHeight(13).gap(5))
      .compose([
        lineChart(running)
          .dimension(receivedDim)
          .group(cumulativeGroup(runReceivedGroup), 'Received (running total)')
          .colors('#d62728')
          .renderDataPoints({ radius: 2, fillOpacity: 0.8, strokeOpacity: 0.8 }),
        lineChart(running)
          .dimension(closedDim)
          .group(cumulativeGroup(runClosedGroup), 'Closed (running total)')
          .colors('#1f77b4')
          .dashStyle([5, 2])
          .renderDataPoints({ radius: 2, fillOpacity: 0.8, strokeOpacity: 0.8 }),
      ]);
    this.charts.running = running;
  }

  _maxDurationHours() {
    return this.ndx.all().reduce((max, f) => Math.max(max, f.durationMs), 0) / HOUR_MS;
  }

  _durationChart() {
    const maxHours = this._maxDurationHours();
    const bin = durationBinHours(maxHours);
    this.durationBin = bin;
    // Jobs without a completion time land in bin 0, which the group drops.
    const dim = this.ndx.dimension((f) => roundUp(f.durationMs / HOUR_MS, bin));
    const chart = barChart('#chart-duration');
    chart
      .useViewBoxResizing(true)
      .width(WIDE.width)
      .height(WIDE.height)
      .margins(MARGINS)
      .dimension(dim)
      .group(withoutEmptyBins(dim.group()))
      .x(scaleLinear().domain([0, roundUp(maxHours, bin) + bin]))
      .xUnits(units.fp.precision(bin))
      .centerBar(false)
      .elasticY(true)
      .brushOn(true)
      .renderHorizontalGridLines(true)
      .xAxisLabel('Hours from Active to Complete')
      .yAxisLabel('Incidents');
    this.charts.duration = chart;
  }

  _replaceData(facts, start, end) {
    // Lift every filter, swap the records, put the filters back.
    const saved = Object.fromEntries(Object.entries(this.charts).map(([k, c]) => [k, c.filters().slice()]));
    Object.values(this.charts).forEach((c) => c.filter(null));
    this.ndx.remove(() => true);
    this.ndx.add(facts);

    for (const key of ['received', 'closed', 'running']) {
      this.charts[key].x(scaleTime().domain([start, end]));
    }
    const bin = this.durationBin;
    this.charts.duration.x(scaleLinear().domain([0, roundUp(this._maxDurationHours(), bin) + bin]));
    for (const [key, filters] of Object.entries(saved)) {
      if (filters.length) this.charts[key].filter([filters]);
    }
    redrawAll();
  }
}
