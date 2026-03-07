import { useState, useRef, useEffect } from "react";

export default function Chat({ messages, onSend, username }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#262626]">
        <h3 className="font-display text-xs text-gray-400">CHAT</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-gray-600 text-xs text-center mt-8">
            Say hello! Chat appears here.
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="group">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-xs font-semibold ${
                  msg.username === username ? "text-[#FF3B3B]" : "text-blue-400"
                }`}
              >
                {msg.username}
              </span>
              <span className="text-gray-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                {formatTime(msg.timestamp)}
              </span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed break-words">{msg.message}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#262626]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Say something..."
            className="flex-1 bg-[#0D0D0D] border border-[#262626] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#FF3B3B] transition-colors"
            maxLength={300}
          />
          <button
            onClick={handleSend}
            className="px-3 py-2 bg-[#FF3B3B] text-white rounded-lg hover:bg-red-500 transition-colors text-sm"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
