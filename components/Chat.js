import { useState, useRef, useEffect } from "react";

export default function Chat({ messages, onSend, username }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // On mobile, when keyboard opens, scroll to bottom
  useEffect(() => {
    const handleResize = () => {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput("");
    // Keep focus on mobile after send
    inputRef.current?.focus();
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3 min-h-0 overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="text-2xl mb-2">💬</div>
            <p className="text-gray-600 text-xs">No messages yet. Say hello!</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.username === username;
          return (
            <div key={i} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              {/* Name + time */}
              <div className="flex items-baseline gap-1.5 mb-0.5 px-1">
                <span className={`text-xs font-semibold ${isMe ? "text-[#FF3B3B]" : "text-blue-400"}`}>
                  {isMe ? "You" : msg.username}
                </span>
                <span className="text-gray-600 text-xs">{formatTime(msg.timestamp)}</span>
              </div>
              {/* Bubble */}
              <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                isMe
                  ? "bg-[#FF3B3B] text-white rounded-tr-sm"
                  : "bg-[#222] text-gray-200 rounded-tl-sm"
              }`}>
                {msg.message}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Input — stays above keyboard on mobile */}
      <div className="shrink-0 p-2 sm:p-3 border-t border-[#262626] bg-[#161616]">
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message..."
            className="flex-1 bg-[#0D0D0D] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF3B3B] transition-colors min-w-0"
            maxLength={300}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-9 h-9 sm:w-10 sm:h-10 bg-[#FF3B3B] text-white rounded-xl hover:bg-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0 flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
