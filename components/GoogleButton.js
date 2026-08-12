import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

export default function GoogleButton({ text = "Continue with Google", onError }) {
  const router = useRouter();
  const buttonRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const handleGoogleResponse = async (response) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (onError) onError(data.error || "Google sign-in failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      router.push("/dashboard");
    } catch (err) {
      if (onError) onError(`Google authentication failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!clientId) return;

    const loadGoogleScript = () => {
      if (window.google?.accounts?.id) {
        initGoogleButton();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogleButton;
      document.body.appendChild(script);
    };

    const initGoogleButton = () => {
      if (window.google?.accounts?.id && buttonRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleResponse,
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          width: "100%",
          text: text.includes("Sign in") ? "signin_with" : "signup_with",
          shape: "rectangular",
          logo_alignment: "left",
        });
      }
    };

    loadGoogleScript();
  }, [clientId, text]);

  const handleManualClick = () => {
    if (!clientId) {
      if (onError) {
        onError("Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your environment variables to enable Google authentication.");
      } else {
        alert("Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your environment variables to enable Google authentication.");
      }
    }
  };

  if (clientId) {
    return (
      <div className="w-full relative">
        <div ref={buttonRef} className="w-full flex justify-center min-h-[44px]"></div>
        {loading && (
          <div className="absolute inset-0 bg-[#161616]/80 flex items-center justify-center rounded-lg text-xs text-gray-300">
            Signing in with Google...
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleManualClick}
      disabled={loading}
      className="w-full bg-[#1A1A1A] border border-[#333333] hover:bg-[#262626] text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-3 transition-colors text-sm"
    >
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        />
      </svg>
      <span>{loading ? "Connecting..." : text}</span>
    </button>
  );
}
