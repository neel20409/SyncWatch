import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

const YouTubePlayer = forwardRef(function YouTubePlayer({ videoId, onReady }, ref) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  useImperativeHandle(ref, () => ({
    play: () => {
      console.log("[YT] play() called, ready=", readyRef.current);
      if (readyRef.current && playerRef.current) {
        playerRef.current.playVideo();
      }
    },
    pause: () => {
      console.log("[YT] pause() called, ready=", readyRef.current);
      if (readyRef.current && playerRef.current) {
        playerRef.current.pauseVideo();
      }
    },
    seekTo: (t) => {
      if (readyRef.current && playerRef.current) {
        playerRef.current.seekTo(t, true);
      }
    },
    getCurrentTime: () => {
      if (readyRef.current && playerRef.current) {
        return playerRef.current.getCurrentTime() || 0;
      }
      return 0;
    },
    getDuration: () => {
      if (readyRef.current && playerRef.current) {
        return playerRef.current.getDuration() || 0;
      }
      return 0;
    },
  }));

  useEffect(() => {
    if (!containerRef.current || !videoId) return;

    readyRef.current = false;
    playerRef.current = null;

    const initPlayer = () => {
      if (!containerRef.current) return;

      // Clear any existing content
      containerRef.current.innerHTML = "";
      const div = document.createElement("div");
      containerRef.current.appendChild(div);

      playerRef.current = new window.YT.Player(div, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          controls: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            console.log("[YT] onReady fired for", videoId);
            readyRef.current = true;
            onReadyRef.current?.();
          },
          onError: (e) => {
            console.error("[YT] player error:", e.data);
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      // Load API fresh
      const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (!existing) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = initPlayer;

      // Poll as fallback
      const poll = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(poll);
          initPlayer();
        }
      }, 200);
      return () => clearInterval(poll);
    }

    return () => {
      readyRef.current = false;
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [videoId]);

  return <div ref={containerRef} className="w-full h-full" />;
});

export default YouTubePlayer;
