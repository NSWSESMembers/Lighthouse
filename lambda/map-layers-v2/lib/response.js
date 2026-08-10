'use strict';

// Locked down to the extension's own origin at deploy time is possible by
// replacing '*' below, but the request itself is already scoped by apiUrl
// (the org's Beacon source URL) so '*' matches the permissiveness of the
// existing share / default-assets Lambdas this feature mirrors.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: body === null || body === undefined ? '' : JSON.stringify(body),
  };
}

const badRequest = (message) => json(400, { error: message });
const forbidden = (message) => json(403, { error: message });
const notFound = (message) => json(404, { error: message });
const serverError = (message) => json(500, { error: message || 'Internal server error' });

module.exports = { json, badRequest, forbidden, notFound, serverError, CORS_HEADERS };
