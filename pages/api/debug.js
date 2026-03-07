export default async function handler(req, res) {
  // Check env vars (don't expose actual values, just whether they exist)
  const checks = {
    MONGODB_URI_set: !!process.env.MONGODB_URI,
    MONGODB_URI_starts_with: process.env.MONGODB_URI?.substring(0, 14) || "NOT SET",
    JWT_SECRET_set: !!process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV || "NOT SET",
  };

  // Try DB connection
  let dbStatus = "not tested";
  try {
    const { default: dbConnect } = await import("../../lib/db");
    await dbConnect();
    dbStatus = "connected ✅";
  } catch (err) {
    dbStatus = `failed ❌: ${err.message}`;
  }

  return res.status(200).json({
    status: "API is reachable ✅",
    env: checks,
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
}
