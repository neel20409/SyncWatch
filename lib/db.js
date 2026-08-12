import mongoose from "mongoose";
import { getPgPool, initPgTables } from "./pg";

const MONGODB_URI = process.env.MONGODB_URI;
const POSTGRES_URL =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

let cachedMongo = global.mongoose || { conn: null, promise: null };
global.mongoose = cachedMongo;

let pgTablesInitialized = false;

async function dbConnect() {
  if (POSTGRES_URL) {
    const pool = getPgPool();
    if (!pgTablesInitialized) {
      await initPgTables();
      pgTablesInitialized = true;
    }
    return { type: "postgres", pool };
  }

  const mongoUri = MONGODB_URI || "mongodb://localhost:27017/yt-watch-party";

  if (cachedMongo.conn) return { type: "mongodb", conn: cachedMongo.conn };

  if (!cachedMongo.promise) {
    cachedMongo.promise = mongoose
      .connect(mongoUri, { bufferCommands: false })
      .then((m) => m);
  }

  try {
    cachedMongo.conn = await cachedMongo.promise;
  } catch (e) {
    cachedMongo.promise = null;
    throw e;
  }

  return { type: "mongodb", conn: cachedMongo.conn };
}

export default dbConnect;
