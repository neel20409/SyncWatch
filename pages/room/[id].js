import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { io } from "socket.io-client";
import dynamic from "next/dynamic";
import Chat from "../../components/Chat";

const YouTubePlayer = dynamic(() => import("../../components/YouTubePlayer"), { ssr: false });

function extractVideoId(input) {
  if (!input) return "";
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
    /(?:youtu\.be\/)([^?\s]+)/,
    /(?:youtube\.com\/embed\/)([^?\s]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  return "";
}

export default function RoomPage() {
  const router = useRouter();
  const { id: roomId } = router.query;

  const [user, setUser] = useState(null);
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState({});
  const [messages, setMessages] = useState([]);
  const [videoInput, setVideoInput] = useState("");
  const [currentVideoId, setCurrentVideoId] = useState("");
  const [playerReady, setPlayerReady] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [copied, setCopied] = useState(false);

  const playerRef = useRef(null);
  const isSyncingRef = useRef(false);
  const socketRef = useRef(null);
  // Store pending state to apply once player is ready
  const pendingStateRef = useRef(null);

  const addNotification = useCallback((msg) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, msg }]);
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 3500);
  }, []);

  // Apply sync state to player - called when player becomes ready or state arrives
  const applySyncState = useCallback((state) => {
    const player = playerRef.current;
    if (!player || !playerReady) {
      // Player not ready yet - store for later
      pendingStateRef.current = state;
      return;
    }
    if (!state.videoId) return;

    const elapsed = state.isPlaying ? (Date.now() - state.lastUpdate) / 1000 : 0;
    const syncTime = state.currentTime + elapsed;

    isSyncingRef.current = true;
    try {
      player.seekTo(syncTime);
      if (state.isPlaying) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    } catch {}
    setTimeout(() => { isSyncingRef.current = false; }, 800);
  }, [playerReady]);

  // Init socket
  useEffect(() => {
    if (!roomId) return;

    const stored = localStorage.getItem("user");
    if (!stored) {
      router.push(`/login?redirect=/room/${roomId}`);
      return;
    }

    const userData = JSON.parse(stored);
    setUser(userData);

    // FIX: explicit socket URL so it always connects correctly
    const sock = io(window.location.origin, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = sock;

    sock.on("connect", () => {
      setConnected(true);
      sock.emit("join-room", { roomId, username: userData.username });
      console.log("Socket connected:", sock.id);
    });

    sock.on("disconnect", (reason) => {
      setConnected(false);
      console.log("Socket disconnected:", reason);
    });

    sock.on("connect_error", (err) => {
      console.error("Connection error:", err.message);
    });

    // Receive full room state on join
    sock.on("room-state", (state) => {
      console.log("Room state received:", state);
      setMembers(state.members || {});

      if (state.videoId) {
        // FIX: set video first, then sync playback state
        setCurrentVideoId(state.videoId);
        pendingStateRef.current = state; // will apply once player is ready
      }
    });

    sock.on("members-update", (m) => setMembers(m));
    sock.on("user-joined", ({ username }) => addNotification(`${username} joined`));
    sock.on("user-left", ({ username }) => addNotification(`${username} left`));

    // FIX: video-changed now sets the video for ALL users including joiner
    sock.on("video-changed", ({ videoId }) => {
      console.log("Video changed to:", videoId);
      setCurrentVideoId(videoId);
      setPlayerReady(false); // player will re-init with new video
      isSyncingRef.current = false;
      addNotification("Video changed");
    });

    sock.on("video-played", ({ currentTime }) => {
      isSyncingRef.current = true;
      try {
        playerRef.current?.seekTo(currentTime);
        playerRef.current?.playVideo();
      } catch {}
      setTimeout(() => { isSyncingRef.current = false; }, 800);
    });

    sock.on("video-paused", ({ currentTime }) => {
      isSyncingRef.current = true;
      try {
        playerRef.current?.seekTo(currentTime);
        playerRef.current?.pauseVideo();
      } catch {}
      setTimeout(() => { isSyncingRef.current = false; }, 800);
    });

    sock.on("video-seeked", ({ currentTime }) => {
      isSyncingRef.current = true;
      try { playerRef.current?.seekTo(currentTime); } catch {}
      setTimeout(() => { isSyncingRef.current = false; }, 500);
    });

    sock.on("chat-message", (msg) => setMessages((prev) => [...prev, msg]));

    return () => sock.disconnect();
  }, [roomId]);

  // FIX: when player becomes ready, apply any pending sync state
  useEffect(() => {
    if (playerReady && pendingStateRef.current) {
      const state = pendingStateRef.current;
      pendingStateRef.current = null;
      // Small delay to let player fully initialize
      setTimeout(() => applySyncState(state), 500);
    }
  }, [playerReady, applySyncState]);

  const handlePlayerReady = useCallback(() => {
    console.log("Player ready");
    setPlayerReady(true);
    // Also request fresh sync from server
    socketRef.current?.emit("sync-request", { roomId });
  }, [roomId]);

  // Receive sync response (for newly ready player)
  useEffect(() => {
    const sock = socketRef.current;
    if (!sock) return;
    const handler = (state) => {
      if (playerReady) applySyncState(state);
      else pendingStateRef.current = state;
    };
    sock.on("sync-response", handler);
    return () => sock.off("sync-response", handler);
  }, [playerReady, applySyncState]);

  const handlePlayerStateChange = useCallback((event) => {
    if (isSyncingRef.current) return;
    const YT = window.YT;
    if (!YT) return;

    const player = playerRef.current;
    if (!player || typeof player.getCurrentTime !== "function") return;

    let currentTime = 0;
    try { currentTime = player.getCurrentTime() || 0; } catch { return; }

    if (event.data === YT.PlayerState.PLAYING) {
      socketRef.current?.emit("video-play", { roomId, currentTime });
    } else if (event.data === YT.PlayerState.PAUSED) {
      socketRef.current?.emit("video-pause", { roomId, currentTime });
    }
  }, [roomId]);

  const handleVideoSubmit = () => {
    const id = extractVideoId(videoInput);
    if (!id) return;
    setCurrentVideoId(id);
    setPlayerReady(false);
    setVideoInput("");
    socketRef.current?.emit("video-change", { roomId, videoId: id });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    addNotification("Room link copied!");
  };

  const handleSendMessage = (msg) => {
    if (!user) return;
    socketRef.current?.emit("chat-message", { roomId, message: msg, username: user.username });
  };

  const memberList = Object.values(members);

  return (
    <>
      <Head>
        <title>Room {roomId} — SyncWatch</title>
      </Head>
      <div className="bg-[#0D0D0D] min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-[#1E1E1E] shrink-0">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="font-display text-sm tracking-tight">
              <span className="text-[#FF3B3B]">SYNC</span>
              <span className="text-white">WATCH</span>
            </Link>
            <div className="hidden sm:flex items-center gap-2 bg-[#161616] border border-[#262626] rounded-lg px-3 py-1.5">
              <span className="text-gray-500 text-xs font-display">ROOM</span>
              <span className="text-white text-xs font-display font-bold">{roomId}</span>
              <button
                onClick={handleCopyCode}
                className="text-gray-500 hover:text-[#FF3B3B] text-xs transition-colors ml-1"
              >
                {copied ? "✓" : "⎘"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-yellow-500 animate-ping"}`} />
              <span className="text-gray-500 text-xs hidden sm:block">
                {connected ? "Connected" : "Connecting..."}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {memberList.slice(0, 5).map((name, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full bg-[#262626] border border-[#333] flex items-center justify-center text-xs font-bold text-white"
                  title={name}
                >
                  {name[0]?.toUpperCase()}
                </div>
              ))}
              {memberList.length > 5 && (
                <span className="text-gray-500 text-xs">+{memberList.length - 5}</span>
              )}
            </div>

            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 text-xs border border-[#262626] text-gray-400 rounded-lg hover:border-[#FF3B3B] hover:text-white transition-colors"
            >
              Share
            </button>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Video area */}
          <div className="flex-1 flex flex-col min-w-0 p-4 gap-3">
            {/* Video input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVideoSubmit()}
                placeholder="Paste YouTube URL or video ID..."
                className="flex-1 bg-[#161616] border border-[#262626] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF3B3B] transition-colors"
              />
              <button
                onClick={handleVideoSubmit}
                className="px-4 py-2.5 bg-[#FF3B3B] text-white text-sm font-semibold rounded-lg hover:bg-red-500 transition-colors whitespace-nowrap"
              >
                Load Video
              </button>
            </div>

            {/* Player */}
            <div className="flex-1 bg-[#161616] rounded-xl overflow-hidden border border-[#262626] relative min-h-[300px]">
              {currentVideoId ? (
                <YouTubePlayer
                  key={currentVideoId}
                  ref={playerRef}
                  videoId={currentVideoId}
                  onReady={handlePlayerReady}
                  onStateChange={handlePlayerStateChange}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="text-5xl mb-4">🎬</div>
                  <p className="font-display text-sm text-gray-500">PASTE A YOUTUBE URL TO START WATCHING</p>
                  <p className="text-gray-600 text-xs mt-2">Works with any public YouTube video</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-72 border-l border-[#1E1E1E] flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-[#262626]">
              <h3 className="font-display text-xs text-gray-400 mb-2">WATCHING ({memberList.length})</h3>
              <div className="flex flex-wrap gap-1">
                {memberList.map((name, i) => (
                  <span
                    key={i}
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      name === user?.username
                        ? "border-[#FF3B3B]/50 text-[#FF3B3B] bg-[#FF3B3B]/10"
                        : "border-[#262626] text-gray-400"
                    }`}
                  >
                    {name}{name === user?.username ? " (you)" : ""}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <Chat messages={messages} onSend={handleSendMessage} username={user?.username} />
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-none z-50">
        {notifications.map((n) => (
          <div key={n.id} className="bg-[#1A1A1A] border border-[#262626] text-white text-xs px-4 py-2 rounded-full font-display">
            {n.msg}
          </div>
        ))}
      </div>
    </>
  );
}