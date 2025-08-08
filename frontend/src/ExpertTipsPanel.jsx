import React from "react";

/**
 * ExpertTipsPanel
 * Displays a visually distinct, elegant section of expert cooking tips.
 * @param {Array<{title: string, tip: string}>} tips - Array of tips to display.
 */
function ExpertTipsPanel({ tips }) {
  if (!tips || tips.length === 0) return null;

  // Responsive, accessible, and visually distinct styles
  const panelStyle = {
    background: "#f5f7fa", // Subtle light background
    borderLeft: "4px solid #7dd3fc", // Soft blue accent border
    borderRadius: 10,
    padding: "1em",
    margin: "1.2em 0",
    maxWidth: 600,
    width: "100%",
    boxSizing: "border-box",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    alignSelf: "center"
  };

  const titleStyle = {
    fontWeight: 700,
    fontSize: "1.08rem",
    color: "#0369a1", // Deep blue for emphasis
    marginBottom: 4,
    lineHeight: 1.2
  };

  const tipStyle = {
    fontSize: "1rem",
    color: "#22223b",
    marginBottom: 12,
    lineHeight: 1.5
  };

  // Responsive container for mobile/desktop
  const containerStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%"
  };

  return (
    <section
      aria-label="Expert Cooking Tips"
      style={containerStyle}
    >
      <div style={panelStyle}>
        <h2 style={{
          fontSize: "1.12rem",
          fontWeight: 800,
          color: "#0ea5e9",
          margin: "0 0 0.7em 0",
          letterSpacing: "0.01em"
        }}>
          Expert Tips
        </h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {tips.map((tip, idx) => (
            <li key={idx} style={{ marginBottom: idx === tips.length - 1 ? 0 : 18 }}>
              <div style={titleStyle}>{tip.title}</div>
              <div style={tipStyle}>{tip.tip}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default ExpertTipsPanel; 