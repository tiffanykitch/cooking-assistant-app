import React, { useRef, useState, useEffect, useCallback } from 'react';
import MicButton from '../components/MicButton';
import { useTTS } from './hooks/useTTS';
import { useStepMode } from './hooks/useStepMode';
import { useChatVoiceUX } from './hooks/useChatVoiceUX';
import { getApiUrl } from './utils/apiConfig.js';

const AVATARS = {
  user: (
    <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full font-bold">U</span>
  ),
  assistant: (
    <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-400 text-white rounded-full font-bold">C</span>
  ),
};

export default function SousChefChat() {
  // Chat state
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your Sous Chef. How can I help?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Voice and Step Mode states
  const { speak, speaking, voiceSupported } = useTTS();
  const { isRecording,
    isProcessing,
    interimText,
    toggleMic,
    handleMicButtonTranscript,
    handleMicButtonRecordingStateChange, } = useChatVoiceUX(handleSend);

  const { isRecipeMode,
    currentStep,
    waitingForNext,
    handleAssistantReply,
    processUserCommand,
    setIsRecipeMode } = useStepMode(handleSend);

  // Refs for recognition and synthesis
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const waveformCanvasRef = useRef(null); // New ref for the waveform canvas

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  // Auto-start listening after assistant speaks if in recipe mode and waiting for next
  useEffect(() => {
    if (!speaking && isRecipeMode && waitingForNext) {
      // Give a small delay before restarting listening to avoid cutting off last word
      const timer = setTimeout(() => toggleMic(), 500); // Use toggleMic to start recording
      return () => clearTimeout(timer);
    } else if (speaking) {
      if (isRecording) toggleMic(); // Interrupt recording if assistant starts speaking
    }
  }, [speaking, isRecipeMode, waitingForNext, isRecording, toggleMic]);

  // --- Chat Logic ---

  // Send message (from text or voice)
  const handleSend = async (overrideInput) => {
    const messageText = (overrideInput !== undefined ? overrideInput : input).trim();
    if (!messageText || loading) return;

    // If a voice command was processed by useStepMode, don't send to AI directly
    if (processUserCommand(messageText)) {
      setInput('');
      return;
    }

    const newMessages = [...messages, { role: 'user', content: messageText }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(getApiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Pass full conversation history for context
        body: JSON.stringify([
          { role: 'system', content: `You are an AI Sous Chef. Respond in short, 1-2 sentence blurbs. \nWhen guiding through a recipe, provide only one step at a time and wait for the user to say "next" before proceeding. \nAllow clarifying questions about the current step. \nIf the user says "repeat" or "say again", repeat the last instruction.` },
          ...newMessages
        ]),
      });
      const data = await res.json();
      let reply = 'Sorry, something went wrong.';
      if (data.status === 'ok') {
        reply = data.reply;
      }

      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages, { role: 'assistant', content: reply }];
        handleAssistantReply(reply); // Process assistant's reply for step mode
        return updatedMessages;
      });

      // Speak the assistant's reply
      if (voiceSupported) {
        speak(reply);
      }

    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: 'Network error.' }]);
      setIsRecipeMode(false); // Exit recipe mode on network error
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key for text input
  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- UI ---

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      {/* Main landing/rotating text experience should remain here, above the chat box */}
      <div className="mt-8 mb-4">
        {/* Place your rotating text component or logic here, e.g. <RotatingText /> */}
      </div>
      <div className="flex flex-col h-[700px] max-w-lg w-full mx-auto border rounded-lg shadow bg-white"> {/* Increased height to 700px */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex items-end ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="flex flex-col items-center mr-2">
                  {AVATARS.assistant}
                  <span className="text-xs text-gray-500 mt-1">Chef</span>
                </div>
              )}
              <div
                className={`max-w-[70%] px-4 py-2 rounded-2xl shadow-sm whitespace-pre-line break-words
                  ${msg.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-sm ml-2'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm mr-2'}`}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="flex flex-col items-center ml-2">
                  {AVATARS.user}
                  <span className="text-xs text-gray-500 mt-1">User</span>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        {(loading || speaking || isProcessing) && (
          <div className="px-4 pb-2 text-sm text-gray-500 animate-pulse">
            {speaking ? 'Speaking...' : isProcessing ? 'Transcribing...' : 'Chef is typing...'}
          </div>
        )}
        {(isRecording || interimText) && (
          <div className="px-4 pb-2 text-blue-600 font-semibold flex items-center">
            <svg className="w-5 h-5 mr-1 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" /></svg>
            {interimText ? interimText : (isRecipeMode && waitingForNext ? 'Say "next" or ask a question' : 'Listening...')}
          </div>
        )}
        {isRecipeMode && currentStep && (
          <div className="px-4 pb-2 text-sm text-gray-700">
            Current Step: <span className="font-semibold">{currentStep}</span>
          </div>
        )}
        <form
          className="flex items-end gap-2 p-4 border-t bg-white relative" // Added relative to position canvas
          onSubmit={e => { e.preventDefault(); handleSend(); }}
        >
          {isRecording && (
            <canvas
              ref={waveformCanvasRef}
              width={360} // Calculated width based on textarea's content area
              height={24} // Calculated height based on textarea's content area
              className="absolute z-0 opacity-50" // Removed inset-0
              style={{ 
                pointerEvents: 'none',
                top: '24px', // form p-4 (16px) + textarea py-2 (8px) = 24px
                left: '28px', // form p-4 (16px) + textarea px-3 (12px) = 28px
                right: '124px', // form p-4 (16px) + textarea pr-24 (96px) + textarea px-3 (12px) = 124px
                bottom: '24px', // form p-4 (16px) + textarea py-2 (8px) = 24px
                width: 'auto', // Let CSS calculate width
                height: 'auto' // Let CSS calculate height
              }} 
            />
          )}
          <textarea
            ref={textareaRef}
            className="flex-1 resize-y min-h-[40px] max-h-32 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100 relative pr-24" // Increased pr to accommodate both buttons
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Type your message..."
            disabled={loading || speaking || isRecording || isProcessing}
            rows={1}
          />
          <button
            type="submit"
            className="absolute right-14 bottom-4 w-10 h-10 rounded-full bg-black text-white flex items-center justify-center shadow disabled:opacity-50 z-10" // Positioned absolutely
            disabled={loading || !input.trim() || speaking || isRecording || isProcessing}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
          </button>
          {/* Microphone Button */}
          <MicButton
            onTranscript={handleMicButtonTranscript}
            onRecordingStateChange={handleMicButtonRecordingStateChange}
            isRecordingProp={isRecording}
            onClick={toggleMic}
            // disabled={!voiceSupported || loading || isProcessing} // Temporarily remove disabled prop
            canvasRef={waveformCanvasRef}
            className="absolute right-4 bottom-4 z-50" // Increased z-index to ensure visibility
          />
          {/* Debugging: Display voice feature states */}
          <div className="absolute right-4 bottom-16 text-xs text-gray-500 z-50"> {/* Moved inside form, adjusted position */}
            Voice Supported: {String(voiceSupported)}
            <br />
            Loading: {String(loading)}
            <br />
            Is Processing: {String(isProcessing)}
          </div>
        </form>
        {!voiceSupported && (
          <div className="px-4 pb-2 text-xs text-red-500 text-center">
            Voice features are not supported in this browser.
          </div>
        )}
      </div>
    </div>
  );
} 