# PrepTalk — Your Hands‑Free AI Sous Chef

PrepTalk is a modern, voice‑first cooking companion. Speak naturally, get step‑by‑step guidance, and keep cooking without touching your screen. Under the hood, it pairs a Vite + React frontend with an Express + OpenAI backend for real‑time speech‑to‑text, smart recipe flow, and natural text‑to‑speech.

---

## Why PrepTalk

- **Voice‑first cooking**: Tap the mic, talk to your sous chef, and keep your hands free.
- **Real‑time flow**: Auto‑loops listening → thinking → speaking until you say “thanks chef.”
- **Step‑by‑step recipes**: Never dump the whole recipe; guided, timed steps with smart parallelization.
- **Natural TTS**: Clear, friendly voice using OpenAI TTS streamed back as MP3.
- **Robust STT**: Transcription with Whisper; filters gibberish/non‑English noise to reduce false triggers.
- **Production‑ready APIs**: Simple endpoints for chat, parsing, STT, TTS, and tip retrieval.

---

## Features

- **Conversational cooking assistant** powered by `gpt-4o` with a friendly, concise style.
- **Voice loop UX**:
  - Press once to start; the app listens, transcribes, replies, speaks, and listens again.
  - Say “thanks chef” to end.
- **Recipe runner** logic:
  - One step at a time; waits for “I’m ready/what’s next?”
  - Minimizes idle time by overlapping tasks when safe (e.g., prep while simmering).
  - Clear, specific measurements when instructing mid‑flow.
- **Recipe parsing**: Paste a recipe to get structured JSON (title, ingredients, steps with estimated minutes).
- **Whisper STT**: Uploads short `webm` snippets and returns accurate transcripts.
- **OpenAI TTS**: Uses `tts-1` with a natural voice; streamed back as MP3 for immediate playback.
- **Expert tips engine (API available)**: Retrieves top‑3 relevant tips via embeddings (`text-embedding-ada-002`).
- **Minimal, clean UI** with demo prompts and a landing screen to onboard new users.

---

## Architecture

- **Frontend**: React 19 + Vite 7
  - Main app: `frontend/src/VoiceAssistant.jsx`
  - Markdown rendering: `react-markdown`
  - Dev proxy: `/api` → `http://localhost:3000`
- **Backend**: Express 5
  - Routes in `backend/index.js`
  - OpenAI SDK for Chat (`gpt-4o`), Whisper STT (`whisper-1`), and TTS (`tts-1`)
  - File uploads via `multer` to `uploads/` (temporary)
- **Embeddings**: `text-embedding-ada-002` with cosine similarity in `backend/getRelevantTips.js`

---

## Quick Start

### Prerequisites
- Node.js 18+ (recommended)
- An OpenAI API key

### 1) Clone
```bash
git clone <your-repo-url>
cd sous-chef-agent
```

### 2) Install dependencies
- Backend deps are managed at the repo root:
```bash
npm install
```
- Frontend deps:
```bash
cd frontend && npm install
```

### 3) Configure environment
Create `backend/.env` with:
```
OPENAI_API_KEY=sk-...
```

### 4) Run
- Backend (port 3000):
```bash
node backend/index.js
```
- Frontend (port 5173):
```bash
cd frontend
npm run dev
```
Open `http://localhost:5173`.

---

## Usage

- Click the mic to start. Speak naturally (e.g., “How do I make risotto?”).
- The assistant replies, speaks the response, and starts listening again automatically.
- Say “thanks chef” to stop. Ask “what’s next?” to advance steps during recipes.

---

## API Reference
All endpoints are proxied under the frontend dev server at `/api` → `http://localhost:3000`.

### POST `/api/chat`
- Sends the full message history; returns assistant reply.
- Body:
```json
{
  "messages": [
    { "role": "system", "content": "You are..." },
    { "role": "user", "content": "How do I make risotto?" }
  ]
}
```
- Response:
```json
{ "reply": "Let’s start by warming your broth..." }
```

### POST `/api/parse-recipe`
- Input free‑form recipe text; returns structured JSON.
- Body:
```json
{ "recipe": "Recipe title...\nIngredients...\nSteps..." }
```
- Response:
```json
{
  "status": "ok",
  "recipe": {
    "title": "Creamy Risotto",
    "ingredients": ["Arborio rice", "Chicken stock", "Parmesan"],
    "steps": [
      { "step": 1, "instruction": "Warm the stock.", "estimated_time_min": 5 },
      { "step": 2, "instruction": "Sauté onions...", "estimated_time_min": 8 }
    ]
  }
}
```

### POST `/api/transcribe`
- Multipart form: `audio` = `audio/webm` blob (few seconds).
- Response:
```json
{ "transcription": "how do i make risotto" }
```

### POST `/api/tts`
- Body:
```json
{ "text": "Great choice! Let's get your broth warming." }
```
- Response: `audio/mpeg` (MP3 bytes)

### POST `/api/relevant-tips`
- Body:
```json
{ "step": "Stir constantly to avoid scorching the rice..." }
```
- Response:
```json
{ "status": "ok", "tips": [ { "title": "Tip title", "tip": "Tip text" } ] }
```

---

## Configuration Notes

- **Models**
  - Chat: `gpt-4o` (`/api/chat`)
  - Recipe parsing: `gpt-3.5-turbo` (`/api/parse-recipe`)
  - STT: `whisper-1` (`/api/transcribe`)
  - TTS: `tts-1` (`/api/tts`)
  - Embeddings: `text-embedding-ada-002` (tips engine)
- **Uploads**
  - Audio snippets are saved temporarily to `uploads/` and cleaned up after processing.
- **CORS**
  - Backend allows `http://localhost:5173` by default (see `backend/index.js`).

---

## Project Structure
```
sous-chef-agent/
  backend/
    index.js           # Express routes (chat, parse, tips, transcribe, TTS)
    getRelevantTips.js # Embeddings + cosine similarity
    cookingTips.json   # Tip knowledge base
  frontend/
    src/
      VoiceAssistant.jsx  # Primary voice-first UI
      RecipeMessage.jsx   # Nicely renders assistant markdown
      ttsUtils.js         # Preferred voice picker (browser TTS)
    vite.config.js        # /api proxy → :3000
```

---

## Roadmap
- Surface the expert tips panel during recipe steps
- Streaming chat responses and partial transcripts
- Multi-language STT/TTS
- Offline fallback TTS

---

## Credits & License
- Created by Tiffany K.
- Powered by [OpenAI](https://openai.com/)
- MIT License 
