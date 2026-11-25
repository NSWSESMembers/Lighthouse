# Council Systems Lambda (v2)

`GET /lad_v2/council/{council}/{dataset}` returns one dataset from a council's
own system as a GeoJSON FeatureCollection, and `GET .../{dataset}/{item}` one
item of a dataset that has them (a camera's latest image). It's used by the
tasking map's **Council Systems** overlays (`src/pages/tasking/mapLayers/floodsmart.js`
and `councilCameras.js`),
through `src/shared/councilSystems.js`. Going through the Lambda means the
extension needs no permission for each council's site and gets no CORS errors
from them.

| Route | Source |
| --- | --- |
| `/lad_v2/council/parramatta/warning-areas` | City of Parramatta FloodSmart's 10 flood warning areas (GeoServer WFS), each with its **forecast** alert: whether the flood model forecasts the area's Minor/Moderate/Major level (Lizard raster alarms, needs the Lizard key) |
| `/lad_v2/council/parramatta/water-levels` | City of Parramatta FloodSmart water-level gauges, latest reading each (Lizard API). Not used by the extension yet: see below |
| `/lad_v2/council/parramatta/flood-impacts` | City of Parramatta FloodSmart impact assets (roads and crossings, healthcare, houses, landmarks, levees) and whether the council's 12-hour model run **forecasts** each one flooded (GeoServer WFS, public; the run's currency is checked with the Lizard key) |
| `/lad_v2/council/parramatta/flood-hazard` | Australian flood hazard categories H1-H6 (AIDR Guideline 7-3), worked out from City of Parramatta's flood model **forecast** maximum depth and velocity, on a ~25 m grid (Lizard raster data, needs the Lizard key) |
| `/lad_v2/council/parramatta/catchment-rainfall` | City of Parramatta FloodSmart rainfall totals per catchment, measured and forecast (Lizard GeoServer WFS) |
| `/lad_v2/council/northernbeaches/catchment-rainfall` | Northern Beaches Council FLASH rainfall totals per catchment, measured and forecast (Lizard GeoServer WFS) |
| `/lad_v2/council/tweed/flood-cameras` | Tweed Shire Council's 13 flood monitoring cameras: name, position, river gauge. From the list in `tweed.mjs`: Tweed's site isn't asked |
| `/lad_v2/council/tweed/flood-cameras/{id}` | One Tweed camera's latest image and when it was taken, read from that camera's page on `floodcam.tweed.nsw.gov.au` (no API: see `tweed.mjs`) |
| `/lad_v2/council/clarence/flood-cameras` (and `/{id}`) | Clarence Valley Council's 9 flood cameras: Prince Street, Grafton (Manly Hydraulics Laboratory, latest image read from MHL's animation page), Bluff Bridge (Envault, one fixed latest-image URL), and seven published only as one live video, a grid of them: each one's still is cut from the video's newest frame with ffmpeg (`videostill.mjs`). Palmer's Island (off) has an approximate position and no bearing yet |
| `/lad_v2/council/bellingen/flood-cameras` (and `/{id}`) | Bellingen Shire Council's bridge flood cameras on webcam.io (latest image read from its `latest.jpg` redirect with a HEAD request) |
| `/lad_v2/council/coffsharbour/flood-cameras` (and `/{id}`) | City of Coffs Harbour's Edward Sharp Bridge camera (DisasterWatch, one fixed latest-image URL; its time from a HEAD request) |

Anything else is a 404. Everything is public data except Parramatta's forecast
alerts and flood hazard, which use a Lizard API key (below).

It only runs when someone asks. Each dataset is cached in memory and in S3 for
its own TTL (rainfall 2 minutes, a camera's latest image 5, warning areas 10,
flood hazard 15; the warning area shapes are kept for 6 hours), so
however many people have a layer on, the council's system is asked at most once
per TTL. If the council's system fails or times out, the last good copy is
returned with `meta.ok: false` and the error, and it's tried again a minute
later. With no good copy at all the response is a 502.

## Lizard API key

Parramatta's forecast alerts need a Lizard login. The key is in Secrets Manager
as `council-systems/lizard` (`LIZARD_SECRET_ID`), a JSON object of keys by
portal host, `{ "parramatta.lizard.net": "..." }`; `secrets.mjs` only sends a key
to its own portal, as HTTP Basic auth with the username `__key__`, and refuses
redirects. The function's role has `secretsmanager:GetSecretValue` on that one
secret. To add or rotate a key without it showing on screen or in shell history:

```sh
read -rs KEY && aws secretsmanager put-secret-value --secret-id council-systems/lizard \
  --secret-string "{\"parramatta.lizard.net\":\"$KEY\"}" --query Name --output text; unset KEY
```

