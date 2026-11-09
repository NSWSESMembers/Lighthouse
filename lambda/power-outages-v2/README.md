# Power Outages Lambda (v2)

`GET /lad_v2/power-outages` returns the current Ausgrid, Endeavour Energy and
Essential Energy outages as one GeoJSON FeatureCollection. It's used by the
tasking map's **Power Outages** overlays
(`src/pages/tasking/mapLayers/powerOutages.js`) and the Lighthouse map on
Beacon (`src/background.js`), both through `src/shared/powerOutages.js`.

It only runs when someone asks. The result is cached in memory and in S3 for
`CACHE_TTL_SECONDS` (default 2 minutes), so however many people have the
layer on, the three companies are fetched at most once per 2 minutes, and
nothing runs while no one has it on. If a company fails or times out, its last
good outages from S3 are returned with `ok: false` and the error in
`meta.providers`, so one company being down never empties the map.

The company feeds aren't documented APIs. They're the files each company's
own outage map loads. **If a company changes its website, update the URL or
parser in `providers.mjs` and redeploy: the extension doesn't need a new
release.** `providers.mjs` says how to find the new URL.

Unplanned outages are always returned. Planned outages are returned only if
they're under way or start within 48 hours (`PLANNED_WINDOW_HOURS`).
Endeavour's single-premise outages (individual home addresses) are dropped.

## Files

| File | |
| --- | --- |
| `index.mjs` | Handler, cache (memory + S3), merging the three companies |
| `providers.mjs` | Feed URLs and the parser for each company |
| `providers.test.mjs` | Unit tests, run by `npm test` from the repo root (invented data) |

No packages to bundle: `@aws-sdk/client-s3` is part of the Lambda Node.js
runtime, and it's loaded lazily so the tests run without it.

## Deploy

Set up like the other `lad_v2` Lambdas (`geocode-v2`, `default-assets-v2` and
so on), in `ap-southeast-2`.

1. **Lambda function**: create `LH-PowerOutagesV2` (or your naming), runtime
   **Node.js 22.x**, handler `index.handler`. Add `index.mjs` and
   `providers.mjs` (paste both into the console editor, or zip the two files).
2. **Configuration**:
   - **Timeout**: 20 seconds. Each company gets 6 seconds, fetched in parallel, plus the S3 read and write.
   - **Memory**: 256 MB.
   - **Environment variables**:
     - `BUCKET_NAME` (required for the S3 cache): an existing private bucket is fine, for example the
       default-assets bucket. Without it the cache only lives in each warm instance's memory.
     - `CACHE_KEY` (optional): default `power-outages/latest.json`.
     - `CACHE_TTL_SECONDS` (optional): default `120`.
     - `FETCH_TIMEOUT_MS` (optional): default `6000`.
3. **Permissions**: give the function's role `s3:GetObject` and
   `s3:PutObject` on `arn:aws:s3:::<bucket>/power-outages/*`.
4. **API Gateway**: on the HTTP API that serves `lambda.lighthouse-extension.com/lad_v2/...`,
   add the route `GET /lad_v2/power-outages`, integrate it with the function,
   and attach the **LH-BeaconAuthorizerV2** authorizer, as on the other
   `lad_v2` routes. CORS is the same as those routes.

## Check it after deploying

With a Beacon token from a signed-in Beacon tab:

```sh
curl -s -H "Authorization: Bearer $TOKEN" \
  https://lambda.lighthouse-extension.com/lad_v2/power-outages | jq .meta
```

All three companies should show `"ok": true` with a count. The first call after
a quiet spell takes a couple of seconds (it fetches the companies); calls within
the next 2 minutes come from the cache. If a company shows an `HTTP 403` or
similar error from AWS but works from a browser, its website is blocking AWS
addresses. The CloudWatch logs have a `provider_failed` line for each failure.
