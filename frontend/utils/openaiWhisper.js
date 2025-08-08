export async function transcribeAudioWithWhisper(audioFile) {
  const formData = new FormData();
  formData.append('audio', audioFile);

  try {
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[Whisper] Whisper error response:', errorText);
      throw new Error('Failed to transcribe audio');
    }

    const data = await res.json();

    if (!data.transcription) {
      throw new Error('No transcription returned');
    }

    return data.transcription;
  } catch (error) {
    console.error('[Whisper] Error transcribing audio with Whisper:', error);
    return ''; // fallback so App doesn't crash
  }
} 