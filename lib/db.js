import mongoose from "mongoose";
import { getPgPool, initPgTables, getPostgresUrl } from "./pg";

let cachedMongo = global.mongoose || { conn: null, promise: null };
global.mongoose = cachedMongo;

let pgTablesInitialized = false;

async function dbConnect() {
  const postgresUrl = getPostgresUrl();

  if (postgresUrl) {
    const pool = getPgPool();
    if (!pgTablesInitialized) {
      await initPgTables();
      pgTablesInitialized = true;
    }
    return { type: "postgres", pool };
  }

  const mongoUri = process.env.MONGODB_URI;

  if (mongoUri) {
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

  // Local development fallback only if NODE_ENV is not production
  if (process.env.NODE_ENV !== "production") {
    const localUri = "mongodb://localhost:27017/yt-watch-party";
    if (cachedMongo.conn) return { type: "mongodb", conn: cachedMongo.conn };
    if (!cachedMongo.promise) {
      cachedMongo.promise = mongoose
        .connect(localUri, { bufferCommands: false })
        .then((m) => m);
    }
    try {
      cachedMongo.conn = await cachedMongo.promise;
      return { type: "mongodb", conn: cachedMongo.conn };
    } catch (e) {
      cachedMongo.promise = null;
    }
  }

  throw new Error("No database configured. Please set POSTGRES_URL or SyncWatch_DATABASE_URL in your Render Environment Variables.");
}

export default dbConnect;
