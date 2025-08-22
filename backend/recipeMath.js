// Lightweight deterministic recipe math and parsing utilities

// Known densities (grams per cup) for common ingredients
// Values are approximations but consistent across the session
const DENSITY_G_PER_CUP = {
  // Flours
  "all-purpose flour": 120,
  "ap flour": 120,
  "flour": 120,
  // Sugars
  "granulated sugar": 200,
  "white sugar": 200,
  "sugar": 200,
  "brown sugar": 220, // packed
  // Liquids (treated mostly by volume ml; grams approximate water-like density)
  "milk": 240,
  "buttermilk": 240,
  "water": 240,
  "oil": 218, // vegetable oil ~218 g/c
  // Other common
  "butter": 227, // 1 cup butter ~ 227g (2 sticks)
};

// Unit conversion helpers
const VOLUME_TO_TSP = {
  tsp: 1,
  teaspoon: 1,
  teaspoons: 1,
  tbsp: 3,
  tablespoon: 3,
  tablespoons: 3,
  cup: 48,
  cups: 48,
};

const TSP_TO_ML = 4.92892; // 1 tsp in ml

function normalizeUnicodeFractions(str) {
  return str
    .replace(/½/g, ' 1/2')
    .replace(/⅓/g, ' 1/3')
    .replace(/⅔/g, ' 2/3')
    .replace(/¼/g, ' 1/4')
    .replace(/¾/g, ' 3/4')
    .replace(/⅛/g, ' 1/8');
}

function parseMixedNumber(numStr) {
  // Supports forms like "1", "1.5", "1 1/2", "3/4"
  const parts = numStr.trim().split(/\s+/);
  let total = 0;
  for (const part of parts) {
    if (/^\d+\.\d+$/.test(part)) {
      total += parseFloat(part);
    } else if (/^\d+$/.test(part)) {
      total += parseInt(part, 10);
    } else if (/^(\d+)\/(\d+)$/.test(part)) {
      const [, n, d] = part.match(/(\d+)\/(\d+)/);
      total += parseInt(n, 10) / parseInt(d, 10);
    }
  }
  return total === 0 ? null : total;
}

function parseIngredientLine(line) {
  // Heuristic parser: quantity + unit + name (+ notes)
  // Examples: "2 cups all-purpose flour", "1 1/2 cups buttermilk", "1 tsp salt"
  if (!line || typeof line !== 'string') return null;
  const raw = normalizeUnicodeFractions(line.toLowerCase().trim());

  // Extract quantity (first number/mixed number)
  const qtyMatch = raw.match(/^(\d+[\d\s\/.]*)/);
  let quantity = null;
  let rest = raw;
  if (qtyMatch) {
    quantity = parseMixedNumber(qtyMatch[1]);
    rest = raw.slice(qtyMatch[0].length).trim();
  }

  // Extract unit (tsp, tbsp, cup(s), grams, g, ml, etc.)
  let unit = null;
  let nameAndNotes = rest;
  const unitMatch = rest.match(/^(cups?|tbsps?|tbsp|tablespoons?|teaspoons?|tsps?|tsp|grams?|g|ml|milliliters?|liters?|l|oz|ounces?|pounds?|lbs?)\b/);
  if (unitMatch) {
    unit = unitMatch[0];
    nameAndNotes = rest.slice(unit.length).trim();
  }

  // Name is the remainder until comma or parentheses
  let name = nameAndNotes.split(/[,(]/)[0].trim();
  let notes = nameAndNotes.slice(name.length).trim();
  if (notes.startsWith(',') || notes.startsWith('(')) notes = notes.slice(1).trim();

  if (!name) name = raw; // fallback if we couldn't split

  return { quantity, unit, name, notes, original: line };
}

function findDensityForName(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  // Find best match by substring search over keys
  let bestKey = null;
  for (const key of Object.keys(DENSITY_G_PER_CUP)) {
    if (n.includes(key)) {
      bestKey = key;
      break;
    }
  }
  return bestKey ? DENSITY_G_PER_CUP[bestKey] : null;
}

function scaleIngredient(ing, factor) {
  if (!ing) return ing;
  const out = { ...ing };
  if (typeof out.quantity === 'number') out.quantity = out.quantity * factor;
  return out;
}

function toMlFrom(ing) {
  // Convert volume units to ml when possible
  if (!ing || !ing.unit || typeof ing.quantity !== 'number') return null;
  const tsp = VOLUME_TO_TSP[ing.unit];
  if (!tsp) return null;
  const ml = ing.quantity * tsp * TSP_TO_ML;
  return ml;
}

function toGramsFrom(ing) {
  // Convert to grams. Prefer density if available, else try mass units, else null
  if (!ing || typeof ing.quantity !== 'number') return null;
  const unit = ing.unit || '';

  // Already grams
  if (unit === 'g' || unit === 'gram' || unit === 'grams') {
    return ing.quantity;
  }
  // Ounces to grams
  if (unit === 'oz' || unit === 'ounce' || unit === 'ounces') {
    return ing.quantity * 28.3495;
  }
  // Pounds to grams
  if (unit === 'lb' || unit === 'lbs' || unit === 'pound' || unit === 'pounds') {
    return ing.quantity * 453.592;
  }

  // Volume to grams needs density
  const density = findDensityForName(ing.name);
  if (!density) return null;

  // Convert to cups first
  let cups = null;
  if (unit === 'cup' || unit === 'cups') {
    cups = ing.quantity;
  } else if (unit === 'tbsp' || unit === 'tablespoon' || unit === 'tbsps' || unit === 'tablespoons') {
    cups = ing.quantity / 16; // 16 tbsp in a cup
  } else if (unit === 'tsp' || unit === 'teaspoon' || unit === 'tsps' || unit === 'teaspoons') {
    cups = ing.quantity / 48; // 48 tsp in a cup
  } else if (unit === 'ml' || unit === 'milliliter' || unit === 'milliliters') {
    cups = ing.quantity / 240; // approx
  } else if (!unit) {
    // No unit found; cannot convert reliably
    return null;
  }

  if (cups == null) return null;
  return cups * density;
}

function convertIngredient(ing, targetUnitSystem = 'metric') {
  const out = { ...ing };
  if (targetUnitSystem === 'metric') {
    const grams = toGramsFrom(out);
    if (grams != null) {
      return { ...out, quantity: grams, unit: 'g' };
    }
    const ml = toMlFrom(out);
    if (ml != null) {
      return { ...out, quantity: ml, unit: 'ml' };
    }
    return out; // fallback if unknown
  } else if (targetUnitSystem === 'imperial') {
    // No-op for now; could add grams->cups for known densities
    return out;
  }
  return out;
}

function formatAmount(ing) {
  if (!ing || typeof ing.quantity !== 'number') return ing?.original || '';
  const qty = Math.round(ing.quantity * 100) / 100;
  return `${qty} ${ing.unit ? ing.unit : ''} ${ing.name}`.trim();
}

function buildStructuredIngredients(ingredientLines) {
  return ingredientLines
    .map(line => parseIngredientLine(line))
    .filter(Boolean);
}

module.exports = {
  parseIngredientLine,
  buildStructuredIngredients,
  scaleIngredient,
  convertIngredient,
  formatAmount,
}; 