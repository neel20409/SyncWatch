import dbConnect from "../../../lib/db";
import User from "../../../models/User";
import { signToken } from "../../../lib/auth";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { credential, accessToken } = req.body || {};

  if (!credential && !accessToken) {
    return res.status(400).json({ error: "Google credential token or access token is required" });
  }

  let googleUser = null;

  try {
    if (credential) {
      // Verify Google ID token via Google's tokeninfo API
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (!googleRes.ok) {
        return res.status(401).json({ error: "Invalid or expired Google token" });
      }
      const tokenData = await googleRes.json();
      if (!tokenData.email) {
        return res.status(400).json({ error: "Google account does not provide an email" });
      }
      googleUser = {
        email: tokenData.email.toLowerCase(),
        name: tokenData.name || tokenData.given_name || tokenData.email.split("@")[0],
        picture: tokenData.picture || "",
        sub: tokenData.sub,
      };
    } else if (accessToken) {
      // Verify Access Token via Google userinfo API
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userinfoRes.ok) {
        return res.status(401).json({ error: "Failed to fetch Google user profile" });
      }
      const tokenData = await userinfoRes.json();
      if (!tokenData.email) {
        return res.status(400).json({ error: "Google account does not provide an email" });
      }
      googleUser = {
        email: tokenData.email.toLowerCase(),
        name: tokenData.name || tokenData.given_name || tokenData.email.split("@")[0],
        picture: tokenData.picture || "",
        sub: tokenData.sub,
      };
    }
  } catch (verifyErr) {
    console.error("Google token verification error:", verifyErr);
    return res.status(500).json({ error: `Google authentication failed: ${verifyErr.message}` });
  }

  let db;
  try {
    db = await dbConnect();
  } catch (dbError) {
    console.error("DB connection error:", dbError);
    return res.status(500).json({ error: `Database connection failed: ${dbError.message}` });
  }

  try {
    const email = googleUser.email;
    const baseUsername = googleUser.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 15) || email.split("@")[0].slice(0, 15);

    if (db.type === "postgres") {
      const pool = db.pool;

      // Check if user exists by email
      const userRes = await pool.query(
        "SELECT id, username, email, avatar FROM users WHERE LOWER(email) = LOWER($1)",
        [email]
      );

      let user;

      if (userRes.rows.length > 0) {
        user = userRes.rows[0];
        // Update avatar if missing
        if (!user.avatar && googleUser.picture) {
          await pool.query("UPDATE users SET avatar = $1 WHERE id = $2", [googleUser.picture, user.id]);
          user.avatar = googleUser.picture;
        }
      } else {
        // Find a unique username
        let username = baseUsername;
        let count = 1;
        while (true) {
          const checkUser = await pool.query(
            "SELECT id FROM users WHERE LOWER(username) = LOWER($1)",
            [username]
          );
          if (checkUser.rows.length === 0) break;
          username = `${baseUsername}${count++}`;
        }

        const randomPassword = await bcrypt.hash(`google_${googleUser.sub}_${Date.now()}`, 12);
        const insertRes = await pool.query(
          "INSERT INTO users (username, email, password, avatar) VALUES ($1, $2, $3, $4) RETURNING id, username, email, avatar",
          [username, email, randomPassword, googleUser.picture]
        );
        user = insertRes.rows[0];
      }

      const token = signToken({
        userId: user.id.toString(),
        username: user.username,
        email: user.email,
      });

      res.setHeader(
        "Set-Cookie",
        `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`
      );

      return res.status(200).json({
        message: "Google login successful",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
        },
        token,
      });
    }

    // Mongo mode
    let user = await User.findOne({ email });

    if (user) {
      if (!user.avatar && googleUser.picture) {
        user.avatar = googleUser.picture;
        await user.save();
      }
    } else {
      let username = baseUsername;
      let count = 1;
      while (await User.findOne({ username })) {
        username = `${baseUsername}${count++}`;
      }

      const randomPassword = `google_${googleUser.sub}_${Date.now()}`;
      user = await User.create({
        username,
        email,
        password: randomPassword,
        avatar: googleUser.picture,
      });
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
      message: "Google login successful",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
      },
      token,
    });
  } catch (error) {
    console.error("Google auth handler error:", error);
    return res.status(500).json({ error: `Google auth failed: ${error.message}` });
  }
}
