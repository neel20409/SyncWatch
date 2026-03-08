import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

let apiLoaded = false;
let apiReady = false;
const pendingInits = [];

function ensureAPI(cb) {
  if (apiReady) { cb(); return; }
  pendingInits.push(cb);
  if (!apiLoaded) {
    apiLoaded = true;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => {
      apiReady = true;
      pendingInits.forEach(fn => fn());
      pendingInits.length = 0;
    };
  }
}

const YouTubePlayer = forwardRef(function YouTubePlayer({ videoId, onReady }, ref) {
  const divRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  useImperativeHandle(ref, () => ({
    play: () => { try { if (readyRef.current) playerRef.current?.playVideo(); } catch {} },
    pause: () => { try { if (readyRef.current) playerRef.current?.pauseVideo(); } catch {} },
    seekTo: (t) => { try { if (readyRef.current) playerRef.current?.seekTo(t, true); } catch {} },
    getCurrentTime: () => { try { if (readyRef.current) return playerRef.current?.getCurrentTime() || 0; } catch {} return 0; },
    getState: () => { try { if (readyRef.current) return playerRef.current?.getPlayerState(); } catch {} return -1; },
    getDuration: () => { try { if (readyRef.current) return playerRef.current?.getDuration() || 0; } catch {} return 0; },
  }));

  useEffect(() => {
    if (!divRef.current) return;
    let destroyed = false;

    ensureAPI(() => {
      if (destroyed || !divRef.current) return;
      playerRef.current = new window.YT.Player(divRef.current, {
        videoId: videoId || "",
        width: "100%",
        height: "100%",
        playerVars: {
          controls: 0,        // ← DISABLE YouTube controls entirely
          disablekb: 1,       // ← Disable keyboard shortcuts
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (destroyed) return;
            readyRef.current = true;
            onReadyRef.current?.();
          },
          // NO onStateChange — we don't listen to it at all
        },
      });
    });

    return () => {
      destroyed = true;
      readyRef.current = false;
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;
    };
  }, [videoId]);

  return <div ref={divRef} className="w-full h-full" />;
});

export default YouTubePlayer;

// Export a helper to get duration — called from room page
