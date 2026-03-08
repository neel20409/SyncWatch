export default function handler(req, res) {
  // Check if socket.io instance is attached to global
  const hasIO = !!global._io;
  const rooms = global._rooms || {};
  const roomCount = Object.keys(rooms).length;
  const roomDetails = Object.entries(rooms).map(([id, r]) => ({
    id,
    members: Object.values(r.members || {}),
    videoId: r.videoId,
    isPlaying: r.isPlaying,
  }));

  res.status(200).json({
    hasIO,
    roomCount,
    rooms: roomDetails,
    pid: process.pid,  // ← This tells us if different requests hit different processes
    time: Date.now(),
  });
}
