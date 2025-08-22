import React from 'react';

export default function ParallelTasksRail({ tasks }) {
  if (!tasks || tasks.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
      {tasks.map((t, i) => (
        <span key={i} className="pill" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {t.label}
        </span>
      ))}
    </div>
  );
} 