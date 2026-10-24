const ICONS = 'https://www.livetraffic.com/assets/icons/map/';

// Older feed items without CategoryIcon only carry the display text.
const MAIN_CATEGORY_TO_ICON_CATEGORY = {
  Hazard: 'Hazard',
  Crash: 'Crash',
  Breakdown: 'Breakdown',
  'Traffic lights blacked out': 'TrafficSignals',
  'Changed traffic conditions': 'ChangedConditions',
};

// Live Traffic's severity for incidents: busier roads get the stronger icon.
function trafficSeverity(p) {
  switch (p.roads?.[0]?.trafficVolume?.toLowerCase()) {
    case 'heavy':
      return 'heavy';
    case 'light':
      return 'low';
    default:
      return 'moderate';
  }
}

/**
 * Live Traffic map icon for a hazard feature from the incidents or council
 * (regional LGA) feed. Mirrors livetraffic.com: picks by
 * properties.CategoryIcon, and for council reports the severity comes from
 * whether the closure impacts the network rather than traffic volume.
 */
export function transportHazardIcon(f, { council = false } = {}) {
  const p = f?.properties || {};
  const category = p.CategoryIcon || MAIN_CATEGORY_TO_ICON_CATEGORY[p.mainCategory] || 'Hazard';
  const severity = council ? (p.impactingNetwork ? 'moderate' : 'low') : trafficSeverity(p);

  switch (category) {
    case 'Crash':
      return `${ICONS}crashes/${severity}-now.svg`;
    case 'Breakdown':
      return `${ICONS}breakdowns/${severity}-now.svg`;
    case 'TrafficSignals':
      return `${ICONS}traffic-lights/${severity}-now.svg`;
    case 'ChangedConditions':
      return `${ICONS}changed-traffic/${severity}-now.svg`;
    case 'Roadworks':
      return `${ICONS}roadworks/${severity}-now.svg`;
    case 'Flood':
      return `${ICONS}other-hazards/flood.svg`;
    case 'Fire':
      return `${ICONS}other-hazards/fire.svg`;
    case 'AdverseWeather':
      return `${ICONS}other-hazards/adverse-weather.svg`;
    case 'SnowIce':
      return `${ICONS}alpine/snow.svg`;
    case 'PublicEvent':
      return `${ICONS}events/major-now.svg`;
    case 'Hazard':
      return `${ICONS}general-hazards/${severity}-now.svg`;
    default:
      return `${ICONS}general-hazards/moderate-now.svg`;
  }
}
