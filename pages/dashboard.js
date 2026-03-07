import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [creating, setCreating] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      router.push("/login");
      return;
    }
    setUser(JSON.parse(stored));
  }, []);

  const handleCreate = async () => {
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName || `${user?.username}'s Room` }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      router.push(`/room/${data.room.roomId}`);
    } catch {
      setError("Failed to create room");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = () => {
    if (!joinCode.trim()) return;
    router.push(`/room/${joinCode.trim().toUpperCase()}`);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  };

  return (
    <>
      <Head>
        <title>Dashboard — SyncWatch</title>
      </Head>
      <div className="gradient-bg min-h-screen">
        {/* Nav */}
        <nav className="flex items-center justify-between px-8 py-5 border-b border-[#1E1E1E]">
          <Link href="/" className="font-display text-lg tracking-tight">
            <span className="text-[#FF3B3B]">SYNC</span>
            <span className="text-white">WATCH</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">
              Hey, <span className="text-white font-medium">{user?.username}</span>
            </span>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-white text-sm transition-colors"
            >
              Log out
            </button>
          </div>
        </nav>

        <main className="max-w-4xl mx-auto px-4 py-16">
          <h1 className="font-display text-3xl font-bold text-white mb-2">Watch Party</h1>
          <p className="text-gray-500 mb-12">Create a room or join an existing one.</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-8">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Create Room */}
            <div className="bg-[#161616] border border-[#262626] rounded-2xl p-8 hover:border-[#FF3B3B]/30 transition-colors">
              <div className="text-3xl mb-4">🎬</div>
              <h2 className="font-display text-lg font-bold text-white mb-1">Create a Room</h2>
              <p className="text-gray-500 text-sm mb-6">
                Host a watch party and invite friends with your room code.
              </p>

              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Room name (optional)"
                className="w-full bg-[#0D0D0D] border border-[#262626] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#FF3B3B] transition-colors mb-4"
              />

              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full bg-[#FF3B3B] text-white font-semibold py-3 rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Room"}
              </button>
            </div>

            {/* Join Room */}
            <div className="bg-[#161616] border border-[#262626] rounded-2xl p-8 hover:border-[#FF3B3B]/30 transition-colors">
              <div className="text-3xl mb-4">🔗</div>
              <h2 className="font-display text-lg font-bold text-white mb-1">Join a Room</h2>
              <p className="text-gray-500 text-sm mb-6">
                Enter a room code shared by your friend to join their session.
              </p>

              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="Enter room code (e.g. A1B2C3D4)"
                className="w-full bg-[#0D0D0D] border border-[#262626] rounded-lg px-4 py-3 text-white text-sm font-display focus:outline-none focus:border-[#FF3B3B] transition-colors mb-4"
                maxLength={8}
              />

              <button
                onClick={handleJoin}
                disabled={!joinCode.trim()}
                className="w-full border border-[#FF3B3B] text-[#FF3B3B] font-semibold py-3 rounded-lg hover:bg-[#FF3B3B] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Join Room
              </button>
            </div>
          </div>

          {/* How it works */}
          <div className="mt-16">
            <h2 className="font-display text-sm text-gray-500 mb-6">HOW IT WORKS</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: "01", text: "Create a room and copy the room code" },
                { step: "02", text: "Share the code with your friend" },
                { step: "03", text: "Paste a YouTube link and watch in sync" },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-4">
                  <span className="font-display text-[#FF3B3B] text-sm">{s.step}</span>
                  <p className="text-gray-400 text-sm leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
