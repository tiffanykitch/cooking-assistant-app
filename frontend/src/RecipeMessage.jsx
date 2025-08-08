import React from "react";
import ReactMarkdown from "react-markdown";
import { formatAIResponse } from "./formatAIResponse";

const markdownContainerStyle = {
  whiteSpace: "pre-line",
  marginBottom: "0",
  padding: "0",
};

const renderers = {
  // Remove default <p> margin/padding
  p: ({ children }) => <p style={{ margin: 0, padding: 0 }}>{children}</p>,
  // Bold text styling - inherit color and just make it bold
  strong: ({ children }) => (
    <strong style={{ fontWeight: "700" }}>{children}</strong>
  ),
  // Tighter spacing for list items
  li: ({ children }) => (
    <li style={{ margin: "0.25rem 0", paddingLeft: "0.5rem" }}>
      {children}
    </li>
  ),
  // Controlled spacing for unordered lists
  ul: ({ children }) => (
    <ul style={{ 
      marginTop: "0.5rem", 
      marginBottom: "0.5rem",
      paddingLeft: "1.5rem",
      listStylePosition: "outside"
    }}>
      {children}
    </ul>
  ),
  // Controlled spacing for ordered lists
  ol: ({ children }) => (
    <ol style={{ 
      marginTop: "0.5rem", 
      marginBottom: "0.5rem",
      paddingLeft: "1.5rem",
      listStylePosition: "outside"
    }}>
      {children}
    </ol>
  ),
};

export default function RecipeMessage({ markdownText }) {
  const formattedText = formatAIResponse(markdownText);
  
  return (
    <div style={markdownContainerStyle}>
      <ReactMarkdown components={renderers}>{formattedText}</ReactMarkdown>
    </div>
  );
} 