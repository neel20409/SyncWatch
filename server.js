const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Store rooms on global so debug endpoint can see them
global._rooms = global._rooms || {};
const rooms = global._rooms;

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: "*", methods: ["GET", "POST"], credentials: false },
    allowEIO3: true,
    transports: ["polling", "websocket"],
    // Increase ping timeout for Railway
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  global._io = io;

  io.on("connection", (socket) => {
    console.log(`[${process.pid}] CONNECT ${socket.id} transport=${socket.conn.transport.name}`);

    socket.on("join-room", ({ roomId, username }) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.username = username;

      if (!rooms[roomId]) {
        rooms[roomId] = {
          videoId: "",
          isPlaying: false,
          currentTime: 0,
          host: socket.id,
          members: {},
          lastUpdate: Date.now(),
        };
      }
      rooms[roomId].members[socket.id] = username;

      // How many sockets are actually in this room?
      const socketsInRoom = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      console.log(`[${process.pid}] JOIN room=${roomId} user=${username} id=${socket.id} roomSize=${socketsInRoom}`);

      socket.emit("room-state", rooms[roomId]);
      socket.to(roomId).emit("user-joined", { userId: socket.id, username, members: rooms[roomId].members });
      io.to(roomId).emit("members-update", rooms[roomId].members);
    });

    socket.on("video-change", ({ roomId, videoId }) => {
      if (!rooms[roomId]) return;
      rooms[roomId].videoId = videoId;
      rooms[roomId].currentTime = 0;
      rooms[roomId].isPlaying = false;
      rooms[roomId].lastUpdate = Date.now();
      const socketsInRoom = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      console.log(`[${process.pid}] VIDEO-CHANGE room=${roomId} video=${videoId} roomSize=${socketsInRoom}`);
      io.to(roomId).emit("video-changed", { videoId });
    });

    socket.on("video-play", ({ roomId, currentTime }) => {
      if (!rooms[roomId]) return;
      rooms[roomId].isPlaying = true;
      rooms[roomId].currentTime = currentTime;
      rooms[roomId].lastUpdate = Date.now();
      const socketsInRoom = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      console.log(`[${process.pid}] VIDEO-PLAY room=${roomId} time=${currentTime} roomSize=${socketsInRoom} from=${socket.id}`);
      // Emit to all OTHER sockets in room
      socket.to(roomId).emit("video-played", { currentTime });
      console.log(`[${process.pid}] Emitted video-played to room ${roomId} (excluding sender)`);
    });

    socket.on("video-pause", ({ roomId, currentTime }) => {
      if (!rooms[roomId]) return;
      rooms[roomId].isPlaying = false;
      rooms[roomId].currentTime = currentTime;
      rooms[roomId].lastUpdate = Date.now();
      const socketsInRoom = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      console.log(`[${process.pid}] VIDEO-PAUSE room=${roomId} time=${currentTime} roomSize=${socketsInRoom} from=${socket.id}`);
      socket.to(roomId).emit("video-paused", { currentTime });
      console.log(`[${process.pid}] Emitted video-paused to room ${roomId} (excluding sender)`);
    });

    socket.on("video-seek", ({ roomId, currentTime }) => {
      if (!rooms[roomId]) return;
      rooms[roomId].currentTime = currentTime;
      rooms[roomId].lastUpdate = Date.now();
      socket.to(roomId).emit("video-seeked", { currentTime });
    });

    socket.on("sync-request", ({ roomId }) => {
      if (!rooms[roomId]) return;
      const elapsed = (Date.now() - rooms[roomId].lastUpdate) / 1000;
      const syncTime = rooms[roomId].isPlaying ? rooms[roomId].currentTime + elapsed : rooms[roomId].currentTime;
      socket.emit("sync-response", { ...rooms[roomId], currentTime: syncTime });
    });

    socket.on("chat-message", ({ roomId, message, username }) => {
      io.to(roomId).emit("chat-message", { username, message, timestamp: Date.now() });
    });

    socket.on("disconnect", () => {
      const { roomId, username } = socket.data;
      console.log(`[${process.pid}] DISCONNECT ${socket.id} (${username}) from room ${roomId}`);
      if (roomId && rooms[roomId]) {
        delete rooms[roomId].members[socket.id];
        if (rooms[roomId].host === socket.id) {
          const remaining = Object.keys(rooms[roomId].members);
          if (remaining.length > 0) rooms[roomId].host = remaining[0];
        }
        if (Object.keys(rooms[roomId].members).length === 0) {
          delete rooms[roomId];
        } else {
          io.to(roomId).emit("user-left", { userId: socket.id, username, members: rooms[roomId]?.members || {} });
          io.to(roomId).emit("members-update", rooms[roomId]?.members || {});
        }
      }
    });
  });

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`[${process.pid}] Ready on http://localhost:${PORT}`);
  });
});
