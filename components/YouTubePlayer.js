import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

let apiLoaded = false;

const YouTubePlayer = forwardRef(function YouTubePlayer(
  { videoId, onReady, onStateChange },
  ref
) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const onStateChangeRef = useRef(onStateChange);
  const onReadyRef = useRef(onReady);

  // Keep refs updated without recreating the player
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  const safeCall = (fn) => {
    try {
      const p = playerRef.current;
      if (p && readyRef.current) return fn(p);
    } catch {}
    return null;
  };

  useImperativeHandle(ref, () => ({
    playVideo: () => safeCall((p) => p.playVideo()),
    pauseVideo: () => safeCall((p) => p.pauseVideo()),
    seekTo: (time) => safeCall((p) => p.seekTo(time, true)),
    getCurrentTime: () => safeCall((p) => p.getCurrentTime()) ?? 0,
    getPlayerState: () => safeCall((p) => p.getPlayerState()) ?? -1,
    loadVideo: (id) => safeCall((p) => p.loadVideoById(id)),
    cueVideo: (id) => safeCall((p) => p.cueVideoById(id)),
  }));

  useEffect(() => {
    const initPlayer = () => {
      if (!containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        height: "100%",
        width: "100%",
        videoId: videoId || "",
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          // Disable annotations and end screen
          iv_load_policy: 3,
          fs: 1,
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            onReadyRef.current?.();
          },
          onStateChange: (e) => {
            onStateChangeRef.current?.(e);
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else if (!apiLoaded) {
      apiLoaded = true;
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = initPlayer;
    } else {
      const interval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(interval);
          initPlayer();
        }
      }, 100);
      return () => clearInterval(interval);
    }

    return () => {
      readyRef.current = false;
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;
    };
  }, [videoId]); // re-init when videoId changes

  return <div ref={containerRef} className="w-full h-full" />;
});

export default YouTubePlayer;
