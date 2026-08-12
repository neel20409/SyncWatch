import { v4 as uuidv4 } from "uuid";
import dbConnect from "../../../lib/db";
import Room from "../../../models/Room";
import User from "../../../models/User";
import { getTokenFromRequest, verifyToken } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: "Invalid token" });

  const db = await dbConnect();

  const { name, isPrivate } = req.body;
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  const roomName = name || `${decoded.username}'s Room`;
  const isPriv = isPrivate || false;

  try {
    if (db.type === "postgres") {
      const pool = db.pool;
      const userIdNum = isNaN(decoded.userId) ? null : parseInt(decoded.userId, 10);

      const roomRes = await pool.query(
        "INSERT INTO rooms (room_id, name, created_by, is_private) VALUES ($1, $2, $3, $4) RETURNING *",
        [roomId, roomName, userIdNum, isPriv]
      );

      if (userIdNum) {
        await pool.query("UPDATE users SET rooms_created = rooms_created + 1 WHERE id = $1", [userIdNum]);
      }

      const rawRoom = roomRes.rows[0];
      const room = {
        id: rawRoom.id,
        roomId: rawRoom.room_id,
        name: rawRoom.name,
        createdBy: rawRoom.created_by,
        isPrivate: rawRoom.is_private,
        currentVideoId: rawRoom.current_video_id,
      };

      return res.status(201).json({ room });
    }

    const room = await Room.create({
      roomId,
      name: roomName,
      createdBy: decoded.userId,
      isPrivate: isPriv,
    });

    await User.findByIdAndUpdate(decoded.userId, { $inc: { roomsCreated: 1 } });

    return res.status(201).json({ room });
  } catch (error) {
    console.error("Room creation error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
