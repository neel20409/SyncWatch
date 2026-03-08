import { useState, useEffect, useRef } from "react";

export default function VideoControls({ playerRef, socketRef, roomId, isPlaying, currentTime, duration }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      try {
        const ct = playerRef.current?.getCurrentTime() || 0;
        const d = duration || 1;
        setProgress(Math.min(100, (ct / d) * 100));
      } catch {}
    }, 500);
    return () => clearInterval(t);
  }, [duration]);

  const emit = (event, data) => {
    const sock = socketRef.current;
    if (!sock || !sock.connected) {
      console.warn("[CTRL] Socket not connected! Cannot emit", event);
      return;
    }
    console.log(`[CTRL] emitting ${event}`, data);
    sock.emit(event, data);
  };

  const handlePlay = () => {
    const t = playerRef.current?.getCurrentTime() || 0;
    try { playerRef.current?.play(); } catch {}
    emit("video-play", { roomId, currentTime: t });
  };

  const handlePause = () => {
    const t = playerRef.current?.getCurrentTime() || 0;
    try { playerRef.current?.pause(); } catch {}
    emit("video-pause", { roomId, currentTime: t });
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * (duration || 0);
    setProgress(pct * 100);
    try { playerRef.current?.seekTo(t); } catch {}
    emit("video-seek", { roomId, currentTime: t });
  };

  const fmt = (s) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-3 pt-10">
      {/* Progress bar */}
      <div className="w-full h-2 bg-white/20 rounded-full cursor-pointer mb-3 group relative" onClick={handleSeek}>
        <div className="h-full bg-[#FF3B3B] rounded-full relative" style={{ width: `${progress}%` }}>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isPlaying ? (
          <button onClick={handlePause} className="text-white hover:text-[#FF3B3B] transition-colors p-1">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          </button>
        ) : (
          <button onClick={handlePlay} className="text-white hover:text-[#FF3B3B] transition-colors p-1">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        )}
        <span className="text-white/80 text-xs font-display tabular-nums select-none">
          {fmt(currentTime)} / {fmt(duration)}
        </span>
      </div>
    </div>
  );
}
