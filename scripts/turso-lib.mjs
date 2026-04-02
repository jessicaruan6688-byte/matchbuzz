import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

export const DEFAULT_SCHEMA_PATH = path.join(ROOT_DIR, "db", "schema.sql");

export function getRequiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getOptionalEnv(name, fallback = "") {
  const value = String(process.env[name] || "").trim();
  return value || fallback;
}

export function createTursoClient() {
  return createClient({
    url: getRequiredEnv("TURSO_DATABASE_URL"),
    authToken: getRequiredEnv("TURSO_AUTH_TOKEN")
  });
}

export function loadSchemaSql(schemaPath = DEFAULT_SCHEMA_PATH) {
  return fs.readFileSync(schemaPath, "utf8");
}

export function splitSqlStatements(rawSql) {
  return rawSql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function applySchema(client, schemaSql) {
  for (const statement of splitSqlStatements(schemaSql)) {
    await client.execute(statement);
  }
}

export function buildLibsqlUrl(databaseName, organizationSlug) {
  return `libsql://${databaseName}-${organizationSlug}.turso.io`;
}

export function toSafeDbName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
