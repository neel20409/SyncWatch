const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// In-memory room state
const rooms = {};

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Join a room
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

      // Send current state to new joiner
      socket.emit("room-state", rooms[roomId]);

      // Notify others
      socket.to(roomId).emit("user-joined", {
        userId: socket.id,
        username,
        members: rooms[roomId].members,
      });

      // Broadcast updated member list to everyone
      io.to(roomId).emit("members-update", rooms[roomId].members);

      console.log(`${username} joined room ${roomId}`);
    });

    // Video control events
    socket.on("video-change", ({ roomId, videoId }) => {
      if (!rooms[roomId]) return;
      rooms[roomId].videoId = videoId;
      rooms[roomId].currentTime = 0;
      rooms[roomId].isPlaying = false;
      rooms[roomId].lastUpdate = Date.now();
      socket.to(roomId).emit("video-changed", { videoId });
    });

    socket.on("video-play", ({ roomId, currentTime }) => {
      if (!rooms[roomId]) return;
      rooms[roomId].isPlaying = true;
      rooms[roomId].currentTime = currentTime;
      rooms[roomId].lastUpdate = Date.now();
      socket.to(roomId).emit("video-played", { currentTime });
    });

    socket.on("video-pause", ({ roomId, currentTime }) => {
      if (!rooms[roomId]) return;
      rooms[roomId].isPlaying = false;
      rooms[roomId].currentTime = currentTime;
      rooms[roomId].lastUpdate = Date.now();
      socket.to(roomId).emit("video-paused", { currentTime });
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
      const syncTime = rooms[roomId].isPlaying
        ? rooms[roomId].currentTime + elapsed
        : rooms[roomId].currentTime;
      socket.emit("sync-response", {
        ...rooms[roomId],
        currentTime: syncTime,
      });
    });

    // Chat
    socket.on("chat-message", ({ roomId, message, username }) => {
      io.to(roomId).emit("chat-message", {
        username,
        message,
        timestamp: Date.now(),
      });
    });

    // Disconnect
    socket.on("disconnect", () => {
      const { roomId, username } = socket.data;
      if (roomId && rooms[roomId]) {
        delete rooms[roomId].members[socket.id];

        // Transfer host if needed
        if (rooms[roomId].host === socket.id) {
          const remaining = Object.keys(rooms[roomId].members);
          if (remaining.length > 0) {
            rooms[roomId].host = remaining[0];
          }
        }

        if (Object.keys(rooms[roomId].members).length === 0) {
          delete rooms[roomId];
        } else {
          io.to(roomId).emit("user-left", {
            userId: socket.id,
            username,
            members: rooms[roomId]?.members || {},
          });
          io.to(roomId).emit("members-update", rooms[roomId]?.members || {});
        }
      }
      console.log("Client disconnected:", socket.id);
    });
  });

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
