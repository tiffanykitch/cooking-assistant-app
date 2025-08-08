import { useEffect, useState, useRef } from 'react';
import { getPreferredVoice } from '../ttsUtils';

export function useTTS() {
  const synthRef = useRef(window.speechSynthesis || null);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);

  useEffect(() => {
    if (!window.speechSynthesis) {
      setVoiceSupported(false);
      console.warn('Web Speech API not supported in this browser.');
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const speak = (text, onEndCallback) => {
    if (!voiceSupported) return;
    if (synthRef.current) synthRef.current.cancel();

    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.voice = getPreferredVoice();
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1.1;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setSpeaking(true);
      console.log('[Voice] Speaking started');
    };

    utterance.onend = () => {
      setSpeaking(false);
      console.log('[Voice] Speaking ended');
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = (e) => {
      setSpeaking(false);
      console.error('[Voice] Speech synthesis error:', e);
      if (onEndCallback) onEndCallback(); // Call onEndCallback even on error
    };

    window.speechSynthesis.speak(utterance);
  };

  return { speak, speaking, voiceSupported };
} 