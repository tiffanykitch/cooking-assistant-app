const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const multer = require('multer'); // New import
const { getRelevantTips } = require('./getRelevantTips');
const axios = require('axios'); // New import
const FormData = require('form-data'); // New import
const { buildStructuredIngredients, parseIngredientLine, scaleIngredient, convertIngredient, formatAmount } = require('./recipeMath');

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors({
  origin: [
    "https://loquacious-dango-585db1.netlify.app", // Netlify frontend URL
    "http://localhost:5173" // for local development
  ],
  credentials: true
}));

app.use(express.json());

// Helper: remove emojis and variation selectors
function stripEmojis(text) {
  if (!text) return text;
  // Remove most emoji ranges + variation selectors + skin tones
  return text
    .replace(/[\u2700-\u27BF]/g, '')
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\uFE0F\uFE0E]/g, '')
    .replace(/[\u200D]/g, '');
}

// Build a system prompt using conversation state
function buildSystemPrompt(state = {}) {
  const { stepType = 'passive', stepStatus = 'awaiting_start', recipeLocked = false } = state;
  return (
    `You are a hands-free cooking assistant.
Never suggest starting a new task while the current step is a “focus” task (hands required).
Only suggest concurrent tasks during “passive” steps (waiting for water to boil, dough to rise, baking, simmering).
Wait for explicit confirmation before giving the next step.
If silence occurs, do not end the session — instead, check in periodically.
When following a specific recipe, keep the ingredient list exactly as provided without changes.
Current step type: ${stepType}. Current step status: ${stepStatus}.
Always keep responses concise for voice.`
  );
}

// Enforce ingredient lock by appending a constraint note
function enforceIngredientLock(userText = '', state = {}) {
  const { recipeLocked = false, lockedIngredients = [] } = state;
  if (!recipeLocked || !Array.isArray(lockedIngredients) || lockedIngredients.length === 0) return userText;
  const lockedList = lockedIngredients.map(s => `- ${s}`).join('\n');
  const note = `\n\nConstraints: Ingredients are locked. Use exactly this list with no substitutions or added items.\n${lockedList}`;
  return `${userText}${note}`;
}

// Compute a suggested check-in time (ms) at ~75% of the step duration if provided
function computeCheckIn(state = {}) {
  const { stepStatus = 'awaiting_start', estimatedMs } = state;
  if (stepStatus !== 'in_progress') return null;
  const duration = typeof estimatedMs === 'number' && estimatedMs > 0 ? estimatedMs : 0;
  if (!duration) return null;
  return Math.floor(duration * 0.75);
}

// Configure multer for file uploads (audio for Whisper)
const upload = multer({ dest: 'uploads/' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load cooking tips knowledge base once at startup
const cookingTips = JSON.parse(fs.readFileSync(path.join(__dirname, 'cookingTips.json'), 'utf8'));

// In-memory simple session (single user) state for demo
const recipeSession = {
  base: null, // { title, ingredients: [string], steps: [...] }
  structuredIngredients: null, // parsed array
  scale: 1,
  unitSystem: 'imperial', // 'imperial' | 'metric'
};

app.get('/api/test', async (req, res) => {
  console.log('🔁 FE → BE connection working');
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say hello' }],
    });
    
    const message = completion.choices[0].message.content;
    console.log('✅ BE → OpenAI call succeeded:', message);

    res.json({ status: 'ok', message });
  } catch (error) {
    console.error('OpenAI error:', error.message);
    res.json({ status: 'error', message: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, lastUserMessage, state: clientState = {} } = req.body;

    // Validate messages array
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid message format - expected messages array' });
    }

    // Clone messages and optionally enforce ingredient lock on the latest user message
    const fullConversation = [...messages];
    const lastIdx = [...fullConversation].map((m,i)=>({i,m})).filter(x=> (x.m.role === 'user')).map(x=>x.i).pop();
    if (typeof lastIdx === 'number' && lastIdx >= 0) {
      const m = fullConversation[lastIdx];
      const lockedContent = enforceIngredientLock(m.content || m.text || '', clientState);
      fullConversation[lastIdx] = { ...m, content: lockedContent };
    }

    // Prepend system message with rules based on state
    const sys = { role: 'system', content: buildSystemPrompt(clientState) };
    const withSystem = [sys, ...fullConversation];

    // Clean up format for OpenAI
    const cleanedMessages = withSystem.map(msg => ({
      role: msg.role === 'agent' ? 'assistant' : msg.role,
      content: msg.content || msg.text || ''
    }));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: cleanedMessages,
      temperature: 0.7,
      max_tokens: 150 // Keep responses concise for voice
    });

    let reply = completion.choices[0].message.content || '';
    reply = stripEmojis(reply).trim();

    // Action hints for the client (music/check-in)
    const checkInAtMs = computeCheckIn(clientState); // null if N/A
    const actions = {};
    const { stepType = 'passive', stepStatus = 'awaiting_start', musicGenre = 'lofi' } = clientState;
    if (stepStatus === 'awaiting_start' || stepStatus === 'in_progress') {
      actions.playMusic = true;
      actions.musicGenre = musicGenre;
    }
    if (checkInAtMs) actions.checkInAtMs = checkInAtMs;

    res.json({ reply, actions });

  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ error: 'Failed to get response from GPT' });
  }
});

