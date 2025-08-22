import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, ChefHat, Clock, Users, Speaker } from 'lucide-react';
import RecipeMessage from './RecipeMessage';
import VoiceStateBar from './components/VoiceStateBar.jsx';
import VoiceMicButton from './components/VoiceMicButton.jsx';
import StepCard from './components/StepCard.jsx';
import { getApiUrl } from './utils/apiConfig.js';

const VoiceAssistant = () => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'system',
      content: `You are a friendly, funny Gen Z cooking bestie named Sous Chef. You're here to talk me through recipes like we're FaceTiming in the kitchen.

Your tone is playful, casual, and supportive — like a chill best friend who hypes me up without being annoying. Keep it short, conversational, and use Gen Z phrasing.

IMPORTANT:
- Never dump the whole recipe at once.
- Guide me step-by-step.
- BE SPECIFIC: Give precise measurements for ingredients (e.g., "add 2 tbsp of butter") instead of vague amounts.
- When listing ingredients for the user to gather, do NOT include specific measurements unless necessary for identification (e.g., "a packet of yeast"). Format each ingredient as a separate line, with the ingredient name in **bold** for readability. Avoid bullet points or markdown symbols that may be read aloud by TTS (e.g., asterisks or dashes). Use line breaks instead of lists. Avoid reading the markdown aloud, only display the associated bold text in the chat.
- Wait for me to say "I'm ready" or "What's next?" before continuing.
- If I say something like "thank you" or "I'm done," wrap it up warmly.
- AVOID THESE WORDS: Do not use "squad," "chopping game," "yasss queen," "no cap," or references to TikTok or celebrities. Keep it natural and clever.
- If the recipe comes from a known source and has strong reviews or ratings, mention that in the introduction to build user confidence. Highlight the source and the number or quality of reviews, if available (e.g., 'adapted from NYT Cooking — 4.8 stars with 2,000+ reviews'). Avoid links unless requested.
- When introducing a recipe, always start by previewing it clearly and kindly: Name the recipe with an emoji, share the estimated total cooking time (rounded to the nearest 5 minutes), share how many steps it has, then say exactly: "Let me know if you're ready to start cooking or if you want a quick overview first!"

DATA & ACCURACY:
- Never invent or guess quantities, conversions, or scaled amounts.
- Rely on the app-provided recipe state for amounts and units. If the state is missing a value, ask a concise clarifying question.
- If the user requests scaling or unit conversion, say you'll apply it, then wait for the app to provide updated amounts.

👩‍🍳 RECIPE FLOW LOGIC
- Always maximize cooking efficiency. If one step takes time (e.g., pasta boiling, dough resting, oven preheating), use that downtime to guide the user through a different part of the recipe.
- Example: While pasta is boiling, have the user start prepping or cooking the sauce — don't wait for the pasta to finish before starting the next component.
- If multiple components are involved, prompt them to work in parallel when safe and manageable.
- Do not make users sit idle or wait unnecessarily between steps.`
    }
  ]);
  const [demoMessageIndex, setDemoMessageIndex] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesEndRef = useRef(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const isGeneratingRef = useRef(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');

  // NEW: WebAudio for silence end-pointer
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const rafIdRef = useRef(null);
  const hadSpeechRef = useRef(false);
  const silenceFramesRef = useRef(0);

  // NEW: Ref to currently playing TTS for barge-in/interrupt
  const ttsAudioRef = useRef(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Demo conversation examples that cycle
  const demoConversations = [
    {
      question: 'How do I make perfect risotto?',
      answer: "I'll guide you through creamy risotto step by step! First, let's warm your broth..."
    },
    {
      question: 'What ingredients do I need for pad thai?',
      answer: "Great choice! You'll need rice noodles, tamarind paste, fish sauce, eggs, and fresh herbs. I'll walk you through the prep and cooking process."
    },
    {
      question: 'How long should I knead bread dough?',
      answer: "Knead for 8-10 minutes until smooth and elastic. I'll time it with you!"
    }
  ];

  // Cycle through demo messages
  useEffect(() => {
    if (!hasStarted) {
      // Show initial question after a brief delay
      const initialQuestionTimeout = setTimeout(() => {
        setDemoMessageIndex(0);
        setTimeout(() => {
          setShowAnswer(true);
        }, 2000); // Wait 2 seconds after question appears
      }, 1000);

      const interval = setInterval(() => {
        // Hide both question and answer together
        setShowAnswer(false);
        setTimeout(() => {
          // Change to next question and show it immediately
          setDemoMessageIndex((prev) => (prev + 1) % demoConversations.length);
          setTimeout(() => {
            // Show answer for new question
            setShowAnswer(true);
          }, 2000); // Wait 2 seconds after question appears
        }, 1000); // Wait 1 second after hiding
      }, 8000); // Total cycle: 8 seconds
      
      return () => {
        clearInterval(interval);
        clearTimeout(initialQuestionTimeout);
      };
    }
  }, [hasStarted, demoConversations.length]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // This effect runs when a new user message is added, triggering the assistant's response.
  useEffect(() => {
    if (messages.length > 1 && messages[messages.length - 1].role === 'user') {
      generateResponse();
    }
  }, [messages]);

  // Helper function to filter out non-English or gibberish transcriptions
  const isLikelyNonEnglishOrGibberish = (text) => {
    // Check for common non-English patterns that Whisper picks up from noise
    const nonEnglishPatterns = [
      /[\u0400-\u04FF]/g,     // Cyrillic (Russian, Ukrainian, etc.)
      /[\u4E00-\u9FFF]/g,     // Chinese characters
      /[\u3040-\u309F]/g,     // Hiragana (Japanese)
      /[\u30A0-\u30FF]/g,     // Katakana (Japanese)
      /[\u0590-\u05FF]/g,     // Hebrew
      /[\u0600-\u06FF]/g,     // Arabic
      /[\u1100-\u11FF]/g,     // Korean Hangul
    ];

    // Check if text contains non-English characters
    for (const pattern of nonEnglishPatterns) {
      if (pattern.test(text)) return true;
    }

    // Check for very short meaningless transcriptions (likely noise)
    if (text.length < 3) return true;

    // Check for gibberish patterns (repeated characters, no vowels, etc.)
    const hasVowels = /[aeiouAEIOU]/.test(text);
    const isRepeatedChar = /^(.)\1+$/.test(text.replace(/\s/g, ''));
    
    if (!hasVowels || isRepeatedChar) return true;

    return false;
  };

  // NEW: short earcon + optional haptic when EoU detected
  const playAckEarcon = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880; // A5
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.14);
      if (navigator.vibrate) navigator.vibrate(10);
      setTimeout(() => ctx.close(), 300);
    } catch {}
  };

  const startRecording = async () => {
    console.log('🎙️ Starting recording...');
    setIsListening(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // --- WebAudio setup for silence end-pointer ---
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      const buffer = new Float32Array(analyserRef.current.fftSize);
      sourceNodeRef.current.connect(analyserRef.current);

      hadSpeechRef.current = false;
      silenceFramesRef.current = 0;

      const rms = (arr) => {
        let sum = 0; for (let i = 0; i < arr.length; i++) { const v = arr[i]; sum += v * v; }
        return Math.sqrt(sum / arr.length);
      };

      const SILENCE_THRESHOLD = 0.012; // tweak empirically
      const REQUIRED_SILENCE_MS = 500;  // 0.5s of silence to end
      const FPS = 60;                    // approx frames per second via rAF
      const REQUIRED_SILENCE_FRAMES = Math.round((REQUIRED_SILENCE_MS / 1000) * FPS);

      const monitor = () => {
        analyserRef.current.getFloatTimeDomainData(buffer);
        const level = rms(buffer);
        if (level > SILENCE_THRESHOLD) {
          hadSpeechRef.current = true;
          silenceFramesRef.current = 0;
        } else if (hadSpeechRef.current) {
          silenceFramesRef.current += 1;
          if (silenceFramesRef.current >= REQUIRED_SILENCE_FRAMES) {
            // End-of-utterance detected
            playAckEarcon();
            // Show immediate processing state
            setIsProcessing(true);
            stopRecording();
            return;
          }
        }
        rafIdRef.current = requestAnimationFrame(monitor);
      };

      rafIdRef.current = requestAnimationFrame(monitor);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🛑 Recording stopped');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleTranscription(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      
      // Fallback: hard stop at 10s to avoid getting stuck
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log('⏱️ Max duration reached, stopping.');
          playAckEarcon();
          setIsProcessing(true);
          stopRecording();
        }
      }, 10000);

    } catch (error) {
      console.error('❌ Error starting recording:', error);
      setIsListening(false);
    }
  };

  const stopRecording = () => {
    console.log('⏹️ Stopping recording...');
    setIsListening(false);

    // stop VAD monitoring
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = null;

    try {
      if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
      if (analyserRef.current) analyserRef.current.disconnect();
      sourceNodeRef.current = null;
      analyserRef.current = null;
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    } catch {}

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleTranscription = async (audioBlob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch(getApiUrl('/api/transcribe'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      const transcript = data.transcription?.trim();
      console.log('📝 Transcript:', transcript);

      if (!transcript || isLikelyNonEnglishOrGibberish(transcript)) {
        console.warn('Filtered out non-English/gibberish transcription:', transcript);
        setIsProcessing(false);
        await startRecording(); // Loop back to listening
      return;
    }

      // Intercept math/state intents before sending to LLM
      const lower = transcript.toLowerCase();
      const scaleMatch = lower.match(/^(double|triple|halve|scale to\s*(\d+))|^(scale)\s*(\d+)x/);
      const convertMatch = lower.match(/(convert|switch) (to )?(metric|imperial|grams|ml)/);
      const howMuchMatch = lower.match(/^(how much|what amount|quantity of)\s+(.+?)(\?|$)/);

      if (scaleMatch) {
        let factor = 1;
        if (lower.includes('double')) factor = 2;
        else if (lower.includes('triple')) factor = 3;
        else if (lower.includes('halve')) factor = 0.5;
        else {
          const num = lower.match(/(\d+)/);
          if (num) factor = Number(num[1]);
        }
        try {
          const res = await fetch(getApiUrl('/api/recipe/apply'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: { type: 'scale', factor } })
          });
          const json = await res.json();
          const msg = `Okay, scaling the recipe to ${factor}x. Ask me for any ingredient amount when you need it.`;
          setMessages(prev => [...prev, { role: 'user', content: transcript }, { role: 'assistant', content: msg }]);
          await speakWithOpenAI(msg);
          // Re-arm listening
          await new Promise(r => setTimeout(r, 150));
          await startRecording();
          return;
        } catch (e) {
          console.error('scale apply error', e);
        }
      }

      if (convertMatch) {
        const target = lower.includes('metric') || lower.includes('grams') || lower.includes('ml') ? 'metric' : 'imperial';
        try {
          const res = await fetch(getApiUrl('/api/recipe/apply'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: { type: 'convert_units', target } })
          });
          const json = await res.json();
          const msg = `Got it. I switched units to ${target}.`;
          setMessages(prev => [...prev, { role: 'user', content: transcript }, { role: 'assistant', content: msg }]);
          await speakWithOpenAI(msg);
          await new Promise(r => setTimeout(r, 150));
          await startRecording();
          return;
        } catch (e) {
          console.error('convert apply error', e);
        }
      }

      if (howMuchMatch) {
        // Extract ingredient name heuristically
        const name = howMuchMatch[2]?.trim();
        if (name) {
          try {
            const url = getApiUrl(`/api/recipe/ingredient?name=${encodeURIComponent(name)}`);
            const res = await fetch(url);
            const json = await res.json();
            if (json?.status === 'ok') {
              const msg = `${json.text}.`;
              setMessages(prev => [...prev, { role: 'user', content: transcript }, { role: 'assistant', content: msg }]);
              await speakWithOpenAI(msg);
              await new Promise(r => setTimeout(r, 150));
              await startRecording();
              return;
            }
          } catch (e) {
            console.error('ingredient fetch error', e);
          }
        }
      }

      // Default: Add the user message to state. The useEffect will trigger the API call.
      const userMessage = { role: "user", content: transcript };
      setMessages(prev => [...prev, userMessage]);

    } catch (error) {
      console.error('❌ Error during transcription:', error);
      setIsProcessing(false);
    }
  };

  const tryInitRecipeFromUserText = async (text) => {
    // Heuristic: if user pasted a long text that looks like a recipe, initialize
    const looksLikeRecipe = /ingredients?:|yield:|serves|instructions?:|preheat|oven|whisk|mix|bake/i.test(text) || text.split(/\n/).length >= 6;
    if (!looksLikeRecipe) return false;
    try {
      setIsParsing(true);
      const res = await fetch(getApiUrl('/api/recipe/init'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe: text, isParsed: false })
      });
      const json = await res.json();
      if (json?.status === 'ok') {
        const msg = `Got it. I loaded the recipe "${json.title || ''}". Ask me to scale or convert units anytime.`.trim();
        setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
        await speakWithOpenAI(msg);
        return true;
      }
    } catch (e) {
      console.error('init recipe error', e);
    } finally {
      setIsParsing(false);
    }
    return false;
  };

  // Modify generateResponse to attempt initialization if the last user message looks like a recipe
  const generateResponse = async () => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setIsProcessing(false);

    try {
      const lastUserMessage = messages[messages.length - 1];

      // Try to initialize recipe if the user pasted one
      if (lastUserMessage?.role === 'user') {
        const inited = await tryInitRecipeFromUserText(lastUserMessage.content || '');
        if (inited) {
          // Re-arm listening and skip LLM call for this turn
          await new Promise(r => setTimeout(r, 150));
          await startRecording();
          return;
        }
      }

      console.log("📤 Sending full history:", messages);

      const response = await fetch(getApiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages }), // Send the full, current messages state
      });

      if (!response.ok) {
        throw new Error('Chat API failed');
      }

      const data = await response.json();
      const assistantReply = data.reply;
      console.log('🤖 Assistant reply:', assistantReply);

      const assistantMessage = { role: "assistant", content: assistantReply };
      setMessages(prev => [...prev, assistantMessage]); // Use functional update

      await speakWithOpenAI(assistantReply);

      if (!lastUserMessage.content.toLowerCase().includes('thanks chef')) {
        console.log('🔁 Looping: Listening again...');
        // Short re-arm to avoid clipping last TTS word
        await new Promise(r => setTimeout(r, 150));
        await startRecording();
      } else {
        console.log('👋 Conversation ended by user.');
      }

    } catch (error) {
      console.error('❌ Error generating response:', error);
      const fallbackMessage = {
        role: 'assistant',
        content: "I'm sorry, I had trouble processing that. Could you please try again?"
      };
      setMessages(prev => [...prev, fallbackMessage]); // Use functional update
    } finally {
      isGeneratingRef.current = false;
    }
  };

  const speakWithOpenAI = async (text) => {
    try {
      // Stop any currently playing TTS (barge-in safety)
      if (ttsAudioRef.current) {
        try { ttsAudioRef.current.pause(); } catch {}
        try { URL.revokeObjectURL(ttsAudioRef.current.src); } catch {}
        ttsAudioRef.current = null;
      }

      const response = await fetch(getApiUrl('/api/tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      console.log('🔊 TTS audioBlob size:', audioBlob.size);

      if (audioBlob.size === 0) {
        throw new Error('Empty audio blob received from backend');
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      ttsAudioRef.current = audio;

      return new Promise((resolve, reject) => {
        audio.onplay = () => setIsSpeaking(true);
        audio.onended = () => {
          console.log('✅ TTS playback finished');
          setIsSpeaking(false);
          try { URL.revokeObjectURL(audioUrl); } catch {}
          resolve();
        };
        
        audio.onerror = (e) => {
          console.error('❌ Audio playback error:', e);
          setIsSpeaking(false);
          try { URL.revokeObjectURL(audioUrl); } catch {}
          reject(new Error('Audio playback error'));
        };
        
        audio.play().catch((err) => {
          console.error('❌ Audio play() error:', err);
          setIsSpeaking(false);
          try { URL.revokeObjectURL(audioUrl); } catch {}
          reject(err);
        });
      });
      
    } catch (error) {
      console.error('❌ Error in speakWithOpenAI:', error);
      throw error;
    }
  };

  // Allow user to manually barge-in by tapping mic during TTS
  const interruptTTSIfPlaying = () => {
    if (ttsAudioRef.current) {
      try { ttsAudioRef.current.pause(); } catch {}
      ttsAudioRef.current.src = '';
      ttsAudioRef.current = null;
    }
  };

  const handleMicClick = async () => {
    if (!hasStarted) {
      setHasStarted(true);
      const greeting = "Hey! What are we making today?";
      const initialMessage = { role: 'assistant', content: greeting };
      
      // Use a functional update to ensure we're building on the previous state
      setMessages(prev => [...prev, initialMessage]);

      try {
        await speakWithOpenAI(greeting);
        await startRecording();
      } catch (error) {
        console.error('Error with greeting TTS:', error);
        await startRecording();
      }
    } else if (isListening) {
      stopRecording();
    } else if (!isProcessing && !isGeneratingRef.current) {
      // If TTS is playing, interrupt and start listening (barge-in)
      interruptTTSIfPlaying();
      await startRecording();
    }
  };

  const formatTime = (date) => {
    if (!date || !(date instanceof Date)) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper: group-start detection for badges
  const isGroupStart = (index, msgs) => index === 0 || msgs[index - 1].role !== msgs[index].role;

  if (!hasStarted) {
    // Landing Screen
    return (
      <div className="hero">
        {/* Hero Section */}
        <div className="container" style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '72px 24px',
          textAlign: 'center',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          {/* Logo */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '32px'
          }}>
            <ChefHat size={32} color="#C6A664" />
            <h1 style={{
              fontSize: '28px',
              fontWeight: '800',
              color: '#1f2937',
              margin: 0,
              letterSpacing: '-0.02em'
            }}>
              PrepTalk
            </h1>
          </div>

          {/* Main Headlines */}
          <div className="stack title-plate">
            <h2 className="title" style={{ margin: '0 0 40px 0' }}>Your hands-free cooking companion</h2>
            <p className="subtitle" style={{ margin: '0 0 80px 0' }}>Get recipes, steps, and tips while you cook — just talk.</p>
          </div>

          {/* Demo Conversation Preview */}
          <div className="hero-preview" style={{
            minHeight: '140px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            maxWidth: '640px',
            overflow: 'hidden',
            padding: '24px 32px',
            marginBottom: 60
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              width: '100%'
            }}>
              {/* Instructional badge */}
              <div style={{
                alignSelf: 'center',
                background: '#F4E4C1',
                border: '1px solid #DAA520',
                borderRadius: 9999,
                padding: '8px 16px',
                fontWeight: 600,
                fontSize: 14,
                marginBottom: 16
              }}>
                Try saying something like:
              </div>
              {/* User Question (preview using chat styles with icon) */}
              <div className="chat-item user" style={{ margin: '8px 0 0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
                <div className="chat-bubble" style={{ padding: '14px 18px', maxWidth: '78%', marginLeft: 'auto', marginRight: 0 }}>
                  {demoConversations[demoMessageIndex].question}
                </div>
                <span className="icon icon--user" style={{ marginLeft: 16, display: 'inline-flex', alignItems: 'center' }}>
                  <Users size={24} />
                </span>
              </div>

              {/* Assistant Answer */}
              <div className="chat-item assistant" style={{ margin: '0 0 8px', opacity: showAnswer ? 1 : 0, transition: 'opacity 0.5s ease', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', width: '100%' }}>
                {showAnswer && (
                  <>
                    <span className="icon icon--chef" style={{ marginLeft: 0, marginRight: 16, display: 'inline-flex', alignItems: 'center' }}>
                      <ChefHat size={24} />
                    </span>
                    <div className="chat-bubble" style={{ padding: '14px 18px', maxWidth: '86%', marginLeft: 0, marginRight: 'auto' }}>
                    {demoConversations[demoMessageIndex].answer}
                  </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Main CTA */}
          <div style={{ width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            onClick={handleMicClick}
              className="cta-mic"
            aria-label="Start listening"
          >
            <Mic size={28} />
              <div className="waves" aria-hidden="true"><i></i><i></i><i></i></div>
          </button>
          </div>

          <p className="cta-copy" style={{ marginTop: 40 }}>Tap to start cooking</p>

        </div>

        
      </div>
    );
  }

  // Main chat UI
  return (
    <div className="light-chat" style={{
      fontFamily: 'Inter, sans-serif',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #f4cea6 0%, #e7a869 100%)',
      color: '#1a1a1a'
    }}>
      {/* Header */}
      <header style={{ padding: 0, borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ChefHat size={22} color="var(--color-text)" />
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>PrepTalk</h1>
          </div>
        </div>
      </header>

      {/* Message Area */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* Onboarding hint */}
        {messages.filter(m=>m.role!=='system').length === 0 && !isListening && !isProcessing && !isSpeaking && (
          <div className="onboarding-hint">
            Say “What should I make with chicken?” or “Start a 10‑minute timer”
          </div>
        )}
        {/* Step card removed for a cleaner chat-first flow */}
        {/* Messages */}
        {/* compute last assistant index inline by mapping twice isn't efficient; using local var */}
        {(() => {
          const lastAssistantIndex = [...messages].map((m,i)=>({m,i})).filter(x=>x.m.role==='assistant').map(x=>x.i).pop();
          return messages.map((message, index) => (
          message.role !== 'system' && (
              <div key={index} className={`msg-row ${message.role === 'user' ? 'user' : 'assistant'}`}>
                {message.role !== 'user' && (
                  <span className="icon icon--chef" aria-hidden="true" style={{marginRight:12, display:'inline-flex', alignItems:'center'}}>
                    <ChefHat size={24} />
                  </span>
                )}
                <div className={`bubble ${message.role === 'user' ? 'user' : 'assistant'}`}>
                  {message.role === 'user' ? message.content : <RecipeMessage markdownText={message.content} />}
                </div>
                {message.role === 'user' && (
                  <span className="icon icon--user" aria-hidden="true" style={{marginLeft:12, display:'inline-flex', alignItems:'center'}}>
                    <Users size={24} />
                  </span>
              )}
            </div>
            )
          ));
        })()}

        {/* Real-time user transcription bubble while listening */}
        {isListening && interimTranscript && (
          <div className="msg-row user">
            <div className="bubble user transcribing">{interimTranscript}</div>
          </div>
        )}

        {/* Typing / processing indicator */}
        {isProcessing && (
          <div className="msg-row assistant">
            <div className="typing-indicator"><span/><span/><span/></div>
          </div>
        )}
        {/* Auto-scroll target */}
        <div ref={messagesEndRef} />
      </main>

      {/* Voice Dock */}
      <div className="voice-dock">
        <div className="voice-status">
          {isListening ? (
            <span className="status listening" style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>Listening…</span>
          ) : isProcessing ? (
            <span className="status thinking" style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>Chef is responding…</span>
          ) : isSpeaking ? (
            <span className="status speaking" style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>Chef is speaking…</span>
          ) : (
            <span className="status idle" style={{ fontSize: '16px', fontWeight: '500', color: '#666666' }}>Tap the mic to speak</span>
          )}
          <div className={`waveform ${(isListening || isSpeaking) ? 'active' : ''}`}>
            <i/><i/><i/><i/><i/>
          </div>
        </div>

        <button
          className={`mic-cta ${isListening ? 'listening' : isSpeaking ? 'speaking' : isProcessing ? 'thinking' : ''}`}
          aria-label="Tap to speak"
          onClick={handleMicClick}
          disabled={isListening}
        >
          <Mic size={28} />
        </button>

        
      </div>
    </div>
  );
};

export default VoiceAssistant;
