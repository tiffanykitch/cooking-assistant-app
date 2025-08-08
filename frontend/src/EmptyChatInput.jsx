import React, { useState } from "react";
import "./EmptyChatInput.css";

export default function EmptyChatInput({ onSend }) {
  const [input, setInput] = useState("");

  const handleSend = (e) => {
    e.preventDefault();
    if (input.trim()) {
      onSend?.(input);
      setInput("");
    }
  };

  return (
    <form className="empty-chat-input-container" onSubmit={handleSend} autoComplete="off">
      <input
        className="empty-chat-input"
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Paste a recipe or type your cooking plan..."
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      />
      <button
        className="empty-chat-send-btn"
        type="submit"
        disabled={!input.trim()}
        aria-label="Send"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          style={{ display: "block", margin: "auto" }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3.5 16.5L16.5 10L3.5 3.5V8.5L13 10L3.5 11.5V16.5Z"
            fill="white"
          />
        </svg>
      </button>
    </form>
  );
} 