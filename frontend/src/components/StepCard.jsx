import React from 'react';

export default function StepCard({
  title,
  stepText,
  stepIndex,
  totalSteps,
  status, // 'waiting' | 'timing' | 'paused' | 'info'
  etaMs,
  startedAtMs,
}) {
  const fmtTime = (ms) => {
    if (!ms) return null;
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem ? `${m}m ${rem}s` : `${m}m`;
  };

  const badge = ({ label, color }) => (
    <span className="pill" style={{ color, borderColor: color, background: 'transparent' }}>{label}</span>
  );

  return (
    <div className="surface" style={{ padding: 16, borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
          {title ? title : 'Current Step'} • Step {stepIndex + 1} of {totalSteps}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {status === 'waiting' && badge({ label: 'Waiting', color: 'var(--color-primary)' })}
          {status === 'timing' && badge({ label: 'Timing', color: 'var(--color-success)' })}
          {status === 'paused' && badge({ label: 'Paused', color: 'var(--color-warning)' })}
        </div>
      </div>
      <div style={{ fontSize: 18, lineHeight: 1.5, color: 'var(--color-text)' }}>
        {stepText}
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'center', color: 'var(--color-text-muted)' }}>
        {etaMs ? <span>ETA: {fmtTime(etaMs)}</span> : null}
        {startedAtMs ? <span>Elapsed: {fmtTime(Date.now() - startedAtMs)}</span> : null}
      </div>
    </div>
  );
} 