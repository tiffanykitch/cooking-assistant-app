import React from "react";
export default function SpeakerIcon({ muted }) {
  return muted ? (
    // Muted speaker
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 8v4h4l5 5V3l-5 5H3z" fill="#9CA3AF"/>
      <line x1="15" y1="7" x2="19" y2="13" stroke="#9CA3AF" strokeWidth="2"/>
      <line x1="19" y1="7" x2="15" y2="13" stroke="#9CA3AF" strokeWidth="2"/>
    </svg>
  ) : (
    // Unmuted speaker
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 8v4h4l5 5V3l-5 5H3z" fill="#3B82F6"/>
      <path d="M15 8.5a3.5 3.5 0 010 3" stroke="#3B82F6" strokeWidth="2" fill="none"/>
      <path d="M17 6a7 7 0 010 8" stroke="#3B82F6" strokeWidth="2" fill="none"/>
    </svg>
  );
} 