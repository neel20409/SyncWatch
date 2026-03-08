import { useState, useEffect, useRef, useCallback } from "react";

export default function VideoControls({ playerRef, socket, roomId, isPlaying, currentTime, duration }) {
  const [progress, setProgress] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [vol, setVol] = useState(100);
  const [muted, setMuted] = useState(false);
  const intervalRef = useRef(null);

  // Update progress bar every second
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (!seeking && playerRef.current) {
        const t = playerRef.current.getCurrentTime() || 0;
        const d = duration || 1;
        setProgress((t / d) * 100);
      }
    }, 500);
    return () => clearInterval(intervalRef.current);
  }, [seeking, duration]);

  const handlePlay = useCallback(() => {
    const t = playerRef.current?.getCurrentTime() || 0;
    playerRef.current?.play();
    socket?.emit("video-play", { roomId, currentTime: t });
  }, [socket, roomId]);

  const handlePause = useCallback(() => {
    const t = playerRef.current?.getCurrentTime() || 0;
    playerRef.current?.pause();
    socket?.emit("video-pause", { roomId, currentTime: t });
  }, [socket, roomId]);

  const handleSeek = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * (duration || 0);
    setProgress(pct * 100);
    playerRef.current?.seekTo(t);
    socket?.emit("video-seek", { roomId, currentTime: t });
  }, [socket, roomId, duration]);

  const toggleMute = () => {
    setMuted(m => {
      const next = !m;
      try {
        if (next) playerRef.current?.getInternalPlayer?.()?.mute?.();
        else playerRef.current?.getInternalPlayer?.()?.unMute?.();
      } catch {}
      return next;
    });
  };

  const fmt = (s) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-3 pt-8">
      {/* Progress bar */}
      <div
        className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group"
        onClick={handleSeek}
      >
        <div
          className="h-full bg-[#FF3B3B] rounded-full relative transition-all"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Buttons row */}
      <div className="flex items-center gap-3">
        {/* Play / Pause */}
        {isPlaying ? (
          <button onClick={handlePause} className="text-white hover:text-[#FF3B3B] transition-colors">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          </button>
        ) : (
          <button onClick={handlePlay} className="text-white hover:text-[#FF3B3B] transition-colors">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        )}

        {/* Time */}
        <span className="text-white text-xs font-display tabular-nums">
          {fmt(currentTime)} / {fmt(duration)}
        </span>

        <div className="flex-1" />

        {/* Volume */}
        <button onClick={toggleMute} className="text-white hover:text-[#FF3B3B] transition-colors">
          {muted ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
