import React from "react";

export function formatAIResponse(message) {
  if (!message) return '';

  // Step 1: Normalize line breaks and trim excessive spacing
  let cleaned = message
    .replace(/\r\n|\r/g, '\n')       // Normalize all line endings to \n
    .replace(/\n{3,}/g, '\n\n')      // Limit to max two line breaks
    .trim();

  // Step 2: Fix broken numbered lists (e.g., "1.\nBoil water" → "1. Boil water")
  cleaned = cleaned.replace(/(^|\n)(\d+)\.\s*\n([^\n])/g, '$1$2. $3');

  // Step 3: Convert ingredient lists to proper markdown bulleted lists
  // Look for patterns like multiple lines of ingredients (usually after "ingredients:" or similar)
  cleaned = cleaned.replace(/\n([A-Z][^:\n]*(?:\n[A-Z][^:\n]*){2,})/g, (match, content) => {
    // Split into individual lines and check if they look like ingredients
    const lines = content.split('\n').filter(line => line.trim());
    const isIngredientList = lines.every(line => {
      // Simple heuristic: short lines that don't end with punctuation (except periods in abbreviations)
      return line.length < 80 && !line.match(/[!?]$/) && !line.match(/\.\s*$/);
    });
    
    if (isIngredientList && lines.length >= 2) {
      // Convert to bulleted list
      const bulletedLines = lines.map(line => `- ${line.trim()}`);
      return '\n' + bulletedLines.join('\n');
    }
    return match;
  });

  // Step 4: Bold quantities and measurements
  const quantityRegex = /(\b\d+[\d\s\/\.]*\s?(cups?|tablespoons?|teaspoons?|tbsps?|tsp|oz|ounces?|grams?|g|ml|milliliters?|liters?|l|cloves?|slices?|pounds?|lbs?|minutes?|mins?|hours?|degrees?|°F|°C|pinch|dash)\b)/gi;
  cleaned = cleaned.replace(quantityRegex, '**$1**');

  return cleaned;
} 