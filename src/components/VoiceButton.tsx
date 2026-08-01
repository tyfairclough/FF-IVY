"use client";

import { useEffect, useRef, useState } from "react";
import {
  completeFeedAction,
  completeTaskAction,
  logInsectAction,
} from "@/lib/actions";
import { useToast } from "@/components/ToastProvider";
import { parseVoiceCommand, speechSupported } from "@/lib/voice";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export function VoiceButton() {
  const { pushToast } = useToast();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const handlingRef = useRef(false);

  useEffect(() => {
    setSupported(speechSupported());
  }, []);

  async function runCommand(transcript: string) {
    if (handlingRef.current) return;
    handlingRef.current = true;
    try {
      const command = parseVoiceCommand(transcript);
      if (!command) {
        pushToast(`Heard “${transcript}” — no matching command`);
        return;
      }
      if (command.type === "feed") {
        const result = await completeFeedAction();
        pushToast(result.message, result.undo);
        return;
      }
      if (command.type === "task") {
        const result = await completeTaskAction(command.taskKey);
        pushToast(result.message, result.undo);
        return;
      }
      const result = await logInsectAction(command.key, command.kind);
      pushToast(result.message, result.undo);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Voice command failed");
    } finally {
      handlingRef.current = false;
    }
  }

  function toggle() {
    if (!supported) {
      pushToast("Voice needs Chrome on Android");
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      pushToast("Speech recognition unavailable");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "en-GB";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      void runCommand(transcript);
    };
    recognition.onerror = (event) => {
      pushToast(`Voice error: ${event.error}`);
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`fixed bottom-6 right-6 z-40 min-h-16 min-w-16 rounded-full px-5 py-4 text-base font-bold shadow-2xl transition ${
        listening
          ? "bg-rose-500 text-white"
          : "bg-indigo-400 text-slate-950 hover:bg-indigo-300"
      }`}
      aria-pressed={listening}
    >
      {listening ? "Listening…" : "Voice"}
    </button>
  );
}
