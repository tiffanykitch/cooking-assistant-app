import React from 'react';

export default function ParallelTasksRail({ tasks = [] }) {
  if (!tasks.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
      {tasks.map((t, idx) => (
        <span key={idx} className="pill" style={{ fontSize: 12 }}>
          {t.label}
        </span>
      ))}
    </div>
  );
} 