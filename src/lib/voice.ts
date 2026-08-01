export type {
  PendingClarification,
  VoiceApiResponse,
  VoiceResultItem,
  VoiceUndo,
} from "@/lib/voice-types";

export function speechSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "webkitSpeechRecognition" in window || "SpeechRecognition" in window
  );
}

export function speak(text: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find(
      (voice) =>
        voice.lang.startsWith("en-GB") && /google|microsoft|natural/i.test(voice.name),
    ) ??
    voices.find((voice) => voice.lang.startsWith("en-GB")) ??
    voices.find((voice) => voice.lang.startsWith("en"));
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
