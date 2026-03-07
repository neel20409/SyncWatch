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

  await dbConnect();

  const { name, isPrivate } = req.body;
  const roomId = uuidv4().slice(0, 8).toUpperCase();

  try {
    const room = await Room.create({
      roomId,
      name: name || `${decoded.username}'s Room`,
      createdBy: decoded.userId,
      isPrivate: isPrivate || false,
    });

    await User.findByIdAndUpdate(decoded.userId, { $inc: { roomsCreated: 1 } });

    return res.status(201).json({ room });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
}
