import { Pool } from "@neondatabase/serverless";
import pg from "pg";

export function getPostgresUrl() {
  if (process.env.SyncWatch_DATABASE_URL) return process.env.SyncWatch_DATABASE_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NEON_DATABASE_URL) return process.env.NEON_DATABASE_URL;

  for (const [key, value] of Object.entries(process.env)) {
    if (value && typeof value === "string" && (key.toLowerCase().includes("database_url") || key.toLowerCase().includes("postgres"))) {
      return value;
    }
  }
  return null;
}

let pool = global._pgPool;

export function getPgPool() {
  const connectionString = getPostgresUrl();
  if (!connectionString) {
    return null;
  }

  if (!pool) {
    const isNeon = connectionString.includes("neon.tech") || connectionString.includes("vercel-storage");
    if (isNeon) {
      pool = new Pool({ connectionString });
    } else {
      pool = new pg.Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
      });
    }
    global._pgPool = pool;
  }

  return pool;
}

export async function initPgTables() {
  const p = getPgPool();
  if (!p) return false;

  try {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar TEXT DEFAULT '',
        rooms_created INT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createRoomsTable = `
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) DEFAULT 'Watch Party',
        created_by INT,
        is_private BOOLEAN DEFAULT FALSE,
        current_video_id VARCHAR(100) DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await p.query(createUsersTable);
    await p.query(createRoomsTable);
    return true;
  } catch (err) {
    console.error("Postgres table initialization error:", err);
    return false;
  }
}
