import dbConnect from "../../../lib/db";
import User from "../../../models/User";
import { signToken } from "../../../lib/auth";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  let db;
  try {
    db = await dbConnect();
  } catch (dbError) {
    console.error("DB connection failed:", dbError.message);
    return res.status(500).json({ error: `Database connection failed: ${dbError.message}` });
  }

  try {
    if (db.type === "postgres") {
      const pool = db.pool;
      const cleanEmail = email.trim().toLowerCase();
      const cleanUsername = username.trim();

      const checkRes = await pool.query(
        "SELECT id, email, username FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2)",
        [cleanEmail, cleanUsername]
      );

      if (checkRes.rows.length > 0) {
        const found = checkRes.rows[0];
        if (found.email.toLowerCase() === cleanEmail) {
          return res.status(400).json({ error: "Email already in use" });
        }
        return res.status(400).json({ error: "Username already taken" });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const insertRes = await pool.query(
        "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email",
        [cleanUsername, cleanEmail, hashedPassword]
      );

      const newUser = insertRes.rows[0];
      const token = signToken({
        userId: newUser.id.toString(),
        username: newUser.username,
        email: newUser.email,
      });

      res.setHeader(
        "Set-Cookie",
        `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`
      );

      return res.status(201).json({
        message: "Account created",
        user: { id: newUser.id, username: newUser.username, email: newUser.email },
        token,
      });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ error: "Email already in use" });
      }
      return res.status(400).json({ error: "Username already taken" });
    }

    const user = await User.create({ username, email, password });
    const token = signToken({
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
    });

    res.setHeader(
      "Set-Cookie",
      `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`
    );

    return res.status(201).json({
      message: "Account created",
      user: { id: user._id, username: user.username, email: user.email },
      token,
    });
  } catch (error) {
    console.error("Signup error:", error.message);
    return res.status(500).json({ error: `Signup failed: ${error.message}` });
  }
}
