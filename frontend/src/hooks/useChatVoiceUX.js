import { useState, useEffect, useRef, useCallback } from 'react';
import { useTTS } from './useTTS';

export function useChatVoiceUX(onNewUserMessage) {
  const { speak, speaking, voiceSupported } = useTTS();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // For when Whisper is transcribing
  const [interimText, setInterimText] = useState('');
  const transcriptionQueueRef = useRef([]);
  const isProcessingQueueRef = useRef(false);

  // Function to process the next item in the transcription queue
  const processNextInQueue = useCallback(async () => {
    if (transcriptionQueueRef.current.length === 0 || isProcessingQueueRef.current) {
      return;
    }

    isProcessingQueueRef.current = true;
    const { audioBlob, id } = transcriptionQueueRef.current.shift();
    console.log(`[useChatVoiceUX] Processing transcription for audioBlob ID: ${id}`);

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('audio', audioBlob, 'speech.webm');

    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.text) {
        console.log('[useChatVoiceUX] Transcription received:', data.text);
        onNewUserMessage(data.text);
      }
    } catch (error) {
      console.error('[useChatVoiceUX] Transcription error:', error);
    }

    setIsProcessing(false);
    isProcessingQueueRef.current = false;

    // Process the next item if available
    processNextInQueue();
  }, [onNewUserMessage]);

  // Callback for MicButton when a transcript is ready
  const handleMicButtonTranscript = useCallback((audioBlob) => {
    // We enqueue it to ensure sequential processing.
    const id = Date.now(); // Simple unique ID
    transcriptionQueueRef.current.push({ audioBlob, id });
    processNextInQueue();
  }, [processNextInQueue]);

  // Callback for MicButton when recording state changes (optional, for debugging/logging)
  const handleMicButtonRecordingStateChange = useCallback((isRecordingNow) => {
    setIsRecording(isRecordingNow);
    console.log('[useChatVoiceUX] MicButton recording state:', isRecordingNow);
  }, []);

  // Auto-start listening after TTS ends
  useEffect(() => {
    if (!speaking && !isRecording && !isProcessing) {
      // Add a small delay to ensure TTS resources are released
      const timer = setTimeout(() => {
        // Only start recording if not already in an active voice session
        if (!speaking && !isRecording && !isProcessing) {
          setIsRecording(true); // This will trigger MicButton to start recording
        }
      }, 500); 
      return () => clearTimeout(timer);
    }
  }, [speaking, isRecording, isProcessing]);

  // Main toggle function for the mic button
  const toggleMic = useCallback(() => {
    if (speaking) {
      speak(''); // Interrupt TTS
      setIsRecording(true); // Start listening after interruption
    } else if (isRecording) {
      setIsRecording(false); // Stop recording
    } else {
      setIsRecording(true); // Start recording
    }
  }, [speaking, isRecording, speak]);

  return {
    isRecording,
    speaking,
    voiceSupported,
    isProcessing,
    interimText, // Will be used if MicButton provides interim data
    toggleMic,
    handleMicButtonTranscript,
    handleMicButtonRecordingStateChange,
  };
} 