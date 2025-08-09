import React from 'react';
import { ArrowLeft, ArrowRight, RotateCw } from 'lucide-react';

export default function CommandDock({
  disabled,
  showBack,
  onBack,
  onRepeat,
  onNext,
  isListening,
  isProcessing,
  isSpeaking,
}) {
  const idle = !isListening && !isProcessing && !isSpeaking;

  const Chip = ({ icon: Icon, label, onClick, primary }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="focus-ring"
      style={{
        height: 44,
        padding: '0 14px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 'var(--radius-full)',
        border: `1px solid ${primary ? 'var(--color-primary)' : 'var(--color-border)'}`,
        background: primary ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'var(--color-elev-1)',
        color: 'var(--color-text)',
        boxShadow: idle && primary ? '0 0 0 6px color-mix(in srgb, var(--color-primary) 16%, transparent)' : 'var(--shadow-1)',
        transition: 'transform 120ms ease, box-shadow 160ms ease, background 160ms ease',
        opacity: disabled ? 0.6 : 1,
      }}
      aria-label={label}
    >
      <Icon size={18} />
      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{label}</span>
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 10 }}>
      {showBack && <Chip icon={ArrowLeft} label="Back" onClick={onBack} />}
      <Chip icon={RotateCw} label="Repeat" onClick={onRepeat} />
      <Chip icon={ArrowRight} label="Next" onClick={onNext} primary />
    </div>
  );
} 