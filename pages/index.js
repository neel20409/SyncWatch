import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // If user is logged in, redirect to dashboard
    const token = document.cookie.includes("token=");
    if (token) {
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((data) => {
          if (data.user) router.push("/dashboard");
        })
        .catch(() => {});
    }
  }, []);

  return (
    <>
      <Head>
        <title>SyncWatch — Watch Together</title>
      </Head>
      <div className="gradient-bg min-h-screen flex flex-col">
        {/* Nav */}
        <nav className="flex items-center justify-between px-8 py-6">
          <div className="font-display text-xl tracking-tight">
            <span className="text-[#FF3B3B]">SYNC</span>
            <span className="text-white">WATCH</span>
          </div>
          <div className="flex gap-4">
            <Link
              href="/login"
              className="px-5 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2 text-sm font-medium bg-[#FF3B3B] text-white rounded hover:bg-red-500 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
          <div
            className={`transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="inline-flex items-center gap-2 bg-[#161616] border border-[#262626] rounded-full px-4 py-1.5 text-xs text-gray-400 mb-8 font-display">
              <span className="w-2 h-2 rounded-full bg-[#FF3B3B] animate-pulse" />
              REAL-TIME SYNC
            </div>

            <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight leading-none mb-6">
              <span className="text-white">Watch YouTube</span>
              <br />
              <span className="text-[#FF3B3B]">together.</span>
            </h1>

            <p className="text-gray-400 text-lg md:text-xl max-w-lg mx-auto mb-12 font-light leading-relaxed">
              Create a room, share the link, and watch in perfect sync — pause, seek, and change
              videos together no matter where you are.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="px-8 py-3.5 bg-[#FF3B3B] text-white font-semibold rounded hover:bg-red-500 transition-all hover:scale-105 glow-red"
              >
                Start Watching Free
              </Link>
              <Link
                href="/login"
                className="px-8 py-3.5 border border-[#262626] text-gray-300 font-semibold rounded hover:border-[#FF3B3B] hover:text-white transition-all"
              >
                Log In
              </Link>
            </div>
          </div>

          {/* Features */}
          <div
            className={`grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-4xl w-full transition-all duration-700 delay-300 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            {[
              {
                icon: "⚡",
                title: "Real-time Sync",
                desc: "Play, pause, and seek together. Millisecond precision via WebSockets.",
              },
              {
                icon: "🎬",
                title: "Any YouTube Video",
                desc: "Paste any YouTube URL or video ID. Instant load, no download required.",
              },
              {
                icon: "💬",
                title: "Live Chat",
                desc: "React and chat in real-time while you watch. Never watch alone again.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-[#161616] border border-[#262626] rounded-xl p-6 text-left hover:border-[#FF3B3B]/30 transition-colors"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-display text-sm font-bold text-white mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </main>

        <footer className="text-center text-gray-600 text-xs py-6 font-display">
          SYNCWATCH — WATCH TOGETHER, ANYWHERE
        </footer>
      </div>
    </>
  );
}
