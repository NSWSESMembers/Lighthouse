const moment = require('moment');

// The manifest version. The Web Store rejects an upload unless it's higher than
// the last, so this must rise with every build, including same-day hotfixes.
// Fixed +10:00 rather than Sydney time, which goes backwards when daylight
// saving ends. H*100+m rather than HHmm, as Chrome rejects leading zeros.
function buildVersion(now = moment()) {
  const time = moment(now).utcOffset('+10:00');
  return `${time.format('YYYY.M.D')}.${time.hours() * 100 + time.minutes()}`;
}

module.exports = { buildVersion };
