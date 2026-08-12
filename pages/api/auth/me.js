import dbConnect from "../../../lib/db";
import User from "../../../models/User";
import { getTokenFromRequest, verifyToken } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: "Invalid token" });

  const db = await dbConnect();

  if (db.type === "postgres") {
    const pool = db.pool;
    // Check numeric id or fallback string
    const userRes = await pool.query(
      "SELECT id, username, email, avatar, rooms_created, created_at FROM users WHERE id = $1",
      [isNaN(decoded.userId) ? 0 : parseInt(decoded.userId, 10)]
    );

    if (userRes.rows.length === 0) return res.status(404).json({ error: "User not found" });
    return res.status(200).json({ user: userRes.rows[0] });
  }

  const user = await User.findById(decoded.userId).select("-password");
  if (!user) return res.status(404).json({ error: "User not found" });

  return res.status(200).json({ user });
}
