import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

// Load YouTube IFrame API
let apiLoaded = false;

const YouTubePlayer = forwardRef(function YouTubePlayer(
  { videoId, onReady, onStateChange },
  ref
) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);

  useImperativeHandle(ref, () => ({
    playVideo: () => playerRef.current?.playVideo(),
    pauseVideo: () => playerRef.current?.pauseVideo(),
    seekTo: (time) => playerRef.current?.seekTo(time, true),
    getCurrentTime: () => playerRef.current?.getCurrentTime() || 0,
    getPlayerState: () => playerRef.current?.getPlayerState(),
    loadVideo: (id) => playerRef.current?.loadVideoById(id),
    cueVideo: (id) => playerRef.current?.cueVideoById(id),
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
        },
        events: {
          onReady: (e) => {
            readyRef.current = true;
            onReady && onReady(e);
          },
          onStateChange: (e) => {
            onStateChange && onStateChange(e);
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
      // API is loading, wait
      const interval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(interval);
          initPlayer();
        }
      }, 100);
      return () => clearInterval(interval);
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
});

export default YouTubePlayer;
