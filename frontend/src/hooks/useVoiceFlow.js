import { useState, useEffect, useRef } from 'react';

export function useVoiceFlow(onSpeechRecognized, onSpeechEnded) {
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      console.warn('Web Speech API not supported in this browser.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onstart = null;
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = (continuous = false) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = continuous;

    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';

    recognition.onstart = () => {
      setListening(true);
      console.log('[VoiceFlow] Recognition started');
    };

    recognition.onresult = (event) => {
      interimTranscriptRef.current = '';
      finalTranscriptRef.current = '';
      for (let i = 0; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript;
        } else {
          interimTranscriptRef.current += result[0].transcript;
        }
      }
      // Call onSpeechRecognized with the current interim or final transcript
      if (onSpeechRecognized) {
        onSpeechRecognized(interimTranscriptRef.current || finalTranscriptRef.current);
      }
      console.log('[VoiceFlow] Interim:', interimTranscriptRef.current, '| Final:', finalTranscriptRef.current);
    };

    recognition.onerror = (e) => {
      setListening(false);
      console.error('[VoiceFlow] Recognition error:', e);
      recognition.stop();
      if (onSpeechEnded) onSpeechEnded('');
    };

    recognition.onend = () => {
      setListening(false);
      const transcript = (interimTranscriptRef.current || finalTranscriptRef.current).trim();
      if (onSpeechEnded) {
        onSpeechEnded(transcript);
      }
      console.log('[VoiceFlow] Recognition ended. Transcript:', transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setListening(false);
      console.log('[VoiceFlow] Recognition stopped by user');
    }
  };

  return { listening, voiceSupported, startListening, stopListening };
} 