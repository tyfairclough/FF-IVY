"use client";

import { useState, useTransition } from "react";
import { completeFeedAction } from "@/lib/actions";
import { useToast } from "@/components/ToastProvider";

type Props = {
  cycleIndex: number;
  supplement: string;
  lastFedAt: string | null;
};

export function FeedBanner({ cycleIndex, supplement, lastFedAt }: Props) {
  const { pushToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function onFed() {
    if (busy || pending) return;
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await completeFeedAction();
        pushToast(result.message, result.undo);
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "Could not log feed");
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <section className="rounded-3xl border border-emerald-700/40 bg-gradient-to-br from-emerald-950 to-slate-900 p-6 shadow-xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
        Next feed
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-5xl font-black text-white">#{cycleIndex}</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">
            {supplement}
          </p>
          <p className="mt-3 text-sm text-slate-300">
            {lastFedAt
              ? `Last feed: ${new Date(lastFedAt).toLocaleString()}`
              : "No feeds logged yet — this will be feed #1"}
          </p>
        </div>
        <button
          type="button"
          onClick={onFed}
          disabled={busy || pending}
          className="min-h-20 min-w-48 rounded-3xl bg-emerald-400 px-8 py-5 text-2xl font-black text-slate-950 shadow-lg transition hover:bg-emerald-300 disabled:opacity-60"
        >
          {busy || pending ? "Saving…" : "Fed"}
        </button>
      </div>
    </section>
  );
}
