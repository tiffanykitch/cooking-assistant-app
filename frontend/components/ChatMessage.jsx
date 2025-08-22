import React from 'react';
import { Mic as MicIcon } from 'lucide-react';
import './ChatMessage.css';

export default function ChatMessage({ message, onMicClick }) {
  const text = message?.content || message?.text || '';
  const cueRegex = /(You should notice.*|It should.*)/i;
  const match = text.match(cueRegex);
  const mainInstruction = match ? text.replace(cueRegex, '').trim() : text;
  const sensoryCue = match ? match[0] : '';

  return (
    <div className={`chat-step-card ${message?.role || 'assistant'}`}>
      <div className="step-instruction">{mainInstruction}</div>
      {!!sensoryCue && (
        <div className="step-sensory-cue">{sensoryCue}</div>
      )}
      {message?.role === 'assistant' && (
        <button className="step-mic-button" onClick={onMicClick} aria-label="Play this step">
          <MicIcon size={22} />
        </button>
      )}
    </div>
  );
} 