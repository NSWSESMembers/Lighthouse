// LAD's saved Configuration, kept per Beacon environment. Every extension page
// shares one localStorage whichever Beacon opened it, so HQ, sector and
// starred ids saved on one environment would otherwise appear on another.

// Production keeps the original key, so nothing moves for most users and an
// older build still finds its settings.
export const TASKING_CONFIG_KEY = 'lh-taskingConfig';

/**
 * @param {'production'|'train'|'test'|'dev'|null} env
 * @returns {string} the localStorage key for that environment's Configuration
 */
export function taskingConfigKey(env) {
  return env && env !== 'production' ? `${TASKING_CONFIG_KEY}.${env}` : TASKING_CONFIG_KEY;
}
