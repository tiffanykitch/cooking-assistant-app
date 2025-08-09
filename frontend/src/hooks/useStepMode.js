import { useState, useEffect, useCallback, useRef } from 'react';

const RECIPE_MODE_PHRASES = [
  'recipe for', 'how to make', 'steps to prepare', 'cook this', 'guide me through'
];

const NEXT_STEP_COMMANDS = ['next', 'next step', 'continue', 'go on'];
const REPEAT_STEP_COMMANDS = ['repeat', 'say again', 'one more time'];
const DONE_COMMANDS = ['done', 'ready', 'finished', "i'm done", 'added it', 'it\'s in'];
const PAUSE_COMMANDS = ['pause', 'hold on', 'one sec', 'give me a minute', 'wait'];
const RESUME_COMMANDS = ['resume', 'continue timer', 'keep going'];
const END_COMMANDS = ['thanks chef', 'we\'re done', 'end session'];

function extractDurationMs(text) {
  // Very simple duration extractor: "10 minutes", "1 min", "2 hours"
  const m = text.toLowerCase().match(/(\d+\s*(?:hours?|hrs?|minutes?|mins?|seconds?|secs?))/);
  if (!m) return null;
  const seg = m[1];
  const num = parseInt(seg);
  if (isNaN(num)) return null;
  if (/hour|hr/.test(seg)) return num * 60 * 60 * 1000;
  if (/minute|min/.test(seg)) return num * 60 * 1000;
  if (/second|sec/.test(seg)) return num * 1000;
  return null;
}

function classifyStep(text) {
  const lower = text.toLowerCase();
  const durationMs = extractDurationMs(lower);
  if (durationMs) return { stepType: 'duration', expectedDurationMs: durationMs };
  // Action heuristics: leading verbs
  const actionVerbs = ['add', 'mix', 'whisk', 'stir', 'chop', 'slice', 'preheat', 'bake', 'boil', 'simmer', 'pour', 'knead', 'season'];
  if (actionVerbs.some(v => lower.startsWith(v + ' ') || lower.includes(` ${v} `))) {
    return { stepType: 'action', expectedDurationMs: null };
  }
  return { stepType: 'info', expectedDurationMs: null };
}

