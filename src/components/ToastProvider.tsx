"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { undoAction } from "@/lib/actions";

type UndoPayload = {
  type: "feed" | "task" | "insect";
  id: number;
};

type Toast = {
  id: number;
  message: string;
  undo?: UndoPayload;
};

type ToastContextValue = {
  pushToast: (message: string, undo?: UndoPayload) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string, undo?: UndoPayload) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, undo }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 8000);
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  async function handleUndo(toast: Toast) {
    if (!toast.undo) return;
    await undoAction(toast.undo.type, toast.undo.id);
    setToasts((current) => current.filter((item) => item.id !== toast.id));
    pushToast("Undone");
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex max-w-xl items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900 px-5 py-4 text-slate-50 shadow-2xl"
          >
            <p className="text-base font-medium">{toast.message}</p>
            {toast.undo ? (
              <button
                type="button"
                onClick={() => handleUndo(toast)}
                className="rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950"
              >
                Undo
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
