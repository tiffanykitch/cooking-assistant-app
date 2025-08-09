import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, ChefHat, Clock, Users } from 'lucide-react';
import RecipeMessage from './RecipeMessage';
import VoiceStateBar from './components/VoiceStateBar.jsx';
import VoiceMicButton from './components/VoiceMicButton.jsx';
import StepCard from './components/StepCard.jsx';

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
      answer: "Great choice! You'll need rice noodles, tamarind paste, fish sauce..."
    },
    {
      question: 'How long should I knead bread dough?',
      answer: "Knead for 8-10 minutes until smooth and elastic. I'll time it with you!"
    }
  ];

  // Cycle through demo messages
  useEffect(() => {
    if (!hasStarted) {
      // Show initial answer after a brief delay so the first demo has a visible response
      const initialAnswerTimeout = setTimeout(() => {
        setShowAnswer(true);
      }, 1500);

      const interval = setInterval(() => {
        setShowAnswer(false);
        setTimeout(() => {
          setDemoMessageIndex((prev) => (prev + 1) % demoConversations.length);
          setTimeout(() => {
            setShowAnswer(true);
          }, 1500);
        }, 500);
      }, 4000);
      return () => {
        clearInterval(interval);
        clearTimeout(initialAnswerTimeout);
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

      const response = await fetch('/api/transcribe', {
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

      // Add the user message to state. The useEffect will trigger the API call.
      const userMessage = { role: "user", content: transcript };
      setMessages(prev => [...prev, userMessage]);

    } catch (error) {
      console.error('❌ Error during transcription:', error);
      setIsProcessing(false);
    }
  };

  const generateResponse = async () => {
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setIsProcessing(false);

    try {
      const lastUserMessage = messages[messages.length - 1];

      console.log("📤 Sending full history:", messages);

      const response = await fetch('/api/chat', {
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

      const response = await fetch('/api/tts', {
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

  if (!hasStarted) {
    // Landing Screen
    return (
      <div style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        minHeight: '100vh',
        backgroundColor: '#fafafa',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Hero Section */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
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
            <ChefHat size={32} color="#007bff" />
            <h1 style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#1a1a1a',
              margin: 0
            }}>
              PrepTalk
            </h1>
          </div>

          {/* Main Headlines */}
          <h2 style={{
            fontSize: '42px',
            fontWeight: '600',
            color: '#1a1a1a',
            margin: '0 0 16px 0',
            lineHeight: '1.2'
          }}>
            Your hands-free cooking companion
          </h2>

          <p style={{
            fontSize: '20px',
            color: '#666666',
            margin: '0 0 40px 0',
            lineHeight: '1.5'
          }}>
            Get step-by-step recipe guidance while your hands are busy cooking
          </p>

          {/* Demo Conversation Preview */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '32px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            minHeight: '140px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            maxWidth: '450px'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              width: '100%'
            }}>
              {/* User Question */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                opacity: 1,
                transition: 'opacity 0.3s ease'
              }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '14px',
                  backgroundColor: '#007bff',
                  color: '#ffffff',
                  fontSize: '15px',
                  maxWidth: '80%'
                }}>
                  {demoConversations[demoMessageIndex].question}
                </div>
              </div>

              {/* Assistant Answer */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-start',
                opacity: showAnswer ? 1 : 0,
                transition: 'opacity 0.5s ease',
                minHeight: '20px'
              }}>
                {showAnswer && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '14px',
                    backgroundColor: '#f1f3f4',
                    color: '#1a1a1a',
                    fontSize: '15px',
                    maxWidth: '80%'
                  }}>
                    {demoConversations[demoMessageIndex].answer}
                  </div>
                )}
              </div>

              <div style={{
                textAlign: 'center',
                fontSize: '12px',
                color: '#999999',
                marginTop: '8px'
              }}>
                Try saying something like this...
              </div>
            </div>
          </div>

          {/* Main CTA */}
          <button
            onClick={handleMicClick}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: '#007bff',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transform: 'scale(1)',
              transition: 'all 0.3s ease',
              boxShadow: '0 8px 24px rgba(0, 123, 255, 0.3)',
              marginBottom: '16px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 123, 255, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 123, 255, 0.3)';
            }}
            aria-label="Start listening"
          >
            <Mic size={28} />
          </button>

          <p style={{
            fontSize: '16px',
            color: '#007bff',
            fontWeight: '500',
            margin: '0 0 32px 0'
          }}>
            Tap to start cooking
          </p>

          {/* Try Examples */}
          <div style={{ marginBottom: '8px' }}>
            <p style={{
              fontSize: '14px',
              color: '#666666',
              marginBottom: '12px'
            }}>
              Try saying:
            </p>
            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              {[
                "How do I make risotto?",
                "What's for dinner tonight?",
                "Guide me through bread baking"
              ].map((example, index) => (
                <div key={index} style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '20px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  color: '#666666'
                }}>
                  "{example}"
                </div>
              ))}
            </div>
          </div>

          <p style={{
            fontSize: '13px',
            color: '#999999',
            margin: 0
          }}>
            Say "thanks chef" to end anytime
          </p>
        </div>

        {/* Social Proof Section */}
        <div style={{
          backgroundColor: '#ffffff',
          borderTop: '1px solid #f0f0f0',
          padding: '32px 24px',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            <p style={{
              fontSize: '14px',
              color: '#666666',
              marginBottom: '20px'
            }}>
              Trusted by home chefs worldwide
            </p>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '40px',
              flexWrap: 'wrap'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ChefHat size={16} color="#007bff" />
                <span style={{ fontSize: '14px', color: '#666666' }}>1000+ recipes supported</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Clock size={16} color="#007bff" />
                <span style={{ fontSize: '14px', color: '#666666' }}>Real-time guidance</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Users size={16} color="#007bff" />
                <span style={{ fontSize: '14px', color: '#666666' }}>Hands-free cooking</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main chat UI
  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#ffffff'
    }}>
      {/* Header */}
      <header style={{ padding: 0, borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ChefHat size={22} color="var(--color-text)" />
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>PrepTalk</h1>
          </div>
        </div>
        <VoiceStateBar
          isListening={isListening}
          isProcessing={isProcessing}
          isSpeaking={isSpeaking}
          isParsing={isParsing}
          hasError={hasError}
        />
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
        {/* Messages */}
        {messages.map((message, index) => (
          message.role !== 'system' && (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: '12px',
                animation: 'slideIn 0.3s ease-out'
              }}
            >
            <div style={{
              fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              fontSize: '1.2rem',
              lineHeight: 1.5,
              maxWidth: '70%',
              padding: '12px 16px',
              borderRadius: '16px',
              wordWrap: 'break-word',
              whiteSpace: 'pre-line',
              backgroundColor: message.role === 'user' ? '#dcf8c6' : '#f0f4f8',
              color: message.role === 'user' ? '#202020' : '#2c3e50',
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start'
            }}>
              {message.role === 'user' ? (
                message.content
              ) : (
                <RecipeMessage markdownText={message.content} />
              )}
            </div>
          </div>
          )
        ))}
        {/* Auto-scroll target */}
        <div ref={messagesEndRef} />

        {/* Step mode visual (placeholder until tight integration) */}
        {/* This will be bound to useStepMode state in the next subphase */}
        {/* <StepCard
          stepText={currentStep}
          stepIndex={currentStepIndex}
          totalSteps={totalSteps}
          waitingForConfirm={waitingForConfirm}
          timerEndsAt={timerEndsAt}
          paused={paused}
        /> */}
      </main>

      {/* Footer / Mic Button */}
      <footer style={{ padding: '16px', borderTop: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <VoiceMicButton
            isListening={isListening}
            isProcessing={isProcessing}
            isSpeaking={isSpeaking}
            hasError={hasError}
            onClick={handleMicClick}
          />
        </div>
      </footer>
    </div>
  );
};

export default VoiceAssistant;
