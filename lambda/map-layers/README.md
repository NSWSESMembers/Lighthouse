# Map Layers Lambda

Backend for the tasking map's collaborative map layers feature: lists/creates
layers and reads/writes their markers, all stored as JSON objects in S3. No
database — this mirrors the existing `share` and `default-assets` Lambdas the
extension already calls at `https://lambda.lighthouse-extension.com/lad/...`.

Frontend code that calls this: `src/pages/tasking/utils/collabLayerSync.js`
(`LAMBDA_BASE = 'https://lambda.lighthouse-extension.com/lad/map-layers'`).

## Routes

| Method | Path                              | Purpose                                    |
|--------|------------------------------------|---------------------------------------------|
| GET    | `/lad/map-layers?apiUrl=`              | List an org's layers (excludes 120+ day idle ones) |
| POST   | `/lad/map-layers`                      | Create a new named layer                    |
| GET    | `/lad/map-layers/{id}?apiUrl=`         | Get a layer + its markers, bumps `lastUsedAt` |
| PUT    | `/lad/map-layers/{id}/features`        | Create or edit a marker (last-write-wins)   |
| DELETE | `/lad/map-layers/{id}/features/{markerId}?apiUrl=&actorId=` | Soft-delete a marker |

The `/lad` prefix is part of the route paths themselves (not added by a
custom domain base path mapping) — see the API Gateway section below.

