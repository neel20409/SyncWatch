import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

export default function Watch() {
  const router = useRouter();
  const { room } = router.query;
  const [log, setLog] = useState([]);
  const [status, setStatus] = useState("loading...");
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef(null);
  const socketRef = useRef(null);
  const readyRef = useRef(false);
  const VIDEO_ID = "-tkpg5m0mk0"; // hardcoded for test
  const ROOM_ID = room || "TESTROOM";

  const addLog = (msg) => {
    console.log("[WATCH]", msg);
    setLog(p => [new Date().toLocaleTimeString() + " " + msg, ...p.slice(0,15)]);
  };

  // Init YouTube player
  useEffect(() => {
    const init = () => {
      addLog("Creating YT.Player...");
      playerRef.current = new window.YT.Player("yt-div", {
        videoId: VIDEO_ID,
        width: "100%", height: "100%",
        playerVars: { controls: 1, playsinline: 1, enablejsapi: 1, origin: window.location.origin },
        events: {
          onReady: () => { readyRef.current = true; addLog("✅ Player READY"); },
          onStateChange: (e) => addLog("YT state: " + e.data),
          onError: (e) => addLog("❌ YT error: " + e.data),
        }
      });
    };

    if (window.YT?.Player) { init(); }
    else {
      window.onYouTubeIframeAPIReady = init;
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  }, []);

  // Init socket
  useEffect(() => {
    if (!room) return;
    import("socket.io-client").then(({ io }) => {
      const sock = io({ path: "/socket.io", transports: ["polling", "websocket"] });
      socketRef.current = sock;

      sock.on("connect", () => { setStatus("✅ Connected: " + sock.id); addLog("Socket connected: " + sock.id); sock.emit("join-room", { roomId: ROOM_ID, username: "user_" + sock.id.slice(0,4) }); });
      sock.on("disconnect", () => setStatus("❌ Disconnected"));
      sock.on("members-update", (m) => addLog("Members: " + JSON.stringify(Object.values(m))));

      sock.on("video-played", ({ currentTime: t }) => {
        addLog("← RECEIVED play @ " + t + " | ready=" + readyRef.current);
        if (readyRef.current && playerRef.current) {
          playerRef.current.seekTo(t, true);
          playerRef.current.playVideo();
          setIsPlaying(true);
          addLog("→ called playVideo()");
        } else {
          addLog("⚠️ player not ready, can't play");
        }
      });

      sock.on("video-paused", ({ currentTime: t }) => {
        addLog("← RECEIVED pause @ " + t + " | ready=" + readyRef.current);
        if (readyRef.current && playerRef.current) {
          playerRef.current.seekTo(t, true);
          playerRef.current.pauseVideo();
          setIsPlaying(false);
          addLog("→ called pauseVideo()");
        } else {
          addLog("⚠️ player not ready, can't pause");
        }
      });
    });
    return () => { socketRef.current?.disconnect(); };
  }, [room]);

  const localPlay = () => {
    if (!readyRef.current) { addLog("❌ player not ready"); return; }
    const t = playerRef.current.getCurrentTime();
    playerRef.current.playVideo();
    setIsPlaying(true);
    socketRef.current?.emit("video-play", { roomId: ROOM_ID, currentTime: t });
    addLog("→ emitted play @ " + t);
  };

  const localPause = () => {
    if (!readyRef.current) { addLog("❌ player not ready"); return; }
    const t = playerRef.current.getCurrentTime();
    playerRef.current.pauseVideo();
    setIsPlaying(false);
    socketRef.current?.emit("video-pause", { roomId: ROOM_ID, currentTime: t });
    addLog("→ emitted pause @ " + t);
  };

  return (
    <div style={{ background: "#111", color: "#fff", minHeight: "100vh", padding: 16, fontFamily: "monospace" }}>
      <h2 style={{ color: "#FF3B3B", marginTop: 0 }}>SyncWatch — Direct Test</h2>
      <p style={{ color: "#888", fontSize: 12, margin: "4px 0 12px" }}>Room: <strong style={{color:"#fff"}}>{ROOM_ID}</strong> | Socket: <strong style={{color: status.includes("✅") ? "lime" : "red"}}>{status}</strong></p>

      {/* Player */}
      <div id="yt-div" style={{ width: "100%", aspectRatio: "16/9", background: "#000", marginBottom: 12 }} />

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <button onClick={localPlay} style={{ flex: 1, padding: "14px", background: "#22c55e", color: "#fff", border: "none", borderRadius: 8, fontSize: 18, cursor: "pointer", fontWeight: "bold" }}>
          ▶ PLAY
        </button>
        <button onClick={localPause} style={{ flex: 1, padding: "14px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, fontSize: 18, cursor: "pointer", fontWeight: "bold" }}>
          ⏸ PAUSE
        </button>
      </div>

      {/* Log */}
      <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 12, height: 200, overflowY: "auto" }}>
        {log.map((l, i) => (
          <div key={i} style={{ fontSize: 11, padding: "2px 0", borderBottom: "1px solid #222", color: l.includes("RECEIVED") ? "#4ade80" : l.includes("❌") || l.includes("⚠️") ? "#f87171" : l.includes("✅") ? "#4ade80" : "#ddd" }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
