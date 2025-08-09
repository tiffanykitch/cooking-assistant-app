import React, { useMemo } from "react";
import "./EmptyState.css";
import RecipeURLBar from "./components/RecipeURLBar.jsx";

const GREETINGS = [
  {
    headline: "PrepTalk",
    sub: "Advanced culinary intelligence at your fingertips. Ask me anything about cooking, nutrition, or kitchen techniques."
  }
];

export default function EmptyState({ onRecipeParsed }) {
  // Pick a greeting once per session
  const greeting = useMemo(() => {
    const idx = Math.floor(Math.random() * GREETINGS.length);
    return GREETINGS[idx];
  }, []);

  return (
    <div className="empty-state-bg">
      <div className="empty-state-container">
        <h1 className="empty-state-headline">{greeting.headline}</h1>
        <p className="empty-state-subtitle">{greeting.sub}</p>
        <div style={{ marginTop: 16 }}>
          <RecipeURLBar onParsed={onRecipeParsed} />
        </div>
      </div>
    </div>
  );
} 