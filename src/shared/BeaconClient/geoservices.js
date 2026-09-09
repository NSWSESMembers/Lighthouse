import { request } from './core/request.js';
import { getName } from './unit.js';

/**
 * Boundary polygon for a unit (looked up by id -> code -> boundary).
 *
 * @param {string|number} unitId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object|null>}
 */
export async function unitBoundary(unitId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  const unit = await getName(unitId, ctx);
  if (!unit || !unit.Code) {
    return null;
  }
  return request(
    host + '/Api/v1/GeoServices/Unit/' + unit.Code + '/Boundary/?LighthouseFunction=unitBoundary&userId=' + userId,
    { token, signal },
  );
}
