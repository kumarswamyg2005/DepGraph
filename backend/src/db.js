import neo4j from 'neo4j-driver';
import 'dotenv/config';

let driver = null;
let connectionStatus = 'disconnected'; // 'connected' | 'disconnected' | 'error'

/**
 * Initialize a single Neo4j driver instance.
 * Never throws — failures are captured in connectionStatus.
 */
export async function initDriver() {
  const uri = process.env.COGNODB_URI;
  const user = process.env.COGNODB_USER;
  const password = process.env.COGNODB_PASSWORD;

  if (!uri || !user || !password) {
    console.error('[db] Missing COGNODB_URI / COGNODB_USER / COGNODB_PASSWORD env vars.');
    connectionStatus = 'error';
    return;
  }

  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3h
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 30_000,
    });

    // Verify connectivity
    await driver.verifyConnectivity();
    connectionStatus = 'connected';
    console.log(`[db] Connected to CognoDB at ${uri}`);
  } catch (err) {
    console.error(`[db] Failed to connect: ${err.message}`);
    connectionStatus = 'error';
    driver = null;
  }
}

/** Return the active driver, or null if unavailable. */
export function getDriver() {
  return driver;
}

/** Return current DB connectivity status. */
export function getStatus() {
  return connectionStatus;
}

/**
 * Open a Neo4j session scoped to a callback, auto-closing on exit.
 * Returns { data, error } — never throws to the caller.
 */
export async function withSession(fn) {
  if (!driver) {
    return { data: null, error: 'Database unavailable' };
  }
  const session = driver.session();
  try {
    const data = await fn(session);
    return { data, error: null };
  } catch (err) {
    console.error('[db] Query error:', err.message);
    return { data: null, error: err.message };
  } finally {
    await session.close();
  }
}

/** Convert Neo4j Integer to JS number safely. */
export function toNumber(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (neo4j.isInt(val)) return val.toNumber();
  return Number(val);
}

/** Serialize a Neo4j record to a plain JS object. */
export function serializeRecord(record) {
  const obj = {};
  for (const key of record.keys) {
    const val = record.get(key);
    obj[key] = serializeValue(val);
  }
  return obj;
}

function serializeValue(val) {
  if (val === null || val === undefined) return null;
  if (neo4j.isInt(val)) return val.toNumber();
  if (typeof val === 'object' && val.constructor?.name === 'Node') {
    return { ...val.properties, _id: val.identity.toNumber(), _labels: val.labels };
  }
  if (typeof val === 'object' && val.constructor?.name === 'Relationship') {
    return {
      ...val.properties,
      _id: val.identity.toNumber(),
      _type: val.type,
      _start: val.start.toNumber(),
      _end: val.end.toNumber(),
    };
  }
  if (typeof val === 'object' && val.constructor?.name === 'Path') {
    return {
      nodes: val.segments.map((s) => serializeValue(s.start)),
      segments: val.segments.map((s) => ({
        start: serializeValue(s.start),
        relationship: serializeValue(s.relationship),
        end: serializeValue(s.end),
      })),
      length: val.length,
    };
  }
  if (Array.isArray(val)) return val.map(serializeValue);
  if (typeof val === 'object') {
    const out = {};
    for (const k of Object.keys(val)) out[k] = serializeValue(val[k]);
    return out;
  }
  return val;
}
