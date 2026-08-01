"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import {
  speak,
  speechSupported,
  type PendingClarification,
  type VoiceApiResponse,
} from "@/lib/voice";

const emptySubscribe = () => () => {};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
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
  const router = useRouter();
  const supported = useSyncExternalStore(
    emptySubscribe,
    speechSupported,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingClarification | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const handlingRef = useRef(false);
  const pendingRef = useRef<PendingClarification | null>(null);

  function applyResponse(data: VoiceApiResponse) {
    speak(data.spoken);
    if (data.type === "execute") {
      for (const result of data.results) {
        pushToast(result.message, result.undo);
      }
      if (data.pendingClarification) {
        setPending(data.pendingClarification);
        pendingRef.current = data.pendingClarification;
      } else {
        setPending(null);
        pendingRef.current = null;
      }
      router.refresh();
      return;
    }
    if (data.type === "clarify") {
      for (const result of data.results) {
        pushToast(result.message, result.undo);
      }
      pushToast(data.pendingClarification.question);
      setPending(data.pendingClarification);
      pendingRef.current = data.pendingClarification;
      if (data.results.length > 0) router.refresh();
      return;
    }
    if (data.type === "answer") {
      pushToast(data.message);
      setPending(null);
      pendingRef.current = null;
      return;
    }
    pushToast(data.message);
    if (data.results) {
      for (const result of data.results) {
        pushToast(result.message, result.undo);
      }
    }
    setPending(null);
    pendingRef.current = null;
  }

  async function sendTranscript(
    transcript: string,
    clarification: PendingClarification | null = pendingRef.current,
  ) {
    if (handlingRef.current) return;
    handlingRef.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          pendingClarification: clarification,
        }),
      });
      const data = (await res.json()) as VoiceApiResponse & { error?: string };
      if (!res.ok && !data.spoken) {
        const message = data.error ?? data.message ?? "Voice request failed";
        speak(message);
        pushToast(message);
        return;
      }
      applyResponse(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Voice request failed";
      speak(message);
      pushToast(message);
    } finally {
      handlingRef.current = false;
      setBusy(false);
    }
  }

  function startListening() {
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
      void sendTranscript(transcript);
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

    if (busy) return;
    startListening();
  }

  function chooseOption(option: { id: string; label: string }) {
    if (busy || !pendingRef.current) return;
    void sendTranscript(option.label, pendingRef.current);
  }

  function dismissClarify() {
    setPending(null);
    pendingRef.current = null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex max-w-[min(100vw-2rem,22rem)] flex-col items-end gap-3">
      {pending ? (
        <div className="w-full rounded-2xl border border-slate-600 bg-slate-900/95 p-4 text-slate-50 shadow-2xl backdrop-blur">
          <p className="text-sm font-medium leading-snug">{pending.question}</p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {pending.options.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={busy}
                onClick={() => chooseOption(option)}
                className="rounded-xl bg-indigo-400 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-60"
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={dismissClarify}
              className="rounded-xl border border-slate-500 px-3 py-2 text-sm font-medium text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={toggle}
        disabled={busy && !listening}
        className={`min-h-16 min-w-16 rounded-full px-5 py-4 text-base font-bold shadow-2xl transition ${
          listening
            ? "bg-rose-500 text-white"
            : busy
              ? "bg-slate-500 text-white"
              : "bg-indigo-400 text-slate-950 hover:bg-indigo-300"
        }`}
        aria-pressed={listening}
      >
        {listening ? "Listening…" : busy ? "Thinking…" : "Voice"}
      </button>
    </div>
  );
}
