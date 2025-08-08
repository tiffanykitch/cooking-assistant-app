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

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors({
  origin: 'http://localhost:5173',
}));

app.use(express.json());

// Configure multer for file uploads (audio for Whisper)
const upload = multer({ dest: 'uploads/' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load cooking tips knowledge base once at startup
const cookingTips = JSON.parse(fs.readFileSync(path.join(__dirname, 'cookingTips.json'), 'utf8'));

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
    const { messages, lastUserMessage } = req.body;

    // Validate messages array
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid message format - expected messages array' });
    }

    // Use the messages as-is from frontend (which now always includes system prompt)
    const fullConversation = messages;

    // Clean up message format - map any non-standard roles
    const cleanedMessages = fullConversation.map(msg => ({
      role: msg.role === 'agent' ? 'assistant' : msg.role,
      content: msg.content || msg.text || '' // Handle both content and text fields
    }));

    console.log('📥 Received from frontend:', messages.length, 'messages');
    console.log('📥 Frontend messages:', messages.map(m => `${m.role}: ${(m.content || m.text || '').substring(0, 50)}...`));
    console.log('🤖 Sending to GPT:', cleanedMessages.length, 'messages');
    console.log('🤖 Final GPT messages:', cleanedMessages.map(m => `${m.role}: ${m.content.substring(0, 50)}...`));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: cleanedMessages,
      temperature: 0.7,
      max_tokens: 150 // Keep responses concise for voice
    });

    const reply = completion.choices[0].message.content;
    console.log('✅ GPT reply:', reply);

    res.json({ reply });

  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ error: 'Failed to get response from GPT' });
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
