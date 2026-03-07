import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";

export default function Signup() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sign Up — SyncWatch</title>
      </Head>
      <div className="gradient-bg min-h-screen flex flex-col items-center justify-center px-4">
        <Link href="/" className="font-display text-xl tracking-tight mb-12">
          <span className="text-[#FF3B3B]">SYNC</span>
          <span className="text-white">WATCH</span>
        </Link>

        <div className="w-full max-w-md">
          <div className="bg-[#161616] border border-[#262626] rounded-2xl p-8">
            <h1 className="font-display text-2xl font-bold text-white mb-1">Create account</h1>
            <p className="text-gray-500 text-sm mb-8">Start watching together for free</p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-display text-gray-400 mb-2">USERNAME</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full bg-[#0D0D0D] border border-[#262626] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#FF3B3B] transition-colors"
                  placeholder="cooluser123"
                  minLength={3}
                  maxLength={20}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-display text-gray-400 mb-2">EMAIL</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-[#0D0D0D] border border-[#262626] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#FF3B3B] transition-colors"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-display text-gray-400 mb-2">PASSWORD</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-[#0D0D0D] border border-[#262626] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#FF3B3B] transition-colors"
                  placeholder="Min. 6 characters"
                  minLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FF3B3B] text-white font-semibold py-3 rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <p className="text-center text-gray-500 text-sm mt-6">
              Already have an account?{" "}
              <Link href="/login" className="text-[#FF3B3B] hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
