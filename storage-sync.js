const fs = require("fs");
const { createClient } = require("@libsql/client");

function hasRemoteStorageConfig(databaseUrl, authToken) {
  const url = String(databaseUrl || "").trim();
  if (!url) {
    return false;
  }

  if (url.startsWith("file:")) {
    return true;
  }

  return Boolean(String(authToken || "").trim());
}

function quoteIdentifier(name) {
  const value = String(name || "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
  return `"${value}"`;
}

function normalizeValue(value) {
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : String(value);
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  return value;
}

function countSnapshotRows(snapshot, tables) {
  return tables.reduce((total, tableName) => total + Number(snapshot?.[tableName]?.length || 0), 0);
}

function toIsoString(timestamp) {
  if (!timestamp) {
    return null;
  }
  return new Date(timestamp).toISOString();
}

function mapRemoteRows(resultSet, fallbackColumns = []) {
  const columns = Array.isArray(resultSet?.columns) && resultSet.columns.length ? resultSet.columns : fallbackColumns;
  return Array.from(resultSet?.rows || []).map((row) => {
    const next = {};
    columns.forEach((columnName, index) => {
      let value = null;
      if (row && typeof row === "object" && !Array.isArray(row) && Object.prototype.hasOwnProperty.call(row, columnName)) {
        value = row[columnName];
      } else if (Array.isArray(row)) {
        value = row[index];
      } else if (row && typeof row === "object" && Object.prototype.hasOwnProperty.call(row, index)) {
        value = row[index];
      }
      next[columnName] = normalizeValue(value);
    });
    return next;
  });
}

function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function createStorageSync(options) {
  const {
    databaseUrl = "",
    authToken = "",
    schemaPath,
    syncTables = [],
    syncIntervalMs = 15000,
    getDb,
    onHydrated
  } = options || {};

  const state = {
    enabled: hasRemoteStorageConfig(databaseUrl, authToken),
    syncIntervalMs: Math.max(3000, Number(syncIntervalMs || 15000)),
    lastHydratedAt: 0,
    lastPushAt: 0,
    lastMutationAt: 0,
    lastMutationReason: null,
    lastPushReason: null,
    lastError: null,
    localDirty: false,
    hydrationPromise: null,
    pushPromise: null
  };

  const schemaSql = schemaPath && fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, "utf8") : "";
  let client = null;

  function setLastError(error) {
    if (!error) {
      state.lastError = null;
      return;
    }

    state.lastError = {
      message: error.message || String(error),
      at: new Date().toISOString()
    };
  }

  function getClient() {
    if (!state.enabled) {
      return null;
    }

    if (!client) {
      client = createClient({
        url: String(databaseUrl || "").trim(),
        authToken: String(authToken || "").trim() || undefined
      });
    }

    return client;
  }

  function getColumnNames(tableName) {
    const db = getDb();
    if (!db) {
      return [];
    }

    return db
      .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
      .all()
      .map((row) => row.name);
  }

  function getLocalSnapshot() {
    const db = getDb();
    const snapshot = {};

    if (!db) {
      return snapshot;
    }

    syncTables.forEach((tableName) => {
      snapshot[tableName] = db
        .prepare(`SELECT * FROM ${quoteIdentifier(tableName)}`)
        .all()
        .map((row) => {
          const next = {};
          Object.entries(row).forEach(([key, value]) => {
            next[key] = normalizeValue(value);
          });
          return next;
        });
    });

    return snapshot;
  }

  function buildInsertSql(tableName, columns) {
    const quotedColumns = columns.map((columnName) => quoteIdentifier(columnName)).join(", ");
    const placeholders = columns.map(() => "?").join(", ");
    return `INSERT INTO ${quoteIdentifier(tableName)} (${quotedColumns}) VALUES (${placeholders})`;
  }

  function applyLocalSnapshot(snapshot) {
    const db = getDb();
    if (!db) {
      return;
    }

    db.exec("BEGIN");
    try {
      syncTables
        .slice()
        .reverse()
        .forEach((tableName) => {
          db.prepare(`DELETE FROM ${quoteIdentifier(tableName)}`).run();
        });

      syncTables.forEach((tableName) => {
        const rows = Array.isArray(snapshot?.[tableName]) ? snapshot[tableName] : [];
        if (!rows.length) {
          return;
        }

        const columns = getColumnNames(tableName);
        const statement = db.prepare(buildInsertSql(tableName, columns));
        rows.forEach((row) => {
          statement.run(...columns.map((columnName) => (row[columnName] === undefined ? null : row[columnName])));
        });
      });

      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  async function ensureRemoteSchema() {
    if (!state.enabled || !schemaSql) {
      return;
    }
    await getClient().executeMultiple(schemaSql);
  }

  async function fetchRemoteSnapshot() {
    const remoteClient = getClient();
    const snapshot = {};

    for (const tableName of syncTables) {
      const fallbackColumns = getColumnNames(tableName);
      const result = await remoteClient.execute(`SELECT * FROM ${quoteIdentifier(tableName)}`);
      snapshot[tableName] = mapRemoteRows(result, fallbackColumns);
    }

    return snapshot;
  }

  async function pushSnapshot(snapshot, reason = "manual") {
    if (!state.enabled) {
      return false;
    }

    await ensureRemoteSchema();
    const remoteClient = getClient();

    for (const tableName of syncTables.slice().reverse()) {
      await remoteClient.execute(`DELETE FROM ${quoteIdentifier(tableName)}`);
    }

    for (const tableName of syncTables) {
      const rows = Array.isArray(snapshot?.[tableName]) ? snapshot[tableName] : [];
      if (!rows.length) {
        continue;
      }

      const columns = getColumnNames(tableName);
      const sql = buildInsertSql(tableName, columns);
      const statements = rows.map((row) => ({
        sql,
        args: columns.map((columnName) => (row[columnName] === undefined ? null : row[columnName]))
      }));

      for (const chunk of chunkItems(statements, 80)) {
        await remoteClient.batch(chunk, "write");
      }
    }

    state.lastPushAt = Date.now();
    state.lastPushReason = reason;
    state.localDirty = false;
    setLastError(null);
    return true;
  }

  async function ensureFresh(force = false) {
    if (!state.enabled) {
      return false;
    }

    const stale = Date.now() - state.lastHydratedAt >= state.syncIntervalMs;
    if (!force && state.lastHydratedAt && !stale) {
      return false;
    }

    if (state.hydrationPromise) {
      return state.hydrationPromise;
    }

    state.hydrationPromise = (async () => {
      try {
        await ensureRemoteSchema();
        const remoteSnapshot = await fetchRemoteSnapshot();
        const remoteRowCount = countSnapshotRows(remoteSnapshot, syncTables);

        if (remoteRowCount === 0) {
          const localSnapshot = getLocalSnapshot();
          if (countSnapshotRows(localSnapshot, syncTables) > 0) {
            await pushSnapshot(localSnapshot, "bootstrap-local-seed");
          }
          state.lastHydratedAt = Date.now();
          setLastError(null);
          return true;
        }

        applyLocalSnapshot(remoteSnapshot);
        if (typeof onHydrated === "function") {
          onHydrated(remoteSnapshot);
        }

        state.lastHydratedAt = Date.now();
        state.localDirty = false;
        setLastError(null);
        return true;
      } catch (error) {
        setLastError(error);
        throw error;
      } finally {
        state.hydrationPromise = null;
      }
    })();

    return state.hydrationPromise;
  }

  function markLocalDirty(reason = "mutation") {
    if (!state.enabled) {
      return;
    }

    state.localDirty = true;
    state.lastMutationAt = Date.now();
    state.lastMutationReason = reason;
  }

  async function flushIfDirty(reason = "mutation") {
    if (!state.enabled || !state.localDirty) {
      return false;
    }

    if (state.pushPromise) {
      return state.pushPromise;
    }

    state.pushPromise = (async () => {
      try {
        return await pushSnapshot(getLocalSnapshot(), reason);
      } catch (error) {
        setLastError(error);
        throw error;
      } finally {
        state.pushPromise = null;
      }
    })();

    return state.pushPromise;
  }

  function getStatus(extra = {}) {
    return {
      provider: state.enabled ? "SQLite + Turso mirror" : "SQLite",
      configured: Boolean(getDb()),
      remoteConfigured: state.enabled,
      remoteUrl: String(databaseUrl || "").trim() || null,
      syncIntervalMs: state.syncIntervalMs,
      localDirty: state.localDirty,
      lastHydratedAt: toIsoString(state.lastHydratedAt),
      lastPushAt: toIsoString(state.lastPushAt),
      lastPushReason: state.lastPushReason,
      lastMutationAt: toIsoString(state.lastMutationAt),
      lastMutationReason: state.lastMutationReason,
      lastError: state.lastError,
      ...extra
    };
  }

  return {
    enabled() {
      return state.enabled;
    },
    ensureFresh,
    markLocalDirty,
    flushIfDirty,
    getStatus
  };
}

module.exports = {
  createStorageSync
};
