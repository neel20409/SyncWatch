import { Pool } from "@neondatabase/serverless";
import pg from "pg";

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

let pool = global._pgPool;

export function getPgPool() {
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
}
