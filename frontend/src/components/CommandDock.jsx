import React, { useEffect, useRef, useState } from 'react';
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
  hasStarted,
}) {
  const idle = hasStarted && !isListening && !isProcessing && !isSpeaking;
  const nextRef = useRef(null);
  const containerRef = useRef(null);
  const [expanded, setExpanded] = useState(false);

  // Gentle cue on Next when idle
  useEffect(() => {
    if (!nextRef.current || !idle) return;
    nextRef.current.animate(
      [ { transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' } ],
      { duration: 220, easing: 'ease-out' }
    );
  }, [idle]);

  // Auto-collapse to hint after a short delay when idle
  useEffect(() => {
    if (!idle) return; // only collapse when idle
    const t = setTimeout(() => setExpanded(false), 3500);
    return () => clearTimeout(t);
  }, [idle]);

  // Expand on keyboard focus inside
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onFocusIn = () => setExpanded(true);
    const onMouseEnter = () => setExpanded(true);
    el.addEventListener('focusin', onFocusIn);
    el.addEventListener('mouseenter', onMouseEnter);
    return () => {
      el.removeEventListener('focusin', onFocusIn);
      el.removeEventListener('mouseenter', onMouseEnter);
    };
  }, []);

  const Container = ({ children }) => (
    <div
      ref={containerRef}
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

  // Voice-first hint UI
  const Hint = () => (
    <button
      onClick={() => setExpanded(true)}
      className="focus-ring"
      style={{
        height: 40,
        padding: '0 14px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        borderRadius: 'var(--radius-full)',
        border: '1px dashed var(--color-border)',
        background: 'transparent',
        color: 'var(--color-text-muted)',
        boxShadow: 'none',
        opacity: disabled ? 0.7 : 1,
      }}
      aria-label="Hint: say next or repeat"
    >
      {/* Tiny waveform icon */}
      <svg width="22" height="14" viewBox="0 0 44 14" aria-hidden="true">
        <polyline points="0,7 6,7 8,2 10,12 12,4 14,10 16,6 18,8 20,5 22,9 24,3 26,11 28,6 30,7 36,7 44,7" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      </svg>
      <span style={{ fontSize: 'var(--font-size-sm)' }}>
        Say ‘Next’ or ‘Repeat’
      </span>
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 6 }}>
      {idle && !expanded ? (
        <Hint />
      ) : (
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
      )}
    </div>
  );
} 