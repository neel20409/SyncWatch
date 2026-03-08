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
  for (const p of patterns) { const m = input.match(p); if (m) return m[1]; }
  return "";
}

function fmt(s) {
  if (!s || isNaN(s)) return "0:00";
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
}

// Apply play/pause/seek directly to player
function applyToPlayer(playerRef, action, time) {
  const p = playerRef.current;
  if (!p) { console.warn("[APPLY] no player"); return; }
  console.log(`[APPLY] ${action} @ ${time}`);
  try { p.seekTo(time); } catch(e) { console.warn("[APPLY] seekTo failed", e); }
  if (action === "play") {
    try { p.play(); } catch(e) { console.warn("[APPLY] play failed", e); }
  } else if (action === "pause") {
    try { p.pause(); } catch(e) { console.warn("[APPLY] pause failed", e); }
  }
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  // Visual flash when sync event received
  const [syncFlash, setSyncFlash] = useState(null);

  const playerRef = useRef(null);
  const socketRef = useRef(null);
  const playerReadyRef = useRef(false);
  // Queue of actions to apply once player is ready
  const pendingActionRef = useRef(null);

  const addNotification = useCallback((msg) => {
    const id = Date.now();
    setNotifications(p => [...p, { id, msg }]);
    setTimeout(() => setNotifications(p => p.filter(n => n.id !== id)), 3500);
  }, []);

  const flash = (msg) => {
    setSyncFlash(msg);
    setTimeout(() => setSyncFlash(null), 2000);
  };

  // Poll player state
  useEffect(() => {
    const t = setInterval(() => {
      if (!playerReadyRef.current || !playerRef.current) return;
      try {
        const ct = playerRef.current.getCurrentTime() || 0;
        const d = playerRef.current.getDuration() || 0;
        setCurrentTime(ct);
        if (d > 0) { setDuration(d); setProgress((ct/d)*100); }
      } catch {}
    }, 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const stored = localStorage.getItem("user");
    if (!stored) { router.push(`/login?redirect=/room/${roomId}`); return; }
    const userData = JSON.parse(stored);
    setUser(userData);

    import("socket.io-client").then(({ io }) => {
      setSocketStatus("Connecting...");
      const sock = io({ path: "/socket.io", transports: ["polling", "websocket"], reconnection: true });
      socketRef.current = sock;

      sock.on("connect", () => {
        setConnected(true);
        setSocketStatus("Connected ✓");
        sock.emit("join-room", { roomId, username: userData.username });
      });
      sock.on("disconnect", () => { setConnected(false); setSocketStatus("Disconnected"); });
      sock.on("connect_error", e => setSocketStatus(`Error: ${e.message}`));
      sock.on("room-state", state => {
        setMembers(state.members || {});
        if (state.videoId) setCurrentVideoId(state.videoId);
      });
      sock.on("members-update", m => setMembers(m));
      sock.on("user-joined", ({ username }) => addNotification(`${username} joined`));
      sock.on("user-left", ({ username }) => addNotification(`${username} left`));

      sock.on("video-changed", ({ videoId }) => {
        console.log("[ROOM] video-changed →", videoId);
        playerReadyRef.current = false;
        pendingActionRef.current = null;
        setIsPlaying(false); setCurrentTime(0); setProgress(0);
        setCurrentVideoId(videoId);
        addNotification("Video loaded");
      });

      sock.on("video-played", ({ currentTime: t }) => {
        console.log("[ROOM] ← video-played @", t, "| ready=", playerReadyRef.current, "| player=", !!playerRef.current);
        flash("▶ PLAY received");
        setIsPlaying(true);
        setCurrentTime(t);
        if (playerReadyRef.current && playerRef.current) {
          applyToPlayer(playerRef, "play", t);
        } else {
          console.warn("[ROOM] player not ready — queueing play");
          pendingActionRef.current = { action: "play", time: t };
        }
      });

      sock.on("video-paused", ({ currentTime: t }) => {
        console.log("[ROOM] ← video-paused @", t, "| ready=", playerReadyRef.current, "| player=", !!playerRef.current);
        flash("⏸ PAUSE received");
        setIsPlaying(false);
        setCurrentTime(t);
        if (playerReadyRef.current && playerRef.current) {
          applyToPlayer(playerRef, "pause", t);
        } else {
          console.warn("[ROOM] player not ready — queueing pause");
          pendingActionRef.current = { action: "pause", time: t };
        }
      });

      sock.on("video-seeked", ({ currentTime: t }) => {
        setCurrentTime(t);
        if (playerReadyRef.current && playerRef.current) {
          try { playerRef.current.seekTo(t); } catch {}
        }
      });

      sock.on("sync-response", state => {
        if (!state.videoId) return;
        const elapsed = state.isPlaying ? (Date.now() - state.lastUpdate) / 1000 : 0;
        const t = Math.max(0, state.currentTime + elapsed);
        setIsPlaying(state.isPlaying);
        setCurrentTime(t);
        if (playerReadyRef.current && playerRef.current) {
          applyToPlayer(playerRef, state.isPlaying ? "play" : "pause", t);
        }
      });

      sock.on("chat-message", msg => {
        setMessages(prev => [...prev, msg]);
        setPanelOpen(open => { if (!open) setUnread(u => u+1); return open; });
      });
    });

    return () => { socketRef.current?.disconnect(); socketRef.current = null; };
  }, [roomId]);

  const handlePlayerReady = useCallback(() => {
    console.log("[ROOM] ✅ player onReady — applying pending action:", pendingActionRef.current);
    playerReadyRef.current = true;

    // Apply any queued action
    if (pendingActionRef.current) {
      const { action, time } = pendingActionRef.current;
      pendingActionRef.current = null;
      setTimeout(() => applyToPlayer(playerRef, action, time), 300);
    } else {
      socketRef.current?.emit("sync-request", { roomId });
    }
  }, [roomId]);

  const handlePlay = () => {
    if (!playerRef.current) return;
    const t = playerRef.current.getCurrentTime() || 0;
    console.log("[ROOM] LOCAL play →", t);
    applyToPlayer(playerRef, "play", t);
    setIsPlaying(true);
    socketRef.current?.emit("video-play", { roomId, currentTime: t });
  };

  const handlePause = () => {
    if (!playerRef.current) return;
    const t = playerRef.current.getCurrentTime() || 0;
    console.log("[ROOM] LOCAL pause →", t);
    applyToPlayer(playerRef, "pause", t);
    setIsPlaying(false);
    socketRef.current?.emit("video-pause", { roomId, currentTime: t });
  };

  const handleSeekBar = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * (duration || 0);
    setProgress(pct * 100); setCurrentTime(t);
    try { playerRef.current?.seekTo(t); } catch {}
    socketRef.current?.emit("video-seek", { roomId, currentTime: t });
  };

  const handleVideoSubmit = () => {
    const id = extractVideoId(videoInput);
    if (!id) { addNotification("Invalid YouTube URL"); return; }
    playerReadyRef.current = false; pendingActionRef.current = null;
    setVideoInput(""); setIsPlaying(false); setCurrentTime(0); setProgress(0);
    socketRef.current?.emit("video-change", { roomId, videoId: id });
  };

  const memberList = Object.values(members);

  return (
    <>
      <Head><title>Room {roomId} — SyncWatch</title></Head>
      <div className="bg-[#0D0D0D] h-screen flex flex-col overflow-hidden">

        <header className="flex items-center justify-between px-3 py-2 border-b border-[#1E1E1E] shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/dashboard" className="font-display text-sm tracking-tight">
              <span className="text-[#FF3B3B]">SYNC</span><span className="text-white">WATCH</span>
            </Link>
            <div className="flex items-center gap-1.5 bg-[#161616] border border-[#262626] rounded-lg px-2 py-1">
              <span className="text-gray-500 text-xs font-display hidden sm:block">ROOM</span>
              <span className="text-white text-xs font-display font-bold">{roomId}</span>
              <button onClick={() => { navigator.clipboard.writeText(roomId); setCopied(true); setTimeout(()=>setCopied(false),2000); }} className="text-gray-500 hover:text-[#FF3B3B] text-xs ml-1">
                {copied ? "✓" : "⎘"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#161616] border border-[#262626] rounded-lg px-2 py-1">
              <div className={`w-2 h-2 rounded-full shrink-0 ${connected ? "bg-green-500 animate-pulse" : "bg-yellow-400"}`} />
              <span className="text-xs text-gray-400 hidden md:block max-w-[140px] truncate">{socketStatus}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1">
              {memberList.slice(0,4).map((name,i) => (
                <div key={i} title={name} className="w-7 h-7 rounded-full bg-[#262626] border border-[#333] flex items-center justify-center text-xs font-bold text-white">
                  {name[0]?.toUpperCase()}
                </div>
              ))}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); addNotification("Link copied!"); }} className="px-2 sm:px-3 py-1.5 text-xs border border-[#262626] text-gray-400 rounded-lg hover:border-[#FF3B3B] hover:text-white transition-colors">
              Share
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col min-w-0 p-2 sm:p-4 gap-2 sm:gap-3 overflow-hidden">
            <div className="flex gap-2 shrink-0">
              <input type="text" value={videoInput} onChange={e=>setVideoInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleVideoSubmit()} placeholder="Paste YouTube URL..." className="flex-1 bg-[#161616] border border-[#262626] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#FF3B3B] transition-colors min-w-0" />
              <button onClick={handleVideoSubmit} className="px-3 sm:px-4 py-2 bg-[#FF3B3B] text-white text-sm font-semibold rounded-lg hover:bg-red-500 transition-colors shrink-0">Load</button>
            </div>

            <div className="w-full bg-black rounded-xl overflow-hidden border border-[#262626] relative shrink-0 md:flex-1 md:shrink" style={{aspectRatio:"16/9"}}>
              {currentVideoId ? (
                <>
                  <YouTubePlayer key={currentVideoId} ref={playerRef} videoId={currentVideoId} onReady={handlePlayerReady} />

                  {/* Sync flash indicator */}
                  {syncFlash && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-full z-20 shadow-lg">
                      {syncFlash}
                    </div>
                  )}

                  {/* Custom controls */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent px-3 pb-3 pt-10">
                    <div className="w-full h-2 bg-white/20 rounded-full cursor-pointer mb-3 group" onClick={handleSeekBar}>
                      <div className="h-full bg-[#FF3B3B] rounded-full relative" style={{width:`${progress}%`}}>
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isPlaying ? (
                        <button onClick={handlePause} className="text-white hover:text-[#FF3B3B] transition-colors">
                          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        </button>
                      ) : (
                        <button onClick={handlePlay} className="text-white hover:text-[#FF3B3B] transition-colors">
                          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                      )}
                      <span className="text-white/80 text-xs font-display tabular-nums select-none">{fmt(currentTime)} / {fmt(duration)}</span>
                      <div className="flex-1" />
                      <span className="text-xs text-white/40 font-display">{memberList.length} watching</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="text-5xl mb-3">🎬</div>
                  <p className="font-display text-sm text-gray-500">PASTE A YOUTUBE URL ABOVE</p>
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:flex w-72 xl:w-80 border-l border-[#1E1E1E] flex-col shrink-0">
            <div className="px-4 py-3 border-b border-[#262626] shrink-0">
              <h3 className="font-display text-xs text-gray-400 mb-2">WATCHING ({memberList.length})</h3>
              <div className="flex flex-wrap gap-1">
                {memberList.map((name,i) => (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${name===user?.username?"border-[#FF3B3B]/50 text-[#FF3B3B] bg-[#FF3B3B]/10":"border-[#262626] text-gray-400"}`}>
                    {name}{name===user?.username?" (you)":""}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <Chat messages={messages} onSend={msg=>socketRef.current?.emit("chat-message",{roomId,message:msg,username:user?.username})} username={user?.username} />
            </div>
          </div>

          <div className="hidden md:flex lg:hidden w-64 border-l border-[#1E1E1E] flex-col shrink-0">
            <div className="px-3 py-2 border-b border-[#262626] shrink-0">
              <h3 className="font-display text-xs text-gray-400 mb-1.5">WATCHING ({memberList.length})</h3>
              <div className="flex flex-wrap gap-1">
                {memberList.map((name,i) => (
                  <div key={i} title={name} className="w-6 h-6 rounded-full bg-[#262626] flex items-center justify-center text-xs font-bold text-white">{name[0]?.toUpperCase()}</div>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <Chat messages={messages} onSend={msg=>socketRef.current?.emit("chat-message",{roomId,message:msg,username:user?.username})} username={user?.username} />
            </div>
          </div>
        </div>

        <div className="md:hidden shrink-0 border-t border-[#1E1E1E] bg-[#111] flex items-center justify-around px-2 py-1.5 z-30">
          <button onClick={()=>{setMobileTab("members");setPanelOpen(true);}} className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg ${mobileTab==="members"&&panelOpen?"text-[#FF3B3B]":"text-gray-500"}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <span className="text-xs">{memberList.length}</span>
          </button>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connected?"bg-green-500 animate-pulse":"bg-yellow-400"}`} />
            <span className="text-xs text-gray-500">{connected?"Live":"..."}</span>
          </div>
          <button onClick={()=>{setMobileTab("chat");setPanelOpen(true);setUnread(0);}} className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg relative ${mobileTab==="chat"&&panelOpen?"text-[#FF3B3B]":"text-gray-500"}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            <span className="text-xs">Chat</span>
            {unread>0&&!panelOpen&&<span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#FF3B3B] rounded-full text-white text-xs flex items-center justify-center font-bold">{unread>9?"9+":unread}</span>}
          </button>
        </div>

        {panelOpen&&(
          <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/60" onClick={()=>setPanelOpen(false)} />
            <div className="relative bg-[#161616] border-t border-[#262626] rounded-t-2xl flex flex-col z-50" style={{height:"60vh"}}>
              <div className="shrink-0 pt-3 px-4">
                <div className="w-10 h-1 bg-[#333] rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between mb-1">
                  <div className="flex gap-1">
                    <button onClick={()=>{setMobileTab("chat");setUnread(0);}} className={`px-4 py-1.5 rounded-lg text-xs font-display ${mobileTab==="chat"?"bg-[#FF3B3B] text-white":"text-gray-400"}`}>CHAT</button>
                    <button onClick={()=>setMobileTab("members")} className={`px-4 py-1.5 rounded-lg text-xs font-display ${mobileTab==="members"?"bg-[#FF3B3B] text-white":"text-gray-400"}`}>MEMBERS ({memberList.length})</button>
                  </div>
                  <button onClick={()=>setPanelOpen(false)} className="text-gray-500 text-lg">✕</button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                {mobileTab==="chat"?(
                  <Chat messages={messages} onSend={msg=>socketRef.current?.emit("chat-message",{roomId,message:msg,username:user?.username})} username={user?.username} />
                ):(
                  <div className="p-4 overflow-y-auto h-full">
                    {memberList.map((name,i)=>(
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border mb-2 ${name===user?.username?"border-[#FF3B3B]/30 bg-[#FF3B3B]/5":"border-[#262626] bg-[#111]"}`}>
                        <div className="w-8 h-8 rounded-full bg-[#262626] flex items-center justify-center text-sm font-bold text-white">{name[0]?.toUpperCase()}</div>
                        <span className={`text-sm ${name===user?.username?"text-[#FF3B3B]":"text-gray-300"}`}>{name}{name===user?.username?" (you)":""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-none z-50 w-full max-w-xs px-4">
        {notifications.map(n=>(
          <div key={n.id} className="bg-[#1A1A1A] border border-[#262626] text-white text-xs px-4 py-2 rounded-full font-display text-center">{n.msg}</div>
        ))}
      </div>
    </>
  );
}
