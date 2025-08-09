import React from 'react';

export default function IngredientChecklist({ ingredients = [], onToggle }) {
  if (!ingredients.length) return null;
  return (
    <section className="surface" style={{ padding: 16, width: '100%', maxWidth: 720 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Gather these:</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {ingredients.map((item, idx) => (
          <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" onChange={() => onToggle?.(idx)} aria-label={`Got ${item}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
} 