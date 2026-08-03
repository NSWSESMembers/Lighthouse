// index.mjs
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { verifyBeaconToken } from "./verifyBeaconToken.mjs";

const s3 = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME;
const CONFIG_PREFIX = process.env.CONFIG_PREFIX || "";

const SHARED_PREFS_PREFIX = buildBasePrefix(CONFIG_PREFIX, "shared_prefs");

export const handler = async (event) => {
  try {
    const method = event.requestContext?.http?.method || "GET";
    const query = event.queryStringParameters || {};
    const rawBody = event.body;

    if (method === "OPTIONS") {
      const reqHeaders =
        event.headers?.["access-control-request-headers"] ||
        event.headers?.["Access-Control-Request-Headers"];

      return {
        statusCode: 204,
        headers: {
          ...corsHeaders(reqHeaders),
          "Access-Control-Max-Age": "86400"
        },
        body: ""
      };
    }

    let claims;
    try {
      claims = await verifyBeaconToken(event.headers?.authorization || event.headers?.Authorization);
    } catch (err) {
      return {
        statusCode: 401,
        headers: corsHeaders(),
        body: JSON.stringify({ message: "Unauthorized", error: err?.message || String(err) })
      };
    }
    console.log(JSON.stringify({ msg: "beacon_auth", fn: "share-v2", userId: claims.sub || claims.client_id || "unknown", method }));

    if (method === "POST" && !query.id) {
      return await handleCreateConfig(rawBody);
    }

    if (method === "GET" && query.id) {
      return await handleGetConfig(query.id);
    }

    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ message: "Unsupported request" })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        message: "Internal Server Error",
        error: err?.message || String(err)
      })
    };
  }
};

function corsHeaders(requestedHeaders) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
    "Access-Control-Allow-Headers": requestedHeaders || "Content-Type, Authorization"
  };
}

function buildBasePrefix(...parts) {
  return parts
    .filter(Boolean)
    .map((p) => String(p).replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/") + "/";
}

const ALPHABET = "234679ACDEFGHJKMNPQRTUVWXYZ";

function generateId() {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

function buildConfigKey(id) {
  return `${SHARED_PREFS_PREFIX}${id}.json`;
}

async function handleCreateConfig(rawBody) {
  if (!rawBody) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ message: "Missing body" })
    };
  }

  let config;
  try {
    const parsed = JSON.parse(rawBody);
    config = parsed.config ?? parsed;
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ message: "Invalid JSON body" })
    };
  }

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ message: "Missing or invalid config" })
    };
  }

  const id = generateId();
  const key = buildConfigKey(id);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(config),
      ContentType: "application/json"
    })
  );

  return {
    statusCode: 201,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  };
}

async function handleGetConfig(id) {
  const key = buildConfigKey(id);

  try {
    const result = await s3.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      })
    );

    const bodyString = await streamToString(result.Body);

    let config;
    try {
      config = JSON.parse(bodyString);
    } catch {
      return {
        statusCode: 500,
        headers: corsHeaders(),
        body: JSON.stringify({ message: "Stored config is invalid JSON" })
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ config })
    };
  } catch (err) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ message: "Config not found" })
      };
    }

    console.error(err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ message: "Error fetching config" })
    };
  }
}

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });
  });
}
