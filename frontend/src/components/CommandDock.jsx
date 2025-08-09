import React, { useEffect, useRef } from 'react';
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
  const nextRef = useRef(null);

  useEffect(() => {
    if (!nextRef.current || !idle) return;
    nextRef.current.animate(
      [ { transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' } ],
      { duration: 220, easing: 'ease-out' }
    );
  }, [idle]);

  const Container = ({ children }) => (
    <div
      className="surface"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: 6,
        borderRadius: 'var(--radius-full)',
        background: 'color-mix(in srgb, var(--color-elev-1) 80%, transparent)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-1)',
        backdropFilter: 'blur(8px)',
      }}
      role="group"
      aria-label="Voice command shortcuts"
    >
      {children}
    </div>
  );

  const Segment = React.forwardRef(function Segment(
    { icon: Icon, label, onClick, active, ariaLabel },
    ref
  ) {
    return (
      <button
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        className="focus-ring"
        style={{
          height: 44,
          minWidth: 112,
          padding: '0 14px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderRadius: 'var(--radius-full)',
          border: active ? '1px solid var(--color-primary)' : '1px solid transparent',
          background: active
            ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)'
            : 'transparent',
          color: 'var(--color-text)',
          boxShadow: active ? 'inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'none',
          transition: 'transform 120ms ease, box-shadow 160ms ease, background 160ms ease',
          opacity: disabled ? 0.6 : 1,
        }}
        aria-label={ariaLabel || label}
      >
        <Icon size={18} />
        <span style={{ fontWeight: 650, fontSize: 'var(--font-size-sm)' }}>{label}</span>
      </button>
    );
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 6 }}>
      <Container>
        {showBack && (
          <Segment icon={ArrowLeft} label="Back" onClick={onBack} ariaLabel="Go back one step" />
        )}
        <Segment icon={RotateCw} label="Repeat" onClick={onRepeat} ariaLabel="Repeat the last instruction" />
        <Segment
          ref={nextRef}
          icon={ArrowRight}
          label="Next"
          onClick={onNext}
          active
          ariaLabel="Go to the next step"
        />
      </Container>
    </div>
  );
} 