(that replaces the whole object, so include every portal's key). The Lambda
picks up a new key within 15 minutes.

## Parramatta forecast alerts (next 5 hours)

Each warning area has a Lizard raster alarm: a point in the area, its
PIM/Minor/Moderate/Major thresholds, and the flood model's operational forecast
water level raster (rerun about every 10 minutes, about 11 hours ahead). The
Lambda doesn't use the alarm's own state, which looks across the whole forecast:
it reads the forecast water level at the alarm's point in 10-minute steps from
now to `WARNING_FORECAST_HOURS` (5) ahead, or the end of the forecast if that's
sooner, and `forecast.status` is the highest level the forecast goes above in
that window (`clear` if none), with `expectedAt` (first above it), `value` /
`peakAt` (the peak) and `from` / `to` (the window). It's `unknown` when there's no
current forecast, so an old result is never shown. These are **forecasts**, not
observed levels and not warnings anyone has issued; the extension labels them so
everywhere ("Parramatta Flood Warning Areas (forecast next 5 hrs)"). The dams'
and basins' White/Amber/Red alarms are left out. Ten point requests a refresh,
about 9 s, cached 10 minutes (the model's rerun interval), so the 5-hour window
can start up to 10 minutes ago; the popup shows the window.

## Parramatta flood impacts (12-hour run)

The FloodSmart dashboard's "Show impact" points
(`floodsmart:parramatta_impact_points_2701`): 73 council-chosen assets, each with
the council's own status, `<type>_flooded` or `<type>_not_flooded`, set from its
12-hour operational model run (driven by BOM's STEPS rainfall nowcast). The
extension's layer is "Parramatta Flood Impacts (forecast next ~12 hrs)" (each run
looks 12-14 hours ahead and is rerun about every 10 minutes). The Lambda passes
on only flooded / not flooded (the user asked for no depths or
levels), with the asset's name, type and its model area's run window. An asset's
`model_id` (`Parramatta3` north, `Parramatta4` south) picks its area's 12-hour
water-level run; if that run isn't forecasting ahead the status is `unknown`,
never an old "not flooded". Assets with trigger 9999 (no trigger set, 9 of them)
are left out, and the "forest" points are levees (by their names). Cached 10
minutes. The status isn't verified against a real flood yet: on a dry day every
asset reads not flooded either way.

## Parramatta forecast flood hazard (H1-H6)

`hazard.mjs` classifies each cell with the AIDR "Technical flood risk management
guideline: Flood hazard" (Guideline 7-3) Table 2 limits: the lowest category
whose depth, velocity and depth x velocity limits the cell is within, else H6.

| | D x V (m2/s) | D (m) | V (m/s) |
| --- | --- | --- | --- |
| H1 | 0.3 | 0.3 | 2.0 |
| H2 | 0.6 | 0.5 | 2.0 |
| H3 | 0.6 | 1.2 | 2.0 |
| H4 | 1.0 | 2.0 | 2.0 |
| H5 | 4.0 | 4.0 | 4.0 |
| H6 | beyond H5 | | |

Inputs: each model area's "adfd" run (`Parramatta 3-3 adfd`, north;
`Parramatta 4-2 adfd`, south; by the name, driven by BOM's forecast rainfall,
running about a day and a half ahead), its `Max water depth` and `Max flow
velocity` rasters, sampled at ~25 m cell centres onto one grid (row 0 north;
Lizard's raster `data` endpoint, max ~4.2M cells a request). The model's own
"Flood hazard rating" raster isn't H1-H6 (it's a continuous value), so it isn't
used. The layer is named "Parramatta Flood Hazard H1-H6 (forecast max, ~36 hrs)",
and the legend and popup give each model area's run window
(`runs[].forecastFrom` to `forecastUntil`). It isn't limited to 5 hours like the
warning areas: velocity is only published as one maximum over the whole run, so
a shorter window would mix windows (the user chose the full run, 2026-11-24).
Caveats, all shown in the extension:

- **Forecast.** Maximum depth and maximum velocity over the run, which may not
  happen at the same time, so a category can overstate the hazard at any moment.
- **Normal water shows too.** The tidal Parramatta River, lakes and basins are
  H5-H6 even in dry weather (deep water). The user chose to show them (2026-11-24)
  rather than mask them; the model starts each run with its channels empty, so
  "rise since the start of the run" doesn't separate them.
- Under 2 cm deep counts as dry (model noise). A model area whose forecast has
  run out is left out and listed as unavailable.
- ~25 m cells sample a 1 m depth grid, so narrow channels can be missed or widened.

Response: one feature, `properties.grid` = `{ west, north, cellLon, cellLat,
width, height, hazard, depth, velocity }` with base64 little-endian arrays
(uint8 0 dry / 1-6; uint16 cm; uint16 cm/s), and `properties.runs` =
`[{ area, available, forecastFrom, forecastUntil, runUpdatedAt }]`. ~4.4 MB of JSON, ~40 KB
gzipped; about 6-10 s to build, cached 15 minutes. The function timeout is 29 s
(API Gateway stops at 30 s) and memory 512 MB.

## Parramatta water levels: waiting on thresholds

The extension doesn't show `water-levels`. A gauge's level in m AHD is its
height above sea level, so readings can't be compared between gauges (1 m is
normal at Riverside Theatre, 22 m at Pendle Hill Creek), and without each
gauge's warning thresholds a map of them invites misreading. The thresholds
(Lizard timeseries alarms, "resilience triggers") are readable with the key now,
but the Briens Road gauge has been stuck at 19.30 m since a real Major on
7 Oct 2026, and its alarm never cleared: a gauge layer needs a stuck/stale
reading check before it can be trusted. The council's "Flood Warning
Triggers and Impacts 2021" PDF lists Minor/Moderate/Major levels per warning
area, but it's out of date in places (Briens Road reads above its Major level
on a dry day). Bring the layer back once the Lambda can read the live alarms.

## Adding a council

For another FloodSmart council's catchment rainfall, copy `northernbeaches.mjs`:
it's one `catchmentRainfallDataset(layer, totals)` call, where `totals` are the
columns that council's catchments table has (check them with a WFS
`DescribeFeatureType` request: asking for a missing column fails the request).
Check what a Lizard portal makes public on that council's own portal
(`<council>.lizard.net`): what's public differs between portals.

Otherwise write a module like `parramatta.mjs` exporting
`{ name, system, datasets: { [dataset]: { ttlSeconds, load } } }`, where
`load(fetchJson, now, { fetchText, fetchBytes, fetchHead })` returns GeoJSON
features (`fetchText` for a council page with no API, `fetchBytes` for a
binary download such as a video segment, `fetchHead` for a HEAD request that
doesn't follow redirects), and add it to `COUNCILS` in
`councils.mjs`. Add tests next to the existing ones and redeploy: the route
already covers it. Then add the overlay in `src/pages/tasking/mapLayers/`
under the "Council Systems" menu group.

A dataset whose items are fetched one at a time when someone asks (a
camera's latest image) also has
`item: { ttlSeconds, has(id), load(id, { fetchJson, fetchText, fetchBytes, fetchHead, now }) }`:
`.../{dataset}/{id}` is a 404 unless `has(id)`, and each item is cached on
its own (ids are lower case). Another council's flood cameras: a module like
`bellingen.mjs` using `cameraDataset` (`cameras.mjs`), then one
`registerCouncilCamerasLayer` call in `councilCameras.js`.

## Response

```json
{
  "type": "FeatureCollection",
  "features": [...],
  "meta": {
    "council": "parramatta", "councilName": "City of Parramatta", "system": "FloodSmart",
    "dataset": "water-levels", "generatedAt": "...", "ok": true, "lastGoodAt": "...", "error": "only when ok is false"
  }
}
```

Feature properties:

- `warning-areas`: `name`, `description` (polygons)
- `water-levels`: `id`, `name`, `value`, `unit` (`m`), `datum` (`AHD`), `observedAt` (points)
- `flood-cameras`: `id`, `name`, `gaugeUrl` and `timelapseUrl` (or `null`), `liveUrl` (the council's
  live video page, for cameras cut from one), `approximate` (`true` when the council doesn't publish the
  position), `bearing` and `fov` (which way the camera looks and how wide, in degrees, worked out from its
  image; `fov` `null` for the default), `latestPath` (where the extension asks for the camera's latest
  image, under `/lad_v2/council/`) (points)
- `flood-cameras/{id}`: one point with those and `imageUrl` (on the camera's own site, or for a still cut
  from a video the JPEG itself as a `data:` URL), `takenAt` (ISO, or `null` when the time is only stamped
  on the image), and `offline: true` with `imageUrl: null` when the camera is blank in the video;
  `meta.item` is the camera id
- `catchment-rainfall`: `name`, `anchor` (`[lng, lat]` label point or `null`), `totals` in mm, keyed as in
  `RAINFALL_FIELDS` in `floodsmart.mjs` (`since9am`, `last1hr`, ..., `next3hr`, ...): only the ones that
  council's table has (polygons)

## Files

| File | |
| --- | --- |
| `index.mjs` | Handler, routing, cache (memory + S3) |
| `councils.mjs` | The council registry |
| `parramatta.mjs` | City of Parramatta FloodSmart: URLs and parsers |
| `northernbeaches.mjs` | Northern Beaches Council FLASH (Lizard, like FloodSmart) |
| `floodsmart.mjs` | FloodSmart catchment rainfall, shared by the councils |
| `cameras.mjs` | A council's flood cameras as a dataset: the list and the per-camera route |
| `tweed.mjs` | Tweed Shire Council flood cameras: the camera list and the camera page parser |
| `clarence.mjs` | Clarence Valley Council flood cameras (MHL, Envault, the live video grid) |
| `videostill.mjs` | A still cut from a live HLS video with ffmpeg: the newest segment's first frame, one camera's box |
| `bellingen.mjs` | Bellingen Shire Council bridge flood cameras (webcam.io) |
| `coffsharbour.mjs` | City of Coffs Harbour bridge camera (DisasterWatch) |
| `geometry.mjs` | Polygon simplification (about 1 m), for councils' survey-detail polygons |
| `council-systems.test.mjs` | Unit tests, run by `npm test` from the repo root (invented data) |

No packages to bundle: `@aws-sdk/client-s3` is part of the Lambda Node.js
runtime, and it's loaded lazily so the tests run without it.

## Deploy

Set up like the other `lad_v2` Lambdas (`power-outages-v2`, `geocode-v2` and
so on), in `ap-southeast-2`.

1. **Lambda function**: create `LH-CouncilSystemsv2`, runtime
   **Node.js 22.x**, handler `index.handler`. Zip the `.mjs` files other than the
   test:

   ```sh
   cd lambda/council-systems-v2 && zip ../council-systems-v2.zip $(ls *.mjs | grep -v test)
   aws lambda update-function-code --function-name LH-CouncilSystemsv2 --zip-file fileb://../council-systems-v2.zip
   ```
2. **Configuration**:
   - **Timeout**: 29 seconds (API Gateway's limit is 30). Each upstream request gets 8 seconds
     (the flood hazard rasters 20), plus the S3 read and write.
   - **Memory**: 1024 MB (the flood hazard grids, and decoding a 1080p video frame).
   - **Layer**: ffmpeg at `/opt/bin/ffmpeg`, for the Clarence video cameras. `LH-ffmpeg` is a static
     x86_64 build (johnvansickle.com's ffmpeg-release-amd64-static, checked against its published md5):
     a zip of `bin/ffmpeg` and the build's `GPLv3.txt`, published with
     `aws lambda publish-layer-version --layer-name LH-ffmpeg --compatible-runtimes nodejs22.x --compatible-architectures x86_64 --license-info GPL-3.0-or-later --zip-file fileb://ffmpeg-layer.zip`
     and added to the function. Without it the video cameras fail; nothing else needs it.
   - **Environment variables**:
     - `BUCKET_NAME` (required for the S3 cache): an existing private bucket is fine, for example the
       default-assets bucket. Without it the cache only lives in each warm instance's memory.
     - `CACHE_PREFIX` (optional): default `council-systems/`.
     - `FETCH_TIMEOUT_MS` (optional): default `8000`.
     - `FFMPEG_PATH` (optional): default `/opt/bin/ffmpeg`, from the layer.
3. **Permissions**: give the function's role `s3:GetObject` and
   `s3:PutObject` on `arn:aws:s3:::<bucket>/council-systems/*`, and
   `secretsmanager:GetSecretValue` on the `council-systems/lizard` secret.
4. **API Gateway**: on the HTTP API that serves `lambda.lighthouse-extension.com/lad_v2/...`,
   add the route `GET /lad_v2/council/{proxy+}`, integrate it with the function,
   and attach the **LH-BeaconAuthorizerV2** authorizer, as on the other
   `lad_v2` routes. CORS is the same as those routes.

## Check it after deploying

With a Beacon token from a signed-in Beacon tab:

```sh
curl -s -H "Authorization: Bearer $TOKEN" \
  https://lambda.lighthouse-extension.com/lad_v2/council/parramatta/water-levels | jq '.meta, (.features | length)'
```

`meta.ok` should be `true` with around 20 gauges. For a Tweed camera,
`.../council/tweed/flood-cameras/wooyungroad` should have an `imageUrl` and a
`takenAt` within the last 15 minutes or so, and a Clarence video camera,
`.../council/clarence/flood-cameras/rogans`, an `imageUrl` starting
`data:image/jpeg`. The CloudWatch logs have a
`source_failed` line for each failed fetch from a council's system.