export function useStepMode(onSendUserMessage) {
  const [isRecipeMode, setIsRecipeMode] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [recipeSteps, setRecipeSteps] = useState([]); // {text, stepType, expectedDurationMs}
  const [waitingForNext, setWaitingForNext] = useState(false); // legacy
  const [waitingForConfirm, setWaitingForConfirm] = useState(false);
  const [lastAssistantMessage, setLastAssistantMessage] = useState('');
  const [timerEndsAt, setTimerEndsAt] = useState(null); // ms epoch
  const timerRef = useRef(null);
  const [paused, setPaused] = useState(false);

  const isRecipePrompt = useCallback((message) => {
    return RECIPE_MODE_PHRASES.some(phrase => message.toLowerCase().includes(phrase));
  }, []);

  const parseAssistantReply = useCallback((reply) => {
    // Return first sentence as a candidate step
    const sentences = reply.split(/\.\s*|\!\s*|\?\s*/).filter(s => s.trim() !== '');
    if (sentences.length > 0) {
      const stepText = sentences[0].trim();
      const { stepType, expectedDurationMs } = classifyStep(stepText);
      return { isStep: true, stepContent: stepText, stepType, expectedDurationMs };
    }
    return { isStep: false, stepContent: reply };
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTimerEndsAt(null);
    setPaused(false);
  };

  const startTimer = (ms) => {
    clearTimer();
    const endAt = Date.now() + ms;
    setTimerEndsAt(endAt);
    timerRef.current = setTimeout(() => {
      // Auto-nudge when timer completes
      if (onSendUserMessage) {
        onSendUserMessage('Timer finished. Ready for the next step?');
      }
      setWaitingForConfirm(true);
      clearTimer();
    }, ms);
  };

  const handleAssistantReply = useCallback((reply) => {
    setLastAssistantMessage(reply);

    const { isStep, stepContent, stepType, expectedDurationMs } = parseAssistantReply(reply);
    if (!isStep) return;

    const stepObj = { text: stepContent, stepType, expectedDurationMs: expectedDurationMs || null };

    if (!isRecipeMode) {
      setIsRecipeMode(true);
      setCurrentStepIndex(0);
      setRecipeSteps([stepObj]);
    } else {
      setRecipeSteps(prev => [...prev, stepObj]);
      setCurrentStepIndex(prev => prev + 1);
    }

    setWaitingForNext(true); // legacy for external UI

    if (stepType === 'action') {
      clearTimer();
      setWaitingForConfirm(true);
    } else if (stepType === 'duration' && stepObj.expectedDurationMs) {
      setWaitingForConfirm(false);
      startTimer(stepObj.expectedDurationMs);
    } else {
      setWaitingForConfirm(false);
      clearTimer();
    }
  }, [isRecipeMode, parseAssistantReply]);

  const processUserCommand = useCallback((command) => {
    const lower = command.toLowerCase();

    if (END_COMMANDS.some(cmd => lower.includes(cmd))) {
      clearTimer();
      setIsRecipeMode(false);
      setWaitingForConfirm(false);
      setWaitingForNext(false);
      return true;
    }

    if (REPEAT_STEP_COMMANDS.some(cmd => lower.includes(cmd))) {
      if (lastAssistantMessage && onSendUserMessage) {
        onSendUserMessage('Could you please repeat that?');
        return true;
      }
    }

    if (PAUSE_COMMANDS.some(cmd => lower.includes(cmd))) {
      if (timerEndsAt) {
        // Pause timer
        const msLeft = Math.max(0, timerEndsAt - Date.now());
        clearTimer();
        setTimerEndsAt(Date.now() + msLeft); // store remaining in state
        setPaused(true);
      }
      setWaitingForConfirm(true);
      return true;
    }

    if (RESUME_COMMANDS.some(cmd => lower.includes(cmd))) {
      if (paused && timerEndsAt) {
        const msLeft = Math.max(0, timerEndsAt - Date.now());
        startTimer(msLeft);
        setPaused(false);
        setWaitingForConfirm(false);
      }
      return true;
    }

    if (DONE_COMMANDS.some(cmd => lower.includes(cmd)) || NEXT_STEP_COMMANDS.some(cmd => lower.includes(cmd))) {
      clearTimer();
      setWaitingForConfirm(false);
      setWaitingForNext(false);
      if (onSendUserMessage) {
        onSendUserMessage("What's the next step?");
      }
      return true;
    }

    return false;
  }, [lastAssistantMessage, onSendUserMessage, timerEndsAt, paused]);

  const seedRecipe = useCallback((recipe) => {
    // recipe: { title, ingredients: string[], steps: [{ step, instruction, estimated_time_min? }], meta? }
    if (!recipe || !Array.isArray(recipe.steps)) return;
    const steps = recipe.steps.map(s => {
      const text = s.instruction || String(s.step) + '. ' + (s.text || '');
      const ms = s.estimated_time_min ? s.estimated_time_min * 60 * 1000 : extractDurationMs(text) || null;
      const cls = ms ? { stepType: 'duration', expectedDurationMs: ms } : classifyStep(text);
      return { text, stepType: cls.stepType, expectedDurationMs: cls.expectedDurationMs || null };
    });
    setIsRecipeMode(true);
    setCurrentStepIndex(0);
    setRecipeSteps(steps);
    setWaitingForConfirm(steps[0]?.stepType === 'action');
    if (steps[0]?.stepType === 'duration' && steps[0]?.expectedDurationMs) startTimer(steps[0].expectedDurationMs);
  }, []);

  useEffect(() => () => clearTimer(), []);

  return {
    isRecipeMode,
    currentStep: recipeSteps[currentStepIndex]?.text,
    currentStepIndex,
    totalSteps: recipeSteps.length,
    waitingForNext,
    waitingForConfirm,
    paused,
    timerEndsAt,
    handleAssistantReply,
    processUserCommand,
    setCurrentStepIndex,
    setIsRecipeMode,
    seedRecipe,
  };
} 