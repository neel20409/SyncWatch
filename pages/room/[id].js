import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
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
  const [socketStatus, setSocketStatus] = useState("Initializing...");
  const [members, setMembers] = useState({});
  const [messages, setMessages] = useState([]);
  const [videoInput, setVideoInput] = useState("");
  const [currentVideoId, setCurrentVideoId] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [copied, setCopied] = useState(false);
  const [mobileTab, setMobileTab] = useState("chat");
  const [panelOpen, setPanelOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const playerRef = useRef(null);
  const socketRef = useRef(null);
  const pendingStateRef = useRef(null);
  const playerReadyRef = useRef(false);

  // This is the KEY fix: use a timestamp instead of a boolean
  // Any event received sets this to Date.now()
  // We ignore outgoing events for 1 second after receiving one
  const lastRemoteEventRef = useRef(0);

  const isRemoteControlled = () => Date.now() - lastRemoteEventRef.current < 1000;

  const addNotification = useCallback((msg) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, msg }]);
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 3500);
  }, []);

  const applySyncState = useCallback((state) => {
    if (!playerReadyRef.current || !playerRef.current) {
      pendingStateRef.current = state;
      return;
    }
    if (!state.videoId) return;

    lastRemoteEventRef.current = Date.now();

    const elapsed = state.isPlaying ? (Date.now() - state.lastUpdate) / 1000 : 0;
    const syncTime = Math.max(0, state.currentTime + elapsed);

    try {
      playerRef.current.seekTo(syncTime);
      if (state.isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    } catch (e) {
      console.warn("applySyncState error:", e);
    }
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const stored = localStorage.getItem("user");
    if (!stored) { router.push(`/login?redirect=/room/${roomId}`); return; }
    const userData = JSON.parse(stored);
    setUser(userData);

    import("socket.io-client").then(({ io }) => {
      setSocketStatus("Connecting...");
      const sock = io({
        path: "/socket.io",
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 10000,
      });
      socketRef.current = sock;

      sock.on("connect", () => {
        setConnected(true);
        setSocketStatus("Connected");
        console.log("✅ Socket connected:", sock.id);
        sock.emit("join-room", { roomId, username: userData.username });
      });

      sock.on("disconnect", () => { setConnected(false); setSocketStatus("Disconnected"); });
      sock.on("connect_error", (err) => setSocketStatus(`Error: ${err.message}`));
      sock.on("reconnect_attempt", (n) => setSocketStatus(`Reconnecting... (${n})`));

      sock.on("room-state", (state) => {
        console.log("📦 room-state received:", state);
        setMembers(state.members || {});
        if (state.videoId) {
          setCurrentVideoId(state.videoId);
          pendingStateRef.current = state;
        }
      });

      sock.on("members-update", (m) => setMembers(m));
      sock.on("user-joined", ({ username }) => addNotification(`${username} joined`));
      sock.on("user-left", ({ username }) => addNotification(`${username} left`));

      sock.on("video-changed", ({ videoId }) => {
        console.log("🎬 video-changed:", videoId);
        lastRemoteEventRef.current = Date.now();
        setCurrentVideoId(videoId);
        playerReadyRef.current = false;
        addNotification("Video changed");
      });

      // *** THE MAIN SYNC EVENTS ***
      sock.on("video-played", ({ currentTime }) => {
        console.log("▶️ video-played received, currentTime:", currentTime);
        lastRemoteEventRef.current = Date.now();
        try {
          playerRef.current?.seekTo(currentTime);
          playerRef.current?.playVideo();
        } catch (e) { console.warn(e); }
      });

      sock.on("video-paused", ({ currentTime }) => {
        console.log("⏸️ video-paused received, currentTime:", currentTime);
        lastRemoteEventRef.current = Date.now();
        try {
          playerRef.current?.seekTo(currentTime);
          playerRef.current?.pauseVideo();
        } catch (e) { console.warn(e); }
      });

      sock.on("video-seeked", ({ currentTime }) => {
        console.log("⏩ video-seeked received:", currentTime);
        lastRemoteEventRef.current = Date.now();
        try { playerRef.current?.seekTo(currentTime); } catch (e) { console.warn(e); }
      });

      sock.on("sync-response", (state) => {
        console.log("🔄 sync-response:", state);
        applySyncState(state);
      });

      sock.on("chat-message", (msg) => {
        setMessages((prev) => [...prev, msg]);
        setPanelOpen((open) => {
          if (!open) setUnread((u) => u + 1);
          return open;
        });
      });
    });

    return () => {
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    };
  }, [roomId]);

  // Apply pending state once player is ready
  useEffect(() => {
    if (playerReadyRef.current && pendingStateRef.current) {
      const state = pendingStateRef.current;
      pendingStateRef.current = null;
      setTimeout(() => applySyncState(state), 500);
    }
  });

  const handlePlayerReady = useCallback(() => {
    console.log("✅ Player ready");
    playerReadyRef.current = true;
    // Request current state from server
    socketRef.current?.emit("sync-request", { roomId });
    // Also apply any pending state
    if (pendingStateRef.current) {
      const state = pendingStateRef.current;
      pendingStateRef.current = null;
      setTimeout(() => applySyncState(state), 500);
    }
  }, [roomId, applySyncState]);

  const handlePlayerStateChange = useCallback((event) => {
    // If we just received a remote event, don't echo it back
    if (isRemoteControlled()) {
      console.log("🔇 Ignoring local state change — remote controlled");
      return;
    }

    const YT = window.YT;
    if (!YT) return;
    const player = playerRef.current;
    if (!player || typeof player.getCurrentTime !== "function") return;

    let currentTime = 0;
    try { currentTime = player.getCurrentTime() || 0; } catch { return; }

    console.log("🎮 Local state change:", event.data, "at", currentTime);

    if (event.data === YT.PlayerState.PLAYING) {
      socketRef.current?.emit("video-play", { roomId, currentTime });
    } else if (event.data === YT.PlayerState.PAUSED) {
      socketRef.current?.emit("video-pause", { roomId, currentTime });
    }
  }, [roomId]);

  const handleVideoSubmit = () => {
    const id = extractVideoId(videoInput);
    if (!id) { addNotification("Invalid YouTube URL"); return; }
    setCurrentVideoId(id);
    playerReadyRef.current = false;
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

  const openPanel = (tab) => {
    setMobileTab(tab);
    setPanelOpen(true);
    if (tab === "chat") setUnread(0);
  };

  const memberList = Object.values(members);

  return (
    <>
      <Head><title>Room {roomId} — SyncWatch</title></Head>
      <div className="bg-[#0D0D0D] h-screen flex flex-col overflow-hidden">

        {/* HEADER */}
        <header className="flex items-center justify-between px-3 py-2 border-b border-[#1E1E1E] shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/dashboard" className="font-display text-sm tracking-tight">
              <span className="text-[#FF3B3B]">SYNC</span><span className="text-white">WATCH</span>
            </Link>
            <div className="flex items-center gap-1.5 bg-[#161616] border border-[#262626] rounded-lg px-2 py-1">
              <span className="text-gray-500 text-xs font-display hidden sm:block">ROOM</span>
              <span className="text-white text-xs font-display font-bold">{roomId}</span>
              <button onClick={handleCopyCode} className="text-gray-500 hover:text-[#FF3B3B] text-xs transition-colors">
                {copied ? "✓" : "⎘"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#161616] border border-[#262626] rounded-lg px-2 py-1">
              <div className={`w-2 h-2 rounded-full shrink-0 ${connected ? "bg-green-500 animate-pulse" : "bg-yellow-400 animate-ping"}`} />
              <span className="text-xs text-gray-400 hidden md:block max-w-[120px] truncate">{socketStatus}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1">
              {memberList.slice(0, 4).map((name, i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-[#262626] border border-[#333] flex items-center justify-center text-xs font-bold text-white" title={name}>
                  {name[0]?.toUpperCase()}
                </div>
              ))}
            </div>
            <button onClick={handleCopyLink} className="px-2 sm:px-3 py-1.5 text-xs border border-[#262626] text-gray-400 rounded-lg hover:border-[#FF3B3B] hover:text-white transition-colors">
              Share
            </button>
          </div>
        </header>

        {/* BODY */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Video column */}
          <div className="flex-1 flex flex-col min-w-0 p-2 sm:p-4 gap-2 sm:gap-3 overflow-hidden">
            <div className="flex gap-2 shrink-0">
              <input
                type="text"
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVideoSubmit()}
                placeholder="Paste YouTube URL..."
                className="flex-1 bg-[#161616] border border-[#262626] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#FF3B3B] transition-colors min-w-0"
              />
              <button onClick={handleVideoSubmit} className="px-3 sm:px-4 py-2 bg-[#FF3B3B] text-white text-sm font-semibold rounded-lg hover:bg-red-500 transition-colors shrink-0">
                Load
              </button>
            </div>

            <div className="w-full bg-[#161616] rounded-xl overflow-hidden border border-[#262626] relative shrink-0 md:flex-1 md:shrink" style={{ aspectRatio: "16/9" }}>
              {currentVideoId ? (
                <YouTubePlayer
                  key={currentVideoId}
                  ref={playerRef}
                  videoId={currentVideoId}
                  onReady={handlePlayerReady}
                  onStateChange={handlePlayerStateChange}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 sm:p-8">
                  <div className="text-4xl sm:text-5xl mb-3">🎬</div>
                  <p className="font-display text-xs sm:text-sm text-gray-500">PASTE A YOUTUBE URL ABOVE</p>
                  <p className="text-gray-600 text-xs mt-1 hidden sm:block">Both users will see it load automatically</p>
                </div>
              )}
            </div>
          </div>

          {/* Desktop sidebar */}
          <div className="hidden lg:flex w-72 xl:w-80 border-l border-[#1E1E1E] flex-col shrink-0">
            <div className="px-4 py-3 border-b border-[#262626] shrink-0">
              <h3 className="font-display text-xs text-gray-400 mb-2">WATCHING ({memberList.length})</h3>
              <div className="flex flex-wrap gap-1">
                {memberList.map((name, i) => (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${name === user?.username ? "border-[#FF3B3B]/50 text-[#FF3B3B] bg-[#FF3B3B]/10" : "border-[#262626] text-gray-400"}`}>
                    {name}{name === user?.username ? " (you)" : ""}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <Chat messages={messages} onSend={handleSendMessage} username={user?.username} />
            </div>
          </div>

          {/* Tablet sidebar */}
          <div className="hidden md:flex lg:hidden w-64 border-l border-[#1E1E1E] flex-col shrink-0">
            <div className="px-3 py-2 border-b border-[#262626] shrink-0">
              <h3 className="font-display text-xs text-gray-400 mb-1.5">WATCHING ({memberList.length})</h3>
              <div className="flex flex-wrap gap-1">
                {memberList.map((name, i) => (
                  <div key={i} className="w-6 h-6 rounded-full bg-[#262626] flex items-center justify-center text-xs font-bold text-white" title={name}>
                    {name[0]?.toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <Chat messages={messages} onSend={handleSendMessage} username={user?.username} />
            </div>
          </div>
        </div>

        {/* Mobile bottom bar */}
        <div className="md:hidden shrink-0 border-t border-[#1E1E1E] bg-[#111] flex items-center justify-around px-2 py-1.5 z-30">
          <button onClick={() => openPanel("members")} className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-colors ${mobileTab === "members" && panelOpen ? "text-[#FF3B3B]" : "text-gray-500"}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs">{memberList.length}</span>
          </button>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-yellow-400 animate-ping"}`} />
            <span className="text-xs text-gray-500">{connected ? "Live" : "..."}</span>
          </div>
          <button onClick={() => openPanel("chat")} className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-colors relative ${mobileTab === "chat" && panelOpen ? "text-[#FF3B3B]" : "text-gray-500"}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-xs">Chat</span>
            {unread > 0 && !panelOpen && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#FF3B3B] rounded-full text-white text-xs flex items-center justify-center font-bold">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </div>

        {/* Mobile bottom sheet */}
        {panelOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/60" onClick={() => setPanelOpen(false)} />
            <div className="relative bg-[#161616] border-t border-[#262626] rounded-t-2xl flex flex-col z-50" style={{ height: "60vh" }}>
              <div className="shrink-0 pt-3 pb-0 px-4">
                <div className="w-10 h-1 bg-[#333] rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <button onClick={() => { setMobileTab("chat"); setUnread(0); }} className={`px-4 py-1.5 rounded-lg text-xs font-display transition-colors ${mobileTab === "chat" ? "bg-[#FF3B3B] text-white" : "text-gray-400"}`}>CHAT</button>
                    <button onClick={() => setMobileTab("members")} className={`px-4 py-1.5 rounded-lg text-xs font-display transition-colors ${mobileTab === "members" ? "bg-[#FF3B3B] text-white" : "text-gray-400"}`}>MEMBERS ({memberList.length})</button>
                  </div>
                  <button onClick={() => setPanelOpen(false)} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                {mobileTab === "chat" ? (
                  <Chat messages={messages} onSend={handleSendMessage} username={user?.username} />
                ) : (
                  <div className="p-4 overflow-y-auto h-full">
                    {memberList.map((name, i) => (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border mb-2 ${name === user?.username ? "border-[#FF3B3B]/30 bg-[#FF3B3B]/5" : "border-[#262626] bg-[#111]"}`}>
                        <div className="w-8 h-8 rounded-full bg-[#262626] flex items-center justify-center text-sm font-bold text-white shrink-0">
                          {name[0]?.toUpperCase()}
                        </div>
                        <span className={`text-sm ${name === user?.username ? "text-[#FF3B3B]" : "text-gray-300"}`}>
                          {name}{name === user?.username ? " (you)" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-none z-50 w-full max-w-xs px-4">
        {notifications.map((n) => (
          <div key={n.id} className="bg-[#1A1A1A] border border-[#262626] text-white text-xs px-4 py-2 rounded-full font-display text-center">
            {n.msg}
          </div>
        ))}
      </div>
    </>
  );
}
