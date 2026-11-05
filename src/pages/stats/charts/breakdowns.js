/*
  The breakdown pie charts: what each one counts, and which group it sits
  in. The view model renders a card per entry (stats.html), StatsCharts
  mounts a dc pie in each, and breakdownLayout.js makes each group a
  draggable, resizable grid.
*/

export const BREAKDOWN_GROUPS = [
  { key: 'incident', title: 'Incident' },
  { key: 'location', title: 'Location' },
  { key: 'damage', title: 'Damage and tags' },
];

export const BREAKDOWNS = [
  { key: 'status', group: 'incident', title: 'Incident Status', accessor: (f) => f.status },
  { key: 'type', group: 'incident', title: 'Incident Type', accessor: (f) => f.type },
  { key: 'priority', group: 'incident', title: 'Priority', accessor: (f) => f.priority },
  { key: 'category', group: 'incident', title: 'Categorisation Category', accessor: (f) => f.category },
  { key: 'agency', group: 'incident', title: 'Referring Agency', accessor: (f) => f.agency },
  { key: 'icems', group: 'incident', title: 'ICEMS', accessor: (f) => f.icems },
  { key: 'event', group: 'incident', title: 'Event', accessor: (f) => f.event },
  { key: 'stormDamage', group: 'damage', title: 'Storm Damage Aggregate', accessor: (f) => f.stormDamage },
  { key: 'hazardTags', group: 'damage', title: 'Hazard Tags', accessor: (f) => f.hazardTags, multi: true },
  { key: 'propertyTags', group: 'damage', title: 'Property Tags', accessor: (f) => f.propertyTags, multi: true },
  { key: 'unit', group: 'location', title: 'Assigned Unit', accessor: (f) => f.unit },
  { key: 'cluster', group: 'location', title: 'Cluster', accessor: (f) => f.cluster },
  { key: 'zone', group: 'location', title: 'Zone', accessor: (f) => f.zone },
  { key: 'lga', group: 'location', title: 'LGA', accessor: (f) => f.lga },
  { key: 'sector', group: 'location', title: 'Sector', accessor: (f) => f.sector },
  { key: 'locality', group: 'location', title: 'Locality', accessor: (f) => f.locality },
];

export const chartElementId = (key) => `chart-${key}`;
export const legendElementId = (key) => `legend-${key}`;
export const gridElementId = (groupKey) => `grid-${groupKey}`;
