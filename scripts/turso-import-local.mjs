import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { applySchema, createTursoClient, getOptionalEnv, loadSchemaSql } from "./turso-lib.mjs";

const TABLES = [
  "polls",
  "campaigns",
  "community_rooms",
  "room_members",
  "watch_parties",
  "watch_party_reservations",
  "watch_party_point_redemptions",
  "sponsor_packages",
  "sponsor_leads",
  "members",
  "member_sessions",
  "member_points_ledger",
  "llm_call_logs",
  "traffic_events"
];

function resolveDataDir() {
  const configured = String(process.env.DATA_DIR || "").trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.join(process.cwd(), "data");
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, "\"\"")}"`;
}

async function importTable(localDb, remoteClient, tableName, truncateFirst) {
  const rows = localDb.prepare(`SELECT * FROM ${quoteIdentifier(tableName)}`).all();
  if (truncateFirst) {
    await remoteClient.execute(`DELETE FROM ${quoteIdentifier(tableName)}`);
  }

  if (!rows.length) {
    return {
      table: tableName,
      rowCount: 0
    };
  }

  const columns = Object.keys(rows[0]);
  const quotedColumns = columns.map(quoteIdentifier).join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT OR REPLACE INTO ${quoteIdentifier(tableName)} (${quotedColumns}) VALUES (${placeholders})`;

  await remoteClient.batch(
    rows.map((row) => ({
      sql,
      args: columns.map((column) => row[column] ?? null)
    })),
    "write"
  );

  return {
    table: tableName,
    rowCount: rows.length
  };
}

async function main() {
  const dbPath = getOptionalEnv("LOCAL_SQLITE_PATH", path.join(resolveDataDir(), "matchbuzz.sqlite"));
  const truncateFirst = getOptionalEnv("TURSO_TRUNCATE_FIRST", "0") === "1";
  const applySchemaFirst = getOptionalEnv("TURSO_APPLY_SCHEMA", "1") !== "0";

  const localDb = new DatabaseSync(dbPath);
  const remoteClient = createTursoClient();

  try {
    if (applySchemaFirst) {
      await applySchema(remoteClient, loadSchemaSql());
    }

    const results = [];
    for (const tableName of TABLES) {
      results.push(await importTable(localDb, remoteClient, tableName, truncateFirst));
    }

    console.log(
      JSON.stringify(
        {
          localDbPath: dbPath,
          tables: results
        },
        null,
        2
      )
    );
  } finally {
    localDb.close();
    await remoteClient.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
