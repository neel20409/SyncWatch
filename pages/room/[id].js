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
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState({});
  const [messages, setMessages] = useState([]);
  const [videoInput, setVideoInput] = useState("");
  const [currentVideoId, setCurrentVideoId] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isHost, setIsHost] = useState(false);

  const playerRef = useRef(null);
  const isSyncingRef = useRef(false);
  const socketRef = useRef(null);

  const addNotification = useCallback((msg) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, msg }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3500);
  }, []);

  // Init user & socket
  useEffect(() => {
    if (!roomId) return;

    const stored = localStorage.getItem("user");
    if (!stored) {
      router.push(`/login?redirect=/room/${roomId}`);
      return;
    }

    const userData = JSON.parse(stored);
    setUser(userData);

    const sock = io("/", { transports: ["websocket", "polling"] });
    socketRef.current = sock;
    setSocket(sock);

    sock.on("connect", () => {
      setConnected(true);
      sock.emit("join-room", { roomId, username: userData.username });
    });

    sock.on("disconnect", () => setConnected(false));

    sock.on("room-state", (state) => {
      setCurrentVideoId(state.videoId || "");
      setMembers(state.members || {});
      setIsHost(state.host === sock.id);
      // Sync video state
      if (state.videoId && playerRef.current) {
        setTimeout(() => {
          if (state.videoId) {
            const elapsed = (Date.now() - state.lastUpdate) / 1000;
            const syncTime = state.isPlaying
              ? state.currentTime + elapsed
              : state.currentTime;
            isSyncingRef.current = true;
            playerRef.current.seekTo(syncTime);
            if (state.isPlaying) {
              playerRef.current.playVideo();
            }
            setTimeout(() => { isSyncingRef.current = false; }, 500);
          }
        }, 1000);
      }
    });

    sock.on("members-update", (m) => setMembers(m));

    sock.on("user-joined", ({ username }) => {
      addNotification(`${username} joined`);
    });

    sock.on("user-left", ({ username }) => {
      addNotification(`${username} left`);
    });

    sock.on("video-changed", ({ videoId }) => {
      setCurrentVideoId(videoId);
      isSyncingRef.current = true;
      setTimeout(() => { isSyncingRef.current = false; }, 1000);
      addNotification("Video changed");
    });

    sock.on("video-played", ({ currentTime }) => {
      isSyncingRef.current = true;
      playerRef.current?.seekTo(currentTime);
      playerRef.current?.playVideo();
      setTimeout(() => { isSyncingRef.current = false; }, 500);
    });

    sock.on("video-paused", ({ currentTime }) => {
      isSyncingRef.current = true;
      playerRef.current?.seekTo(currentTime);
      playerRef.current?.pauseVideo();
      setTimeout(() => { isSyncingRef.current = false; }, 500);
    });

    sock.on("video-seeked", ({ currentTime }) => {
      isSyncingRef.current = true;
      playerRef.current?.seekTo(currentTime);
      setTimeout(() => { isSyncingRef.current = false; }, 500);
    });

    sock.on("chat-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      sock.disconnect();
    };
  }, [roomId]);

  const handleVideoSubmit = () => {
    const id = extractVideoId(videoInput);
    if (!id) return;
    setCurrentVideoId(id);
    setVideoInput("");
    socketRef.current?.emit("video-change", { roomId, videoId: id });
  };

  const handlePlayerReady = () => {
    socketRef.current?.emit("sync-request", { roomId });
  };

 // NEW - safely guards against unready player
const handlePlayerStateChange = (event) => {
  if (isSyncingRef.current) return;
  const YT = window.YT;
  if (!YT) return;

  const player = playerRef.current;
  if (!player || typeof player.getCurrentTime !== "function") return;

  let currentTime = 0;
  try {
    currentTime = player.getCurrentTime() || 0;
  } catch {
    return;
  }

  if (event.data === YT.PlayerState.PLAYING) {
    socketRef.current?.emit("video-play", { roomId, currentTime });
  } else if (event.data === YT.PlayerState.PAUSED) {
    socketRef.current?.emit("video-pause", { roomId, currentTime });
  }
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
    socketRef.current?.emit("chat-message", {
      roomId,
      message: msg,
      username: user.username,
    });
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
            {/* Connection status */}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"} ${
                  connected ? "animate-pulse" : ""
                }`}
              />
              <span className="text-gray-500 text-xs hidden sm:block">
                {connected ? "Connected" : "Reconnecting..."}
              </span>
            </div>

            {/* Members */}
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
                  ref={playerRef}
                  videoId={currentVideoId}
                  onReady={handlePlayerReady}
                  onStateChange={handlePlayerStateChange}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="text-5xl mb-4">🎬</div>
                  <p className="font-display text-sm text-gray-500">
                    PASTE A YOUTUBE URL TO START WATCHING
                  </p>
                  <p className="text-gray-600 text-xs mt-2">
                    Works with any public YouTube video
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: Chat */}
          <div className="w-72 border-l border-[#1E1E1E] flex flex-col shrink-0">
            {/* Members */}
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
                    {name}
                    {name === user?.username ? " (you)" : ""}
                  </span>
                ))}
              </div>
            </div>

            {/* Chat */}
            <div className="flex-1 min-h-0">
              <Chat
                messages={messages}
                onSend={handleSendMessage}
                username={user?.username}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-none z-50">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="bg-[#1A1A1A] border border-[#262626] text-white text-xs px-4 py-2 rounded-full font-display animate-bounce"
          >
            {n.msg}
          </div>
        ))}
      </div>
    </>
  );
}
