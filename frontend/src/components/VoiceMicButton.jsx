import React, { useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

/**
 * VoiceMicButton
 * Large radial mic with stateful glow and optional waveform hook.
 */
export default function VoiceMicButton({ isListening, isProcessing, isSpeaking, hasError, onClick }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!buttonRef.current) return;
    buttonRef.current.animate(
      [ { transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' } ],
      { duration: 180, easing: 'ease-out' }
    );
  }, [isListening, isProcessing, isSpeaking, hasError]);

  const bg = hasError
    ? 'var(--color-danger)'
    : isListening
      ? 'var(--color-primary)'
      : isSpeaking
        ? 'var(--color-success)'
        : 'var(--color-elev-2)';

  const ring = hasError
    ? '0 0 0 10px color-mix(in srgb, var(--color-danger) 20%, transparent)'
    : isListening
      ? '0 0 0 10px color-mix(in srgb, var(--color-primary) 20%, transparent)'
      : isSpeaking
        ? '0 0 0 10px color-mix(in srgb, var(--color-success) 20%, transparent)'
        : '0 4px 12px rgba(0,0,0,0.25)';

  const Icon = isListening ? MicOff : Mic;

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      className="focus-ring"
      style={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        border: '1px solid var(--color-border)',
        background: bg,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: ring,
        transition: 'box-shadow 160ms ease, background 160ms ease, transform 120ms ease',
      }}
      aria-label={isListening ? 'Stop listening' : 'Start listening'}
    >
      <Icon size={30} />
    </button>
  );
} 