// Initialize recipe state from parsed recipe JSON or raw text
app.post('/api/recipe/init', async (req, res) => {
  try {
    const { recipe, isParsed } = req.body;
    if (!recipe) {
      return res.status(400).json({ error: 'Missing recipe' });
    }

    let recipeJson = null;
    if (isParsed) {
      recipeJson = recipe;
    } else if (typeof recipe === 'string') {
      // Optionally parse via LLM if string provided
      const prompt = `Extract the following recipe into JSON with this format:\n{\n  "title": string,\n  "ingredients": [string],\n  "steps": [ { "step": number, "instruction": string } ]\n}\nRecipe:\n${recipe}\nReturn only valid JSON.`;
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a sous chef recipe parser.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 600,
        temperature: 0,
      });
      const text = completion.choices?.[0]?.message?.content;
      recipeJson = JSON.parse(text);
    } else {
      return res.status(400).json({ error: 'Invalid recipe format' });
    }

    if (!recipeJson?.ingredients || !Array.isArray(recipeJson.ingredients)) {
      return res.status(422).json({ error: 'Recipe missing ingredients array' });
    }

    recipeSession.base = recipeJson;
    recipeSession.scale = 1;
    recipeSession.unitSystem = 'imperial';
    recipeSession.structuredIngredients = buildStructuredIngredients(recipeJson.ingredients);

    res.json({ status: 'ok', title: recipeJson.title || null, totalIngredients: recipeSession.structuredIngredients.length });
  } catch (error) {
    console.error('[recipe/init] error', error);
    res.status(500).json({ error: 'Failed to init recipe' });
  }
});

// Apply actions: scale or convert units
app.post('/api/recipe/apply', (req, res) => {
  try {
    const { action } = req.body;
    if (!recipeSession.base) return res.status(400).json({ error: 'No active recipe' });
    if (!action || !action.type) return res.status(400).json({ error: 'Missing action' });

    if (action.type === 'scale') {
      const factor = Number(action.factor);
      if (!factor || factor <= 0) return res.status(400).json({ error: 'Invalid scale factor' });
      recipeSession.scale = factor;
      return res.json({ status: 'ok', scale: recipeSession.scale });
    }

    if (action.type === 'convert_units') {
      const target = action.target === 'metric' ? 'metric' : 'imperial';
      recipeSession.unitSystem = target;
      return res.json({ status: 'ok', unitSystem: recipeSession.unitSystem });
    }

    return res.status(400).json({ error: 'Unknown action type' });
  } catch (error) {
    console.error('[recipe/apply] error', error);
    res.status(500).json({ error: 'Failed to apply action' });
  }
});

