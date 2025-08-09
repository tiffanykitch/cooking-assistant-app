import React, { useState } from 'react';

function isLikelyUrl(str) {
  try {
    const u = new URL(str);
    return !!u.protocol && !!u.host;
  } catch { return false; }
}

export default function RecipeURLBar({ onParsed }) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError('');
    if (!isLikelyUrl(value)) {
      setError('Enter a valid URL');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/ingest-recipe-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: value.trim() })
      });
      const data = await res.json();
      if (data?.status === 'ok' && data.recipe) {
        setPreview({ title: data.recipe.title, site: data.recipe.meta?.siteName });
        onParsed?.(data.recipe);
      } else {
        throw new Error(data?.message || 'Failed to parse');
      }
    } catch (err) {
      setError(err.message || 'Failed to parse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
      <input
        type="url"
        placeholder="Paste a recipe URL"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="focus-ring"
        style={{
          width: 420,
          maxWidth: '80vw',
          height: 44,
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-elev-1)',
          color: 'var(--color-text)',
          padding: '0 14px'
        }}
      />
      <button disabled={loading} className="focus-ring" style={{ height: 44, padding: '0 16px', borderRadius: 'var(--radius-full)' }}>
        {loading ? 'Parsing…' : 'Parse'}
      </button>
      {error && <div style={{ color: 'var(--color-danger)', fontSize: 12 }}>{error}</div>}
      {preview && !error && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
          Found: {preview.title} ({preview.site})
        </div>
      )}
    </form>
  );
} 