import { useState, useEffect, useCallback } from 'react';

const RECIPE_MODE_PHRASES = [
  "recipe for", "how to make", "steps to prepare", "cook this", "guide me through"
];

const NEXT_STEP_COMMANDS = ["next", "next step", "continue", "go on"];
const REPEAT_STEP_COMMANDS = ["repeat", "say again", "one more time"];

export function useStepMode(onSendUserMessage) {
  const [isRecipeMode, setIsRecipeMode] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [recipeSteps, setRecipeSteps] = useState([]);
  const [waitingForNext, setWaitingForNext] = useState(false);
  const [lastAssistantMessage, setLastAssistantMessage] = useState('');

  const isRecipePrompt = useCallback((message) => {
    return RECIPE_MODE_PHRASES.some(phrase => message.toLowerCase().includes(phrase));
  }, []);

  const parseAssistantReply = useCallback((reply) => {
    // This is a simplified parser. In a real app, you might use more robust NLP
    // or have the backend explicitly mark recipe steps.
    const sentences = reply.split(/\.\s*|\!\s*|\?\s*/).filter(s => s.trim() !== '');
    if (sentences.length > 0) {
      return { isStep: true, stepContent: sentences[0].trim() }; // Assuming first sentence is a step
    }
    return { isStep: false, stepContent: reply };
  }, []);

  const handleAssistantReply = useCallback((reply) => {
    setLastAssistantMessage(reply);

    if (isRecipeMode) {
      const { isStep, stepContent } = parseAssistantReply(reply);
      if (isStep) {
        setRecipeSteps(prev => [...prev, stepContent]);
        setWaitingForNext(true);
      }
    } else if (isRecipePrompt(reply)) {
      setIsRecipeMode(true);
      setCurrentStepIndex(0);
      setRecipeSteps([]);
      const { isStep, stepContent } = parseAssistantReply(reply);
      if (isStep) {
        setRecipeSteps([stepContent]);
        setWaitingForNext(true);
      }
    }
  }, [isRecipeMode, parseAssistantReply, isRecipePrompt]);

  const processUserCommand = useCallback((command) => {
    const lowerCommand = command.toLowerCase();
    if (waitingForNext && NEXT_STEP_COMMANDS.some(cmd => lowerCommand.includes(cmd))) {
      const nextIndex = currentStepIndex + 1;
      if (nextIndex < recipeSteps.length) {
        setCurrentStepIndex(nextIndex);
        setWaitingForNext(false); // Will be set to true again by handleAssistantReply
        onSendUserMessage("OK, next step."); // Send a message to the AI to trigger next step
        return true;
      } else if (nextIndex === recipeSteps.length && isRecipeMode) {
        // User asked for next, but no more steps stored. Ask AI for next step.
        onSendUserMessage("What's the next step?");
        setWaitingForNext(false);
        return true;
      }
    } else if (REPEAT_STEP_COMMANDS.some(cmd => lowerCommand.includes(cmd))) {
      if (lastAssistantMessage) {
        onSendUserMessage("Could you please repeat that?"); // Ask AI to repeat
        return true;
      }
    }
    return false;
  }, [waitingForNext, currentStepIndex, recipeSteps.length, isRecipeMode, lastAssistantMessage, onSendUserMessage]);

  useEffect(() => {
    // Logic to potentially reset recipe mode if conversation shifts away
    // (e.g., if AI responds with non-recipe content, or after a long pause)
  }, [isRecipeMode]);

  return {
    isRecipeMode,
    currentStep: recipeSteps[currentStepIndex],
    waitingForNext,
    handleAssistantReply,
    processUserCommand,
    setCurrentStepIndex, // Expose for external control if needed
    setIsRecipeMode,     // Expose for external control if needed
  };
} 