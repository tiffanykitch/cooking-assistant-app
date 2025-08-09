import React from 'react';

export default function StepCard({
  stepText,
  stepIndex,
  totalSteps,
  waitingForConfirm,
  timerEndsAt,
  paused,
}) {
  const now = Date.now();
  const timeLeftMs = timerEndsAt ? Math.max(0, timerEndsAt - now) : null;
  const minutes = timeLeftMs != null ? Math.ceil(timeLeftMs / 60000) : null;

  const Chip = ({ label }) => (
    <span className="pill" style={{ fontSize: 12, color: 'var(--color-text)' }}>{label}</span>
  );

  return (
    <section className="surface" style={{ padding: 16, width: '100%', maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-muted)' }}>
          Step {stepIndex + 1} of {totalSteps}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {paused ? (
            <Chip label="Paused" />
          ) : timerEndsAt ? (
            <Chip label={minutes != null ? `Time left: ${minutes}m` : 'Timing'} />
          ) : waitingForConfirm ? (
            <Chip label="Waiting" />
          ) : null}
        </div>
      </div>
      <div style={{ fontSize: 20, lineHeight: 1.5 }}>
        {stepText}
      </div>
    </section>
  );
} 