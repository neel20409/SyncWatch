import { useState, useEffect, useRef } from "react";

export default function SyncTest() {
  const [log, setLog] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const roomId = "TEST123";

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setLog(p => [`[${time}] ${msg}`, ...p.slice(0, 20)]);
  };

  useEffect(() => {
    import("socket.io-client").then(({ io }) => {
      const sock = io({ path: "/socket.io", transports: ["polling", "websocket"] });
      socketRef.current = sock;

      sock.on("connect", () => {
        setConnected(true);
        addLog(`✅ Connected as ${sock.id}`);
        sock.emit("join-room", { roomId, username: "tester_" + sock.id.slice(0,4) });
      });

      sock.on("room-state", (s) => addLog(`📦 room-state: members=${JSON.stringify(Object.values(s.members))}`));
      sock.on("members-update", (m) => addLog(`👥 members: ${JSON.stringify(Object.values(m))}`));
      sock.on("video-played", ({ currentTime }) => addLog(`▶️ video-played @ ${currentTime} ← RECEIVED`));
      sock.on("video-paused", ({ currentTime }) => addLog(`⏸️ video-paused @ ${currentTime} ← RECEIVED`));
      sock.on("video-changed", ({ videoId }) => addLog(`🎬 video-changed: ${videoId} ← RECEIVED`));
      sock.on("disconnect", () => { setConnected(false); addLog("❌ Disconnected"); });
    });
    return () => socketRef.current?.disconnect();
  }, []);

  const emitPlay = () => {
    addLog("→ emitting video-play");
    socketRef.current?.emit("video-play", { roomId, currentTime: 42 });
  };

  const emitPause = () => {
    addLog("→ emitting video-pause");
    socketRef.current?.emit("video-pause", { roomId, currentTime: 42 });
  };

  return (
    <div style={{ background: "#111", color: "#eee", minHeight: "100vh", padding: 24, fontFamily: "monospace" }}>
      <h1 style={{ color: "#FF3B3B" }}>Socket Sync Test</h1>
      <p>Status: <strong style={{ color: connected ? "lime" : "red" }}>{connected ? "Connected" : "Disconnected"}</strong></p>
      <p style={{ color: "#888", fontSize: 12 }}>Open this page on BOTH devices. Click buttons and watch logs on the OTHER device.</p>

      <div style={{ display: "flex", gap: 12, margin: "20px 0" }}>
        <button onClick={emitPlay} style={{ background: "#22c55e", color: "#fff", border: "none", padding: "12px 24px", borderRadius: 8, fontSize: 16, cursor: "pointer" }}>
          ▶ Emit PLAY
        </button>
        <button onClick={emitPause} style={{ background: "#FF3B3B", color: "#fff", border: "none", padding: "12px 24px", borderRadius: 8, fontSize: 16, cursor: "pointer" }}>
          ⏸ Emit PAUSE
        </button>
      </div>

      <div style={{ background: "#1a1a1a", padding: 16, borderRadius: 8, maxHeight: 400, overflow: "auto" }}>
        {log.length === 0 && <p style={{ color: "#555" }}>Waiting for events...</p>}
        {log.map((l, i) => (
          <div key={i} style={{ 
            padding: "4px 0", 
            borderBottom: "1px solid #222",
            color: l.includes("RECEIVED") ? "#22c55e" : l.includes("emitting") ? "#facc15" : "#eee"
          }}>{l}</div>
        ))}
      </div>
    </div>
  );
}
