# Sous Chef Agent

A modern, AI-powered sous chef assistant that helps you cook, learn, and get expert tips in the kitchen. This app combines a Vite + React frontend with an Express + OpenAI backend.

---

## Features

- **Conversational Cooking Assistant:**
  - Chat with an AI sous chef for recipes, cooking questions, and kitchen advice.
- **Recipe Parsing:**
  - Paste a recipe and get a step-by-step breakdown, including ingredients and estimated times.
- **Expert Cooking Tips:**
  - On every user input (question or recipe step), the app finds and injects the top 3 most relevant expert tips using vector similarity search.
- **Text-to-Speech (TTS):**
  - Enable TTS to have the assistant read responses aloud. Voice navigation for step-by-step cooking.
- **Minimalist, Elegant UI:**
  - Inspired by Zara.com: lots of white space, elegant typography, and a fashion-forward look.
- **Responsive & Accessible:**
  - Works on desktop and mobile, with accessible navigation and controls.

---

## How It Works

### Frontend (Vite + React)
- Modern React app with clean, minimalist design.
- Chat interface for user/assistant conversation.
- Recipe parsing and step navigation.
- TTS controls and voice command support.
- Displays expert tips for each step or question.

### Backend (Express + OpenAI)
- `/api/chat`: Handles chat messages, classifies user input, injects relevant expert tips, and queries OpenAI for responses.
- `/api/parse-recipe`: Parses pasted recipes into structured steps using OpenAI.
- `/api/relevant-tips`: Finds the top 3 relevant expert tips for any input using vector similarity (OpenAI embeddings + cosine similarity).
- Loads a knowledge base of expert cooking tips from `cookingTips.json`.

### OpenAI Integration
- Uses GPT-3.5-turbo for chat and recipe parsing.
- Uses `text-embedding-ada-002` for tip similarity search.
- Injects expert tips into the model context for more helpful, context-aware answers.

---

## Setup Instructions

### 1. Clone the Repo
```bash
git clone <your-repo-url>
cd sous-chef-agent
```

### 2. Install Dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Set Up Environment Variables
- In `backend/.env`, add your OpenAI API key:
  ```
  OPENAI_API_KEY=sk-...
  ```

### 4. Run the App
- **Backend:**
  ```bash
  cd backend
  node index.js
  ```
- **Frontend:**
  ```bash
  cd frontend
  npm run dev
  ```
- Visit [http://localhost:5173](http://localhost:5173)

---

## Usage Guide

- **Chat:** Type or paste a recipe, ask a cooking question, or just say hi.
- **Recipe Parsing:** Paste a full recipe to get a step-by-step breakdown.
- **Expert Tips:** For every question or step, the top 3 relevant expert tips are shown and used by the AI.
- **TTS:** Click the speaker icon to enable/disable text-to-speech. When enabled, the assistant will read new responses aloud.
- **Voice Navigation:** Use voice commands ("next", "repeat", "back") during step-by-step cooking.

---

## Customization

- **Styling:**
  - Edit `frontend/src/App.zara.css` for UI tweaks.
  - Fonts: Playfair Display (logo), Inter (UI).
- **Expert Tips:**
  - Add or edit tips in `backend/cookingTips.json`.
- **Model:**
  - Change OpenAI model in `backend/index.js` if desired.

---

## Troubleshooting
- **OpenAI API errors:** Check your API key and network connection.
- **TTS not working:** Make sure your browser supports `window.speechSynthesis` and voices are loaded.
- **Blank screen:** Check browser console for errors and ensure both backend and frontend are running.

---

## Credits & License

- Created by [Your Name/Team].
- Powered by [OpenAI](https://openai.com/).
- UI inspired by [Zara.com](https://zara.com/).
- MIT License. 
