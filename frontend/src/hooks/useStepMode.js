import { useState, useEffect, useCallback, useRef } from 'react';

const RECIPE_MODE_PHRASES = [
  "recipe for", "how to make", "steps to prepare", "cook this", "guide me through"
];

const NEXT_STEP_COMMANDS = ["next", "next step", "continue", "go on", "ready", "done", "finished"];
const REPEAT_STEP_COMMANDS = ["repeat", "say again", "one more time"]; 
const PAUSE_COMMANDS = ["pause", "hold on", "one sec", "wait"]; 
const RESUME_COMMANDS = ["resume", "continue", "okay go", "go ahead"]; 
const END_COMMANDS = ["thanks chef", "we're done", "we are done", "end session"]; 

const DURATION_REGEX = /(\d+)\s*(minutes?|mins?|seconds?|secs?)\b/i;

export function useStepMode(onSendUserMessage) {
  const [isRecipeMode, setIsRecipeMode] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [recipeSteps, setRecipeSteps] = useState([]);
  const [waitingForNext, setWaitingForNext] = useState(false);
  const [lastAssistantMessage, setLastAssistantMessage] = useState('');

  // New state for waiting mode and timers
  const [waitingForConfirm, setWaitingForConfirm] = useState(false);
  const [stepType, setStepType] = useState('info'); // 'action' | 'duration' | 'info'
  const [expectedDurationMs, setExpectedDurationMs] = useState(null);
  const [startedAtMs, setStartedAtMs] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  const isRecipePrompt = useCallback((message) => {
    return RECIPE_MODE_PHRASES.some(phrase => message.toLowerCase().includes(phrase));
  }, []);

  // Classify step and extract timing
  const classifyStep = useCallback((text) => {
    if (!text) return { type: 'info', durationMs: null };
    const durationMatch = text.match(DURATION_REGEX);
    if (durationMatch) {
      const amount = parseInt(durationMatch[1], 10);
      const unit = durationMatch[2].toLowerCase();
      const ms = unit.startsWith('sec') ? amount * 1000 : amount * 60 * 1000;
      return { type: 'duration', durationMs: ms };
    }
    // Very simple heuristic: imperative verb at start implies action
    if (/^(add|mix|stir|whisk|knead|chop|dice|slice|preheat|simmer|boil|bake|fold|pour|season|salt|pepper)\b/i.test(text)) {
      return { type: 'action', durationMs: null };
    }
    return { type: 'info', durationMs: null };
  }, []);

  const parseAssistantReply = useCallback((reply) => {
    const sentences = reply.split(/\.\s*|\!\s*|\?\s*/).filter(s => s.trim() !== '');
    if (sentences.length > 0) {
      return { isStep: true, stepContent: sentences[0].trim() };
    }
    return { isStep: false, stepContent: reply };
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((ms) => {
    clearTimer();
    setStartedAtMs(Date.now());
    setIsPaused(false);
    if (ms && ms > 0) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setWaitingForConfirm(true); // prompt to proceed
        onSendUserMessage("Timer finished. Are you ready for the next step?");
      }, ms);
    }
  }, [clearTimer, onSendUserMessage]);

  const handleAssistantReply = useCallback((reply) => {
    setLastAssistantMessage(reply);

    const { isStep, stepContent } = parseAssistantReply(reply);
    if (!isRecipeMode && isRecipePrompt(reply)) {
      setIsRecipeMode(true);
      setCurrentStepIndex(0);
      setRecipeSteps([]);
    }

    if (isStep) {
      setRecipeSteps(prev => [...prev, stepContent]);
      setWaitingForNext(true);

      // classify and set waiting mode / timer
      const { type, durationMs } = classifyStep(stepContent);
      setStepType(type);
      setExpectedDurationMs(durationMs);

      if (type === 'action') {
        setWaitingForConfirm(true);
        clearTimer();
        setStartedAtMs(Date.now());
      } else if (type === 'duration') {
        setWaitingForConfirm(false);
        startTimer(durationMs);
      } else {
        setWaitingForConfirm(false);
        clearTimer();
      }
    }
  }, [isRecipeMode, isRecipePrompt, parseAssistantReply, classifyStep, startTimer, clearTimer]);

  const processUserCommand = useCallback((command) => {
    const lower = command.toLowerCase();

    if (END_COMMANDS.some(k => lower.includes(k))) {
      // Let caller decide how to end; we just acknowledge here
      onSendUserMessage("Ending session. Thanks, chef.");
      return true;
    }

    if (REPEAT_STEP_COMMANDS.some(cmd => lower.includes(cmd))) {
      if (lastAssistantMessage) {
        onSendUserMessage("Could you please repeat that?");
        return true;
      }
    }

    if (PAUSE_COMMANDS.some(cmd => lower.includes(cmd))) {
      setIsPaused(true);
      clearTimer();
      onSendUserMessage("Pausing. Say 'resume' when you're ready.");
      return true;
    }

    if (RESUME_COMMANDS.some(cmd => lower.includes(cmd))) {
      if (stepType === 'duration' && expectedDurationMs && startedAtMs) {
        // Resume remaining time (simple approach: restart full timer)
        startTimer(expectedDurationMs);
      }
      setIsPaused(false);
      return true;
    }

    // Proceed intents while waiting
    if ((waitingForNext || waitingForConfirm) && NEXT_STEP_COMMANDS.some(cmd => lower.includes(cmd))) {
      const nextIndex = currentStepIndex + 1;
      setWaitingForConfirm(false);
      setIsPaused(false);
      clearTimer();

      if (nextIndex < recipeSteps.length) {
        setCurrentStepIndex(nextIndex);
        setWaitingForNext(false);
        onSendUserMessage("OK, next step.");
        return true;
      } else if (isRecipeMode) {
        onSendUserMessage("What's the next step?");
        setWaitingForNext(false);
        return true;
      }
    }

    return false;
  }, [END_COMMANDS, REPEAT_STEP_COMMANDS, PAUSE_COMMANDS, RESUME_COMMANDS, waitingForNext, waitingForConfirm, currentStepIndex, recipeSteps.length, isRecipeMode, lastAssistantMessage, onSendUserMessage, stepType, expectedDurationMs, startedAtMs, clearTimer, startTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return {
    isRecipeMode,
    currentStep: recipeSteps[currentStepIndex],
    currentStepIndex,
    totalSteps: recipeSteps.length,
    waitingForNext,
    waitingForConfirm,
    stepType,
    expectedDurationMs,
    startedAtMs,
    isPaused,
    handleAssistantReply,
    processUserCommand,
    setCurrentStepIndex,
    setIsRecipeMode,
  };
} 