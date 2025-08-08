export function getPreferredFemaleVoice(voices) {
  if (!voices || !voices.length) return null;
  const preferredNames = [
    "Google US English",
    "Google UK English Female",
    "Samantha",
    "Microsoft Zira Desktop",
    "Karen"
  ];
  // Try preferred names first
  for (const name of preferredNames) {
    const found = voices.find(v => v.name === name);
    if (found) return found;
  }
  // Fallback: first English female voice
  const femaleEn = voices.find(v => v.lang && v.lang.startsWith("en") && v.gender === "female");
  if (femaleEn) return femaleEn;
  // Fallback: any English voice
  const enVoice = voices.find(v => v.lang && v.lang.startsWith("en"));
  if (enVoice) return enVoice;
  // Fallback: first available
  return voices[0];
}

// Robustly get a preferred English female voice, fallback to any English or first available
export function getPreferredVoice() {
  const voices = window.speechSynthesis.getVoices();
  const preferredNames = [
    "Google US English",
    "Google UK English Female",
    "Samantha",
    "Microsoft Zira Desktop",
    "Karen"
  ];
  for (const name of preferredNames) {
    const found = voices.find(v => v.name === name);
    if (found) return found;
  }
  const enFemale = voices.find(v => v.lang && v.lang.startsWith("en") && v.gender === "female");
  if (enFemale) return enFemale;
  const enVoice = voices.find(v => v.lang && v.lang.startsWith("en"));
  if (enVoice) return enVoice;
  return voices[0];
} 