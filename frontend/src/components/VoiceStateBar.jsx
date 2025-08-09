import React from 'react';
import { Mic, MicOff, Loader2, Volume2, Globe } from 'lucide-react';

/**
 * VoiceStateBar
 * Shows top status: Listening, Thinking, Speaking, Parsing, Idle, Error
 */
export default function VoiceStateBar({ isListening, isProcessing, isSpeaking, isParsing, hasError }) {
  let label = 'Idle';
  let color = 'var(--color-text-muted)';
  let Icon = Mic;

  if (hasError) {
    label = 'Error';
    color = 'var(--color-danger)';
    Icon = MicOff;
  } else if (isParsing) {
    label = 'Parsing…';
    color = 'var(--color-primary)';
    Icon = Globe;
  } else if (isProcessing) {
    label = 'Thinking…';
    color = 'var(--color-warning)';
    Icon = Loader2;
  } else if (isListening) {
    label = 'Listening…';
    color = 'var(--color-primary)';
    Icon = Mic;
  } else if (isSpeaking) {
    label = 'Speaking…';
    color = 'var(--color-success)';
    Icon = Volume2;
  }

  return (
    <div
      className="surface"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: 0,
        borderTopLeftRadius: 'var(--radius-md)',
        borderTopRightRadius: 'var(--radius-md)',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)'
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={18} color={color} />
        <span style={{ color, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{label}</span>
      </div>
    </div>
  );
} 