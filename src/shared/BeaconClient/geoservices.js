import { request } from './core/request.js';
import { getName } from './unit.js';

export async function unitBoundary(unitId, host, userId = 'notPassed', token) {
  const unit = await getName(unitId, host, userId, token);
  if (!unit || !unit.Code) {
    return null;
  }
  return request(
    host + '/Api/v1/GeoServices/Unit/' + unit.Code + '/Boundary/?LighthouseFunction=unitBoundary&userId=' + userId,
    { token },
  );
}
