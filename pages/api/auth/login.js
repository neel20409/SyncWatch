import dbConnect from "../../../lib/db";
import User from "../../../models/User";
import { signToken } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await dbConnect();

  const { email: rawEmail, password: rawPassword } = req.body || {};

  // Trim whitespace — catches copy/paste issues
  const email = rawEmail?.trim().toLowerCase();
  const password = rawPassword?.trim();

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    // Find user — also try without case sensitivity
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, "i") } });

    if (!user) {
      // Debug: tell us if it's a "user not found" vs "wrong password"
      return res.status(401).json({ error: "No account found with this email" });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: "Wrong password" });
    }

    const token = signToken({
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
    });

    res.setHeader(
      "Set-Cookie",
      `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`
    );

    return res.status(200).json({
      message: "Logged in",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: `Login failed: ${error.message}` });
  }
}
