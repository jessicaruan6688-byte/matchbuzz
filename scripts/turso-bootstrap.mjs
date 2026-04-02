import fs from "node:fs";
import path from "node:path";
import {
  applySchema,
  buildLibsqlUrl,
  createTursoClient,
  getOptionalEnv,
  getRequiredEnv,
  loadSchemaSql,
  toSafeDbName
} from "./turso-lib.mjs";

const PLATFORM_API_BASE = "https://api.turso.tech/v1";

function getHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : {};

  if (!response.ok) {
    const detail = data?.error || data?.message || rawText || `HTTP ${response.status}`;
    const error = new Error(detail);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function ensureGroup(token, orgSlug, groupName, location) {
  try {
    await requestJson(`${PLATFORM_API_BASE}/organizations/${orgSlug}/groups`, {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({
        name: groupName,
        location
      })
    });
    return { created: true, groupName, location };
  } catch (error) {
    if (error.status === 409) {
      return { created: false, groupName, location };
    }
    throw error;
  }
}

async function ensureDatabase(token, orgSlug, dbName, groupName) {
  try {
    const data = await requestJson(`${PLATFORM_API_BASE}/organizations/${orgSlug}/databases`, {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({
        name: dbName,
        group: groupName
      })
    });

    return {
      created: true,
      database: data.database
    };
  } catch (error) {
    if (error.status === 409) {
      return {
        created: false,
        database: {
          Name: dbName,
          Hostname: `${dbName}-${orgSlug}.turso.io`
        }
      };
    }
    throw error;
  }
}

async function createDatabaseToken(token, orgSlug, dbName) {
  const expiration = encodeURIComponent(getOptionalEnv("TURSO_DB_TOKEN_EXPIRATION", "never"));
  const authorization = encodeURIComponent(getOptionalEnv("TURSO_DB_TOKEN_AUTHORIZATION", "full-access"));
  const data = await requestJson(
    `${PLATFORM_API_BASE}/organizations/${orgSlug}/databases/${dbName}/auth/tokens?expiration=${expiration}&authorization=${authorization}`,
    {
      method: "POST",
      headers: getHeaders(token)
    }
  );
  return data.jwt;
}

async function main() {
  const platformToken = getRequiredEnv("TURSO_PLATFORM_API_TOKEN");
  const orgSlug = getRequiredEnv("TURSO_ORG_SLUG");
  const groupName = getOptionalEnv("TURSO_GROUP_NAME", "default");
  const location = getOptionalEnv("TURSO_GROUP_LOCATION", "lhr");
  const dbName = toSafeDbName(getOptionalEnv("TURSO_DB_NAME", "matchbuzz-prod"));
  const shouldApplySchema = getOptionalEnv("TURSO_APPLY_SCHEMA", "1") !== "0";
  const shouldWriteEnvFile = getOptionalEnv("TURSO_WRITE_ENV_FILE", "1") !== "0";

  const groupResult = await ensureGroup(platformToken, orgSlug, groupName, location);
  const dbResult = await ensureDatabase(platformToken, orgSlug, dbName, groupName);
  const dbToken = await createDatabaseToken(platformToken, orgSlug, dbName);
  const databaseUrl = buildLibsqlUrl(dbName, orgSlug);

  process.env.TURSO_DATABASE_URL = databaseUrl;
  process.env.TURSO_AUTH_TOKEN = dbToken;

  if (shouldApplySchema) {
    const client = createTursoClient();
    await applySchema(client, loadSchemaSql());
    await client.close();
  }

  const envOutput = [
    `TURSO_DATABASE_URL=${databaseUrl}`,
    `TURSO_AUTH_TOKEN=${dbToken}`,
    `TURSO_DB_NAME=${dbName}`,
    `TURSO_GROUP_NAME=${groupName}`,
    `TURSO_GROUP_LOCATION=${location}`,
    `TURSO_ORG_SLUG=${orgSlug}`
  ].join("\n");

  if (shouldWriteEnvFile) {
    const outputPath = path.join(process.cwd(), ".env.turso");
    fs.writeFileSync(outputPath, `${envOutput}\n`, "utf8");
  }

  console.log(
    JSON.stringify(
      {
        group: {
          name: groupName,
          location,
          created: groupResult.created
        },
        database: {
          name: dbName,
          created: dbResult.created,
          url: databaseUrl
        },
        env: {
          TURSO_DATABASE_URL: databaseUrl,
          TURSO_AUTH_TOKEN: "<redacted>",
          TURSO_DB_NAME: dbName,
          TURSO_GROUP_NAME: groupName,
          TURSO_GROUP_LOCATION: location,
          TURSO_ORG_SLUG: orgSlug
        }
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