// Get the current amount for a specific ingredient name
app.get('/api/recipe/ingredient', (req, res) => {
  try {
    const { name } = req.query;
    if (!recipeSession.base) return res.status(400).json({ error: 'No active recipe' });
    if (!name) return res.status(400).json({ error: 'Missing ingredient name' });

    const ing = recipeSession.structuredIngredients.find(i => i.name.includes(String(name).toLowerCase()));
    if (!ing) return res.status(404).json({ error: 'Ingredient not found' });

    // Scale and convert
    const scaled = scaleIngredient(ing, recipeSession.scale || 1);
    const converted = convertIngredient(scaled, recipeSession.unitSystem || 'imperial');
    const formatted = formatAmount(converted);

    res.json({ status: 'ok', ingredient: converted, text: formatted, scale: recipeSession.scale, unitSystem: recipeSession.unitSystem });
  } catch (error) {
    console.error('[recipe/ingredient] error', error);
    res.status(500).json({ error: 'Failed to get ingredient' });
  }
});

app.post('/api/parse-recipe', async (req, res) => {
  try {
    const { recipe } = req.body;
    if (!recipe || typeof recipe !== 'string') {
      return res.status(400).json({ status: 'error', message: 'No recipe provided.' });
    }
    const prompt = `Extract the following recipe into JSON with this format:\n{\n  "title": string,\n  "ingredients": [string],\n  "steps": [ { "step": number, "instruction": string, "estimated_time_min": number } ]\n}\nRecipe:\n${recipe}\nReturn only valid JSON.`;
    console.log('[SousChefParse] Parsing recipe...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a sous chef recipe parser.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 600,
      temperature: 0,
    });
    const text = completion.choices?.[0]?.message?.content;
    let recipeJson = null;
    try {
      recipeJson = JSON.parse(text);
    } catch (err) {
      // Try to extract JSON from text
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        recipeJson = JSON.parse(match[0]);
      } else {
        throw err;
      }
    }
    if (!recipeJson || !recipeJson.title || !recipeJson.ingredients || !recipeJson.steps) {
      return res.status(422).json({ status: 'error', message: 'Could not parse recipe.' });
    }
    console.log('[SousChefParse] Parsed recipe:', recipeJson.title);
    res.json({ status: 'ok', recipe: recipeJson });
  } catch (error) {
    console.error('[SousChefParse] Error parsing recipe:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Unknown error.' });
  }
});

app.post('/api/relevant-tips', async (req, res) => {
  try {
    const { step } = req.body;
    if (!step || typeof step !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Missing or invalid step.' });
    }
    const tips = await getRelevantTips(step, cookingTips);
    res.json({ status: 'ok', tips });
  } catch (error) {
    console.error('[SousChef] Error retrieving relevant tips:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Unknown error.' });
  }
});

// --- OpenAI Whisper (Speech-to-Text) Route ---
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file || req.file.size === 0) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const originalPath = req.file.path;
    const webmPath = originalPath + '.webm';
    fs.renameSync(originalPath, webmPath);

    const formData = new FormData();
    formData.append('file', fs.createReadStream(webmPath), {
      filename: 'audio.webm',
      contentType: 'audio/webm',
    });
    formData.append('model', 'whisper-1');

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });

    console.log('[Backend] Whisper transcription response:', response.data);

    fs.unlinkSync(webmPath); // cleanup

    res.json({ transcription: response.data.text });
  } catch (error) {
    console.error('[Backend] Whisper API error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Whisper transcription failed' });
  }
});

// --- OpenAI Text-to-Speech (TTS) Route ---
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'No text provided for TTS.' });
    }
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova", // You can choose: 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
      input: text,
      response_format: "mp3",
    });

    // Convert the stream to a buffer
    const audioBuffer = Buffer.from(await mp3.arrayBuffer());

    // Set appropriate headers for audio streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send the buffer directly to the response
    res.send(audioBuffer);

  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'TTS failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`Express server listening on http://localhost:${PORT}`);
});
