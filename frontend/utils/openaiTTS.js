import { getApiUrl } from '../src/utils/apiConfig.js';

export async function speakWithOpenAI(text) {
  const response = await fetch(getApiUrl('/tts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  audio.play();
} 