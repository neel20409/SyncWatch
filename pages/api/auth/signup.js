import dbConnect from "../../../lib/db";
import User from "../../../models/User";
import { signToken } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    await dbConnect();
  } catch (dbError) {
    console.error("DB connection failed:", dbError.message);
    return res.status(500).json({ error: `Database connection failed: ${dbError.message}` });
  }

  try {
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