All five are served by **one** Lambda function (`index.js` routes internally
on `event.requestContext.routeKey`). Data is namespaced per org under a hash
of `apiUrl` (the org's Beacon source URL) — see `lib/s3Store.js`.

Nothing here ever hard-deletes a layer or deletes S3 objects; the 120-day
rule only excludes stale layers from the list response.

**No AWS CLI needed** — everything below is done through the AWS Management
Console in your browser. The one convenient shortcut: Lambda's Node.js 20.x
and 22.x managed runtimes ship with the AWS SDK for JavaScript v3
pre-installed, so `@aws-sdk/client-s3` doesn't need to be bundled — you can
paste the source files straight into the Lambda console's built-in code
editor with no zip/upload step.

## 1. Create the S3 bucket

1. Open the **S3 console** → **Create bucket**.
2. **Bucket name**: something globally unique, e.g. `lighthouse-map-layers`
   (write it down — you'll need it as an environment variable later).
3. **AWS Region**: pick the same region you'll use for the Lambda/API Gateway
   (match whatever region `lambda.lighthouse-extension.com` already runs in).
4. **Block Public Access settings**: leave all four boxes checked (the
   default) — this bucket is only ever read/written by the Lambda, never
   public.
5. **Bucket Versioning**: optional but recommended — turning it on gives you
   an undo button if a bug ever corrupts a layer's JSON. Not required for
   the app to work.
6. Leave everything else default and click **Create bucket**.

**Do not** add a lifecycle rule that expires/deletes objects under
`shared_layers/` — the 120-day rule is a *listing* filter enforced in
`handlers/listLayers.js`, not an S3-level delete. "Data not deleted" is a
hard product requirement.

## 2. Create the Lambda function

1. Open the **Lambda console** → **Create function**.
2. Choose **Author from scratch**.
3. **Function name**: `lighthouse-map-layers`.
4. **Runtime**: **Node.js 20.x** (or 22.x if offered).
5. **Architecture**: leave as `x86_64`.
6. Under **Permissions**, leave "Create a new role with basic Lambda
   permissions" selected — this auto-creates an execution role with just
   CloudWatch Logs access; you'll add S3 access to it in step 3.
7. Click **Create function**.

### Add the code

The console's **Code source** panel starts with a single `index.js`. You
need to recreate this project's file layout inside it:

```
index.js
lib/response.js
lib/s3Store.js
handlers/listLayers.js
handlers/createLayer.js
handlers/getLayer.js
handlers/upsertFeature.js
handlers/deleteFeature.js
```

For each file other than `index.js`:

1. In the file tree, click the **File** menu (or right-click the file list)
   → **New File**.
2. Type the full path including folders, e.g. `lib/response.js` — the
   console creates the `lib` folder automatically.
3. Paste in the contents of that file from this repo (`lambda/map-layers/`).

For `index.js`, delete the placeholder content and paste in this repo's
`index.js`.

Once all 7 files are in place, click the orange **Deploy** button above the
code editor — nothing you paste takes effect until you deploy.

### Environment variable

1. Go to the **Configuration** tab → **Environment variables** → **Edit**.
2. **Add environment variable**: key `BUCKET_NAME`, value = the bucket name
   from step 1 (e.g. `lighthouse-map-layers`).
3. **Save**.

### Timeout and memory (optional but recommended)

1. **Configuration** tab → **General configuration** → **Edit**.
2. Set **Timeout** to `10 sec` and **Memory** to `256 MB` (defaults of 3 sec
   / 128 MB are tight once S3 round-trips are involved).
3. **Save**.

## 3. Give the function's role S3 access

1. Still in the Lambda function, go to **Configuration** → **Permissions**.
2. Click the **Role name** link (opens IAM in a new tab).
3. On the role's page, **Add permissions** → **Create inline policy**.
4. Switch to the **JSON** tab and paste (replace `YOUR_BUCKET_NAME`):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "MapLayersS3Access",
         "Effect": "Allow",
         "Action": ["s3:GetObject", "s3:PutObject"],
         "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/shared_layers/*"
       },
       {
         "Sid": "MapLayersS3List",
         "Effect": "Allow",
         "Action": "s3:ListBucket",
         "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME",
         "Condition": {
           "StringLike": { "s3:prefix": "shared_layers/*" }
         }
       }
     ]
   }
   ```

   The `ListBucket` statement is easy to skip but is required: when
   `GetObject` is called on a key that doesn't exist yet (e.g. the very
   first request for a brand-new org, before its `index.json` has been
   created), S3 returns `403 AccessDenied` instead of `404 NoSuchKey`
   *unless* the caller also has `s3:ListBucket` on the bucket — otherwise it
   won't tell you whether the object is missing or you're just not allowed
   to see it. Without this statement you'll see errors like
   `AccessDenied: ... not authorized to perform: s3:ListBucket` in
   CloudWatch Logs the first time any org is used. `ListBucket` is a
   bucket-level action so it needs the **bucket's** ARN (no trailing
   `/shared_layers/*`), scoped back down to just that prefix via the
   `s3:prefix` condition so the role still can't list the rest of the
   bucket.

   (CloudWatch Logs permissions are already on the role from the
   auto-created "basic Lambda permissions" policy — no need to add those.)
5. Click **Next**, give the policy a name like `map-layers-s3-access`, then
   **Create policy**.

## 4. Wire it into API Gateway

You already have an HTTP API serving `lambda.lighthouse-extension.com/lad/...`
for the `share` and `default-assets` routes. Add these five routes to that
**same API** so `map-layers` shares the existing custom domain and
certificate, rather than standing up a second one.

1. Open the **API Gateway console** → find your existing API (the one
   behind `share`/`default-assets`) → open it.
2. In the left nav, go to **Integrations** → **Create**.
3. Choose **Lambda** as the integration type, pick the region and select
   `lighthouse-map-layers` as the function, then **Create**. (API Gateway
   automatically grants this integration permission to invoke the
   function — no separate permissions step needed, unlike the CLI/SDK
   path.)
4. Go to **Routes** → **Create** and add each of these five routes one at a
   time (method + path exactly as shown, **including** the `/lad` prefix —
   these routes live under `/lad/` directly, it isn't added later by a base
   path mapping):
   - `GET /lad/map-layers`
   - `POST /lad/map-layers`
   - `GET /lad/map-layers/{id}`
   - `PUT /lad/map-layers/{id}/features`
   - `DELETE /lad/map-layers/{id}/features/{markerId}`
5. For **each** route, click it, then **Attach integration** and pick the
   Lambda integration you created in step 3 (all five routes share the one
   integration — that's expected, `index.js` internally routes by
   `event.requestContext.routeKey`).
6. If the API's default stage has **Auto-deploy** enabled (check under
   **Stages** → `$default`), the new routes go live immediately. If not,
   go to **Deploy** and deploy to `$default`.

Since `/lad` is baked into the route paths, check the API's **Custom domain
names** → `lambda.lighthouse-extension.com` → **API mappings**: the mapping
for this API should have an **empty/root Path** (not `lad`), otherwise
requests would need to go to `/lad/lad/map-layers`. If the existing mapping
already has a `lad` path in front of routes defined *without* the prefix
(i.e. `share`'s route is just `/share`), that mapping is serving a different
routing convention than these new routes use — in that case, add a
**second** API mapping for this API with an empty Path instead of reusing
the existing one.

### If you don't have an existing `/lad` API yet

1. **API Gateway console** → **Create API** → **HTTP API** → **Build**.
2. **Add integration**: Lambda, select `lighthouse-map-layers` → **Next**.
3. Add the five routes (method + path from the table above, including the
   `/lad` prefix) → **Next**.
4. Stage: keep `$default` with **Auto-deploy** enabled → **Next** → **Create**.
5. **Custom domain names** → **Create** → domain name
   `lambda.lighthouse-extension.com`, select or request an ACM certificate
   for that domain in the same region → **Create domain name**.
6. On the new domain name's **API mappings** tab → **Configure API mappings**
   → **Add new mapping** → select your API, stage `$default`, leave **Path**
   empty (the `/lad` prefix is already part of the routes) → **Save**.
7. Point your DNS (Route 53 or wherever the domain is hosted) at the domain
   name's **API Gateway domain name** (regional endpoint), shown on the
   custom domain's **Configurations** tab — usually an A/ALIAS record in
   Route 53, or a CNAME elsewhere.

### CORS

Enable CORS at the API level rather than relying on the Lambda's own CORS
headers (which are still there as a harmless fallback):

1. Open your API in **API Gateway** → **CORS** (left nav) → **Configure**.
2. **Access-Control-Allow-Origin**: `*`
3. **Access-Control-Allow-Headers**: `Content-Type`
4. **Access-Control-Allow-Methods**: `GET, POST, PUT, DELETE, OPTIONS`
5. **Save**.

With this enabled, API Gateway answers `OPTIONS` preflight requests itself
— you don't need to create explicit `OPTIONS` routes.

## 5. Test it

**Quickest option — Lambda console's built-in Test feature**, which invokes
the function directly without going through API Gateway at all:

1. On the function's page, go to the **Test** tab.
2. **Create new event**, paste an event JSON shaped like this (this example
   tests `createLayer`):

   ```json
   {
     "requestContext": {
       "http": { "method": "POST" },
       "routeKey": "POST /lad/map-layers"
     },
     "body": "{\"apiUrl\":\"https://your-org.beacon.example.org\",\"name\":\"Test Layer\",\"createdBy\":\"tester\"}"
   }
   ```

3. **Test** → check the returned JSON has `statusCode: 201` and a `body`
   containing the new layer's `id`.
4. To test `listLayers`, use:

   ```json
   {
     "requestContext": {
       "http": { "method": "GET" },
       "routeKey": "GET /lad/map-layers"
     },
     "queryStringParameters": { "apiUrl": "https://your-org.beacon.example.org" }
   }
   ```

   and confirm the layer you created shows up in `body`.

**Through the real URL**, once routes are deployed:

- `GET` requests can be tested by pasting the URL straight into a browser
  tab, e.g.:
  `https://lambda.lighthouse-extension.com/lad/map-layers?apiUrl=https://your-org.beacon.example.org`
- For `POST`/`PUT`/`DELETE` (which need a JSON body), use a tool like
  [Postman](https://www.postman.com/) or Insomnia rather than a browser —
  point it at the same URL, method, and a JSON body matching the shapes in
  the routes table above.

## Notes

- **Concurrency**: the per-org `index.json` (layer list/summaries) uses S3
  conditional writes (`IfMatch`/`IfNoneMatch`) with a 3-attempt retry to
  survive two users creating/updating layers at the same moment. Individual
  layer/marker writes are last-write-wins (no retry needed — only one
  request at a time touches a given layer object in the update path).
- **Validation**: handlers clamp string lengths (name ≤200 chars,
  description ≤2000 chars) and validate `icon` against a fixed allow-list
  (`ICON_KEYS` in `handlers/upsertFeature.js`, kept in sync with
  `src/pages/tasking/components/collab_marker_icons.js`) and `fill` against
  a hex-color pattern, but there's no hard cap on markers-per-layer or
  layers-per-org — add one in `handlers/createLayer.js` /
  `handlers/upsertFeature.js` if you
  need it.
- **SDK version**: relying on the Lambda runtime's pre-installed AWS SDK
  (rather than bundling your own `node_modules`) means the SDK version can
  shift when AWS updates the managed runtime. Fine for this workload; if you
  ever want a pinned version, you'd need to package `node_modules` into a
  zip and upload that instead of using the inline code editor.
- **Logs**: `console.error` calls land in the function's CloudWatch Logs —
  from the function's page, **Monitor** tab → **View CloudWatch logs**.
- **Cost**: this is a low-traffic, tiny-payload workload (S3 GET/PUT + a
  small Lambda) — expect it to sit well within the AWS free tier for any
  realistic number of concurrent incidents/users.
