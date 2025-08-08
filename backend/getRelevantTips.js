require('dotenv').config();
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Compute cosine similarity between two vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Given the current recipe step text, return the 3 most relevant cooking tips.
 * @param {string} currentStepText
 * @param {Array} cookingTips
 * @returns {Promise<Array>} Array of top 3 tip objects
 */
async function getRelevantTips(currentStepText, cookingTips) {
  // 1. Get embedding for the user query (current step)
  const userEmbedResp = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: currentStepText
  });
  const userEmbedding = userEmbedResp.data[0].embedding;

  // 2. Get embeddings for all tips (batch for efficiency)
  //    If tips are static, you may want to precompute and cache these.
  const tipTexts = cookingTips.map(tip => tip.tip);
  const tipEmbedResp = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: tipTexts
  });
  const tipEmbeddings = tipEmbedResp.data.map(obj => obj.embedding);

  // 3. Compute cosine similarity between user step and each tip
  const scoredTips = cookingTips.map((tip, idx) => ({
    tip,
    score: cosineSimilarity(userEmbedding, tipEmbeddings[idx])
  }));

  // 4. Sort by similarity (descending) and return top 3
  scoredTips.sort((a, b) => b.score - a.score);
  return scoredTips.slice(0, 3).map(obj => obj.tip);
}

module.exports = { getRelevantTips }